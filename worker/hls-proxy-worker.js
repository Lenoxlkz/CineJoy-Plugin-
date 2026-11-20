/**
 * Cloudflare Worker: CineJoy HLS Proxy & ExoPlayer Fix
 *
 * Características:
 * 1. ExoPlayer Fix por firma binaria (magic bytes):
 *    - Segmentos fMP4 disfrazados como .png / .jpg (lightspeed.st, ferb.st, bright67.online) -> video/mp4
 *    - Segmentos MPEG-TS con text/html o text/vnd.trolltech.linguist (vrodaz.com) -> video/mp2t
 *    - Segmentos PNG falsos con chunk tsDa (erebus.cursed.st / ttcdn-us.com) -> extrae el TS puro y entrega video/mp2t
 * 2. Detecta listas HLS (#EXTM3U) aunque vengan con extensión .jpg/.png o MIME image/jpeg.
 * 3. Reenvía Referer/Origin (parámetro &ref= o automático para hosts conocidos de CineJoy) evitando errores 403/404.
 * 4. Reescribe listas .m3u8 con rutas de extensión compatible (/playlist.m3u8, /init.mp4, /seg.mp4, /seg.ts) para ExoPlayer.
 * 5. Soporte completo de CORS y peticiones Range (206 Partial Content).
 */

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const CINEJOY_REFERER = 'https://cinejoy.pk/';
const CINEJOY_ORIGIN = 'https://cinejoy.pk';

const REFERER_REQUIRED_HOSTS = [
  'lightspeed.st',
  'ferb.st',
  'cursed.st',
  'wing.st',
];

const MP4_BOX_TYPES = new Set([
  'ftyp',
  'styp',
  'moof',
  'moov',
  'sidx',
  'emsg',
  'free',
  'mdat',
]);

export function resolveUpstreamHeaders(targetUrl, refParam, origParam, rangeHeader) {
  const headers = new Headers();
  headers.set('User-Agent', DEFAULT_USER_AGENT);
  headers.set('Accept', '*/*');
  headers.set('Accept-Language', 'en-US,en;q=0.9');

  if (rangeHeader) {
    headers.set('Range', rangeHeader);
  }

  let effectiveRef = '';
  let effectiveOrig = '';

  if (refParam) {
    try {
      const parsedRef = new URL(refParam);
      if (parsedRef.protocol === 'https:' || parsedRef.protocol === 'http:') {
        effectiveRef = parsedRef.toString();
        effectiveOrig = parsedRef.origin;
      }
    } catch {
      // Ignorar ref inválido
    }
  }

  if (!effectiveRef) {
    const host = targetUrl.hostname.toLowerCase();
    const needsCinejoyRef = REFERER_REQUIRED_HOSTS.some(
      (suffix) => host === suffix || host.endsWith('.' + suffix)
    );
    if (needsCinejoyRef) {
      effectiveRef = CINEJOY_REFERER;
      effectiveOrig = CINEJOY_ORIGIN;
    }
  }

  if (origParam) {
    try {
      const parsedOrig = new URL(origParam);
      if (parsedOrig.protocol === 'https:' || parsedOrig.protocol === 'http:') {
        effectiveOrig = parsedOrig.origin;
      }
    } catch {
      // Ignorar orig inválido
    }
  }

  if (effectiveRef) {
    headers.set('Referer', effectiveRef);
  }
  if (effectiveOrig) {
    headers.set('Origin', effectiveOrig);
  }

  return headers;
}

