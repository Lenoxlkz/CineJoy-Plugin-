/**
 * Cloudflare Worker: CineJoy HLS Proxy & ExoPlayer Fix
 *
 * Características:
 * 1. ExoPlayer Fix: Reescribe cabeceras 'text/html' erróneas a 'video/mp2t' en segmentos .ts.
 * 2. Reescribe listas de reproducción HLS (.m3u8) para que todos los segmentos pasen por el proxy.
 * 3. Corrige cabeceras CORS (Access-Control-Allow-Origin: *) para reproducción fluida en Android/Kino.
 * 4. Usa User-Agent de navegador moderno y omite Referer para evitar bloqueos.
 * 5. Soporta peticiones parciales (Range / 206 Partial Content) para retroceder y avanzar rápido.
 */

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export default {
  async fetch(request, env, ctx) {
    // 1. Manejo de preflight CORS (OPTIONS)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const reqUrl = new URL(request.url);
    const targetUrlParam = reqUrl.searchParams.get('url');

    // Si no se especifica URL, devuelve estado del Worker
    if (!targetUrlParam) {
      return new Response(
        JSON.stringify(
          {
            service: 'CineJoy HLS Proxy (ExoPlayer Fix)',
            status: 'online',
            usage: `${reqUrl.origin}/?url=https://servidor.com/video/master.m3u8`,
            features: [
              'Reescritura de text/html a video/mp2t (ExoPlayer Fix)',
              'Reescritura recursiva de manifiestos HLS m3u8',
              'Soporte completo de Range (206 Partial Content)',
              'Cabeceras CORS permisivas',
              'User-Agent limpio sin Referer',
            ],
          },
          null,
          2
        ),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    let targetUrl;
    try {
      targetUrl = new URL(targetUrlParam);
    } catch {
      return new Response('URL de destino inválida', {
        status: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    // 2. Construir cabeceras para la petición al servidor origen
    const forwardHeaders = new Headers();
    forwardHeaders.set('User-Agent', DEFAULT_USER_AGENT);
    forwardHeaders.set('Accept', '*/*');

    // Reenviar Range si viene en la petición (vital para streaming y seeking)
    const rangeHeader = request.headers.get('Range');
    if (rangeHeader) {
      forwardHeaders.set('Range', rangeHeader);
    }

    // NO enviar Referer ni Origin para evitar filtros estrictos de anti-hotlink

    try {
      const response = await fetch(targetUrl.toString(), {
        method: request.method === 'HEAD' ? 'HEAD' : 'GET',
        headers: forwardHeaders,
        redirect: 'follow',
      });

      // Crear cabeceras de respuesta con soporte CORS
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      responseHeaders.set('Access-Control-Allow-Headers', '*');
      responseHeaders.set(
        'Access-Control-Expose-Headers',
        'Content-Length, Content-Range, Content-Type, Accept-Ranges'
      );

      const pathLower = targetUrl.pathname.toLowerCase();
      const rawContentType = (response.headers.get('content-type') || '').toLowerCase();

      const isM3u8 =
        pathLower.endsWith('.m3u8') ||
        rawContentType.includes('mpegurl') ||
        rawContentType.includes('vnd.apple.mpegurl');

      const isTs =
        pathLower.endsWith('.ts') ||
        rawContentType.includes('mp2t') ||
        rawContentType.includes('video/mp2t');

      const isMp4 = pathLower.endsWith('.mp4') || rawContentType.includes('video/mp4');

      // 3. EXOPLAYER FIX: Para segmentos .ts que llegan con text/html o tipos erróneos
      if (isTs || (rawContentType.includes('text/html') && pathLower.includes('.ts'))) {
        responseHeaders.set('Content-Type', 'video/mp2t');
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        });
      }

      // 4. Si es MP4, asegurar Content-Type adecuado
      if (isMp4) {
        responseHeaders.set('Content-Type', 'video/mp4');
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        });
      }

      // 5. Si es un manifiesto HLS (.m3u8), reescribir las URLs internas
      if (isM3u8 && response.ok) {
        responseHeaders.set('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
        const originalText = await response.text();

        // Reescribir cada línea que sea una URL de segmento o sub-manifiesto
        const baseUrl = targetUrl.toString();
        const rewrittenLines = originalText.split('\n').map(line => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) {
            // Manejar tags URI="..." como llaves AES o subtítulos
            if (trimmed.includes('URI="')) {
              return trimmed.replace(/URI="([^"]+)"/g, (match, uri) => {
                try {
                  const resolved = new URL(uri, baseUrl).toString();
                  return `URI="${reqUrl.origin}/?url=${encodeURIComponent(resolved)}"`;
                } catch {
                  return match;
                }
              });
            }
            return line;
          }

          // Es una URL de segmento o variante
          try {
            const resolved = new URL(trimmed, baseUrl).toString();
            return `${reqUrl.origin}/?url=${encodeURIComponent(resolved)}`;
          } catch {
            return line;
          }
        });

        const rewrittenContent = rewrittenLines.join('\n');
        responseHeaders.delete('content-length');

        return new Response(rewrittenContent, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        });
      }

      // 6. Otros contenidos (imágenes, subtítulos, etc.)
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: 'Proxy request failed',
          message: err.message,
          target: targetUrlParam,
        }),
        {
          status: 502,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }
  },
};