export function buildProxyUrl(workerOrigin, targetUrlStr, kindHint, refParam, origParam) {
  let pathHint = '/';
  if (kindHint === 'm3u8') pathHint = '/playlist.m3u8';
  else if (kindHint === 'init') pathHint = '/init.mp4';
  else if (kindHint === 'mp4') pathHint = '/seg.mp4';
  else if (kindHint === 'ts') pathHint = '/seg.ts';
  else if (kindHint === 'key') pathHint = '/key.bin';
  else if (kindHint === 'vtt') pathHint = '/sub.vtt';
  else if (kindHint === 'seg') pathHint = '/seg';

  const u = new URL(pathHint, workerOrigin);
  u.searchParams.set('url', targetUrlStr);
  if (refParam) u.searchParams.set('ref', refParam);
  if (origParam) u.searchParams.set('orig', origParam);
  return u.toString();
}

export function isLikelyM3u8Bytes(bytes) {
  if (!bytes || bytes.length < 7) return false;
  let offset = 0;
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    offset = 3;
  }
  while (
    offset < bytes.length &&
    (bytes[offset] === 0x20 || bytes[offset] === 0x09 || bytes[offset] === 0x0a || bytes[offset] === 0x0d)
  ) {
    offset++;
  }
  if (offset + 7 > bytes.length) return false;
  // "#EXTM3U"
  return (
    bytes[offset] === 0x23 &&
    bytes[offset + 1] === 0x45 &&
    bytes[offset + 2] === 0x58 &&
    bytes[offset + 3] === 0x54 &&
    bytes[offset + 4] === 0x4d &&
    bytes[offset + 5] === 0x33 &&
    bytes[offset + 6] === 0x55
  );
}

export function parsePngWrappedOffset(bytes) {
  if (!bytes || bytes.length < 24) return null;
  // Firma PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47 ||
    bytes[4] !== 0x0d ||
    bytes[5] !== 0x0a ||
    bytes[6] !== 0x1a ||
    bytes[7] !== 0x0a
  ) {
    return null;
  }

  let off = 8;
  while (off + 8 <= bytes.length) {
    const chunkLen =
      ((bytes[off] << 24) | (bytes[off + 1] << 16) | (bytes[off + 2] << 8) | bytes[off + 3]) >>> 0;
    const chunkType = String.fromCharCode(
      bytes[off + 4],
      bytes[off + 5],
      bytes[off + 6],
      bytes[off + 7]
    );
    const payloadOffset = off + 8;

    if (chunkType === 'tsDa' || chunkType === 'mpDa') {
      const firstByte = payloadOffset < bytes.length ? bytes[payloadOffset] : 0;
      const mime = chunkType === 'mpDa' || firstByte !== 0x47 ? 'video/mp4' : 'video/mp2t';
      return { payloadOffset, payloadLength: chunkLen, mime };
    }

    if (chunkType === 'IEND') break;
    const nextOff = payloadOffset + chunkLen + 4;
    if (nextOff <= off || nextOff > 4096) break;
    off = nextOff;
  }

  return null;
}

export function sniffMediaMagic(bytes, pathnameLower = '') {
  if (!bytes || bytes.length === 0) return null;

  if (isLikelyM3u8Bytes(bytes)) {
    return { kind: 'm3u8', mime: 'application/vnd.apple.mpegurl; charset=utf-8' };
  }

  const pngWrap = parsePngWrappedOffset(bytes);
  if (pngWrap) {
    return { kind: 'png-wrapped', ...pngWrap };
  }

  // fMP4 / ISO BMFF box at offset 4..8
  if (bytes.length >= 8) {
    const boxType = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
    if (MP4_BOX_TYPES.has(boxType)) {
      return { kind: 'mp4', mime: 'video/mp4' };
    }
  }

  // MPEG-TS sync byte 0x47
  if (bytes[0] === 0x47 && (bytes.length <= 188 || bytes[188] === 0x47)) {
    return { kind: 'ts', mime: 'video/mp2t' };
  }

  if (pathnameLower.endsWith('.vtt')) {
    return { kind: 'vtt', mime: 'text/vtt; charset=utf-8' };
  }

  return null;
}

export function rewriteM3u8(originalText, baseUrl, workerOrigin, refParam = '', origParam = '') {
  const hasMap = /#EXT-X-MAP\b/i.test(originalText);
  const lines = originalText.split(/\r?\n/);
  let expectingVariantPlaylist = false;

  const rewritten = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;

    if (trimmed.startsWith('#')) {
      if (/^#EXT-X-STREAM-INF:/i.test(trimmed)) {
        expectingVariantPlaylist = true;
      }

      if (trimmed.includes('URI="')) {
        const isMapTag = /^#EXT-X-MAP:/i.test(trimmed);
        const isKeyTag = /^#EXT-X-KEY:/i.test(trimmed);
        const isMediaTag = /^#EXT-X-MEDIA:/i.test(trimmed);
        const isIFrameTag = /^#EXT-X-I-FRAME-STREAM-INF:/i.test(trimmed);
        const isSubtitleMedia = isMediaTag && /TYPE=SUBTITLES/i.test(trimmed);

        return line.replace(/URI="([^"]+)"/g, (match, uri) => {
          try {
            const resolved = new URL(uri, baseUrl).toString();
            const lowerPath = new URL(resolved).pathname.toLowerCase();
            let hint = 'seg';
            if (isMapTag) hint = 'init';
            else if (isKeyTag) hint = 'key';
            else if (isSubtitleMedia && lowerPath.endsWith('.vtt')) hint = 'vtt';
            else if (isMediaTag || isIFrameTag || lowerPath.endsWith('.m3u8') || lowerPath.endsWith('.m3u')) {
              hint = 'm3u8';
            }
            return `URI="${buildProxyUrl(workerOrigin, resolved, hint, refParam, origParam)}"`;
          } catch {
            return match;
          }
        });
      }

      return line;
    }

    try {
      const resolved = new URL(trimmed, baseUrl).toString();
      const lowerPath = new URL(resolved).pathname.toLowerCase();
      let hint = 'seg';

      if (expectingVariantPlaylist || lowerPath.endsWith('.m3u8') || lowerPath.endsWith('.m3u')) {
        hint = 'm3u8';
      } else if (hasMap || lowerPath.endsWith('.mp4') || lowerPath.endsWith('.m4s') || lowerPath.endsWith('.m4v') || lowerPath.endsWith('.m4a')) {
        hint = 'mp4';
      } else if (lowerPath.endsWith('.ts')) {
        hint = 'ts';
      } else if (lowerPath.endsWith('.vtt')) {
        hint = 'vtt';
      }

      expectingVariantPlaylist = false;
      return buildProxyUrl(workerOrigin, resolved, hint, refParam, origParam);
    } catch {
      expectingVariantPlaylist = false;
      return line;
    }
  });

  return rewritten.join('\n');
}

function concatUint8(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function endsWithPngIend(tail16) {
  if (!tail16 || tail16.length !== 16) return false;
  // 4-byte chunk CRC + 12-byte IEND (00 00 00 00 49 45 4E 44 AE 42 60 82)
  return (
    tail16[4] === 0x00 &&
    tail16[5] === 0x00 &&
    tail16[6] === 0x00 &&
    tail16[7] === 0x00 &&
    tail16[8] === 0x49 &&
    tail16[9] === 0x45 &&
    tail16[10] === 0x4e &&
    tail16[11] === 0x44 &&
    tail16[12] === 0xae &&
    tail16[13] === 0x42 &&
    tail16[14] === 0x60 &&
    tail16[15] === 0x82
  );
}

export function unwrapPngBuffer(bytes) {
  const info = parsePngWrappedOffset(bytes);
  if (!info) return bytes;
  const end = Math.min(bytes.length, info.payloadOffset + info.payloadLength);
  return bytes.subarray(info.payloadOffset, end);
}

function createPrependAndOptionallyStripPngStream(initialChunk, reader, stripPngOffset) {
  let pending = initialChunk;
  let skippedHeader = false;
  let tailHold = new Uint8Array(0);

  return new ReadableStream({
    async pull(controller) {
      while (true) {
        let chunk = pending;
        pending = null;

        if (!chunk) {
          const { value, done } = await reader.read();
          if (done) {
            if (tailHold.length > 0) {
              if (!(stripPngOffset !== null && endsWithPngIend(tailHold))) {
                controller.enqueue(tailHold);
              }
              tailHold = new Uint8Array(0);
            }
            controller.close();
            return;
          }
          chunk = value;
        }

        if (!chunk || chunk.length === 0) continue;

        if (stripPngOffset !== null) {
          if (!skippedHeader) {
            if (chunk.length <= stripPngOffset) {
              stripPngOffset -= chunk.length;
              continue;
            }
            chunk = chunk.subarray(stripPngOffset);
            skippedHeader = true;
          }

          const combined = tailHold.length > 0 ? concatUint8(tailHold, chunk) : chunk;
          if (combined.length <= 16) {
            tailHold = combined;
            continue;
          }
          const emitLen = combined.length - 16;
          controller.enqueue(combined.subarray(0, emitLen));
          tailHold = combined.subarray(emitLen);
          return;
        }

        controller.enqueue(chunk);
        return;
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

function buildCorsHeaders(baseHeaders) {
  const headers = new Headers(baseHeaders || undefined);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  headers.set('Access-Control-Allow-Headers', '*');
  headers.set(
    'Access-Control-Expose-Headers',
    'Content-Length, Content-Range, Content-Type, Accept-Ranges'
  );
  return headers;
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: buildCorsHeaders({ 'Access-Control-Max-Age': '86400' }),
      });
    }

    const reqUrl = new URL(request.url);
    const targetUrlParam = reqUrl.searchParams.get('url');
    const refParam = reqUrl.searchParams.get('ref') || '';
    const origParam = reqUrl.searchParams.get('orig') || '';

    if (!targetUrlParam) {
      return new Response(
        JSON.stringify(
          {
            service: 'CineJoy HLS Proxy (ExoPlayer Fix)',
            status: 'online',
            usage: `${reqUrl.origin}/playlist.m3u8?url=https://servidor.com/video/master.m3u8`,
            features: [
              'Detección de #EXTM3U incluso en URLs .jpg/.png',
              'Corrección de Content-Type por magic bytes (fMP4 -> video/mp4, TS -> video/mp2t)',
              'Desempaquetado de segmentos TS/fMP4 ocultos en contenedores PNG (tsDa)',
              'Soporte de Referer/Origin (&ref=) y rutas con extensión para ExoPlayer',
              'Soporte completo de Range (206 Partial Content) y CORS',
            ],
          },
          null,
          2
        ),
        {
          status: 200,
          headers: buildCorsHeaders({
            'Content-Type': 'application/json; charset=utf-8',
          }),
        }
      );
    }

    let targetUrl;
    try {
      targetUrl = new URL(targetUrlParam);
      if (targetUrl.protocol !== 'https:' && targetUrl.protocol !== 'http:') {
        throw new Error('Protocolo no soportado');
      }
    } catch {
      return new Response('URL de destino inválida', {
        status: 400,
        headers: buildCorsHeaders(),
      });
    }

    const forwardHeaders = resolveUpstreamHeaders(
      targetUrl,
      refParam,
      origParam,
      request.headers.get('Range')
    );

    try {
      const response = await fetch(targetUrl.toString(), {
        method: request.method === 'HEAD' ? 'HEAD' : 'GET',
        headers: forwardHeaders,
        redirect: 'follow',
      });

      const responseHeaders = buildCorsHeaders(response.headers);
      const targetPathLower = targetUrl.pathname.toLowerCase();
      const reqPathLower = reqUrl.pathname.toLowerCase();
      const rawContentType = (response.headers.get('content-type') || '').toLowerCase();

      if (!response.ok || !response.body || request.method === 'HEAD') {
        if (response.ok && request.method === 'HEAD') {
          if (reqPathLower.endsWith('.m3u8') || targetPathLower.endsWith('.m3u8')) {
            responseHeaders.set('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
          } else if (reqPathLower.endsWith('.mp4') || targetPathLower.endsWith('.mp4')) {
            responseHeaders.set('Content-Type', 'video/mp4');
          } else if (reqPathLower.endsWith('.ts') || targetPathLower.endsWith('.ts')) {
            responseHeaders.set('Content-Type', 'video/mp2t');
          }
        }
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        });
      }

      const explicitM3u8 =
        targetPathLower.endsWith('.m3u8') ||
        targetPathLower.endsWith('.m3u') ||
        rawContentType.includes('mpegurl') ||
        rawContentType.includes('vnd.apple.mpegurl');

      if (explicitM3u8) {
        const originalText = await response.text();
        const rewrittenContent = rewriteM3u8(
          originalText,
          targetUrl.toString(),
          reqUrl.origin,
          refParam,
          origParam
        );
        responseHeaders.set('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
        responseHeaders.delete('content-length');
        responseHeaders.delete('content-encoding');
        return new Response(rewrittenContent, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        });
      }

      // Leer hasta 128 bytes iniciales para detectar #EXTM3U, PNG tsDa, fMP4 o MPEG-TS
      const reader = response.body.getReader();
      let headBuf = new Uint8Array(0);
      let eof = false;

      while (headBuf.length < 192) {
        const { value, done } = await reader.read();
        if (done) {
          eof = true;
          break;
        }
        if (value && value.length > 0) {
          headBuf = headBuf.length === 0 ? value : concatUint8(headBuf, value);
        }
      }

      const detected = sniffMediaMagic(headBuf, targetPathLower);

      if (detected?.kind === 'm3u8') {
        const chunks = [headBuf];
        if (!eof) {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value && value.length > 0) chunks.push(value);
          }
        }
        let total = 0;
        for (const c of chunks) total += c.length;
        const full = new Uint8Array(total);
        let pos = 0;
        for (const c of chunks) {
          full.set(c, pos);
          pos += c.length;
        }
        const originalText = new TextDecoder().decode(full);
        const rewrittenContent = rewriteM3u8(
          originalText,
          targetUrl.toString(),
          reqUrl.origin,
          refParam,
          origParam
        );
        responseHeaders.set('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
        responseHeaders.delete('content-length');
        responseHeaders.delete('content-encoding');
        return new Response(rewrittenContent, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        });
      }

      let stripPngOffset = null;
      if (detected?.kind === 'png-wrapped') {
        stripPngOffset = detected.payloadOffset;
        responseHeaders.set('Content-Type', detected.mime);
        responseHeaders.delete('content-length');
        responseHeaders.delete('content-encoding');
      } else if (detected?.mime) {
        responseHeaders.set('Content-Type', detected.mime);
      } else if (reqPathLower.endsWith('.ts') || targetPathLower.endsWith('.ts')) {
        responseHeaders.set('Content-Type', 'video/mp2t');
      } else if (
        reqPathLower.endsWith('.mp4') ||
        targetPathLower.endsWith('.mp4') ||
        targetPathLower.endsWith('.m4s')
      ) {
        responseHeaders.set('Content-Type', 'video/mp4');
      }

      if (eof) {
        const finalBytes = stripPngOffset !== null ? unwrapPngBuffer(headBuf) : headBuf;
        return new Response(finalBytes, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        });
      }

      const outStream = createPrependAndOptionallyStripPngStream(headBuf, reader, stripPngOffset);
      return new Response(outStream, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: 'Proxy request failed',
          message: err?.message || String(err),
          target: targetUrlParam,
        }),
        {
          status: 502,
          headers: buildCorsHeaders({
            'Content-Type': 'application/json',
          }),
        }
      );
    }
  },
};

