import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, {
  buildProxyUrl,
  isLikelyM3u8Bytes,
  parsePngWrappedOffset,
  resolveUpstreamHeaders,
  rewriteM3u8,
  sniffMediaMagic,
  unwrapPngBuffer,
} from '../worker/hls-proxy-worker.js';

const WORKER_ORIGIN = 'https://cinejoyproxy.lenoxlkzsdy.workers.dev';

test('rewriteM3u8 rewrites disguised .jpg variant playlists and propagates ref', () => {
  const master = [
    '#EXTM3U',
    '#EXT-X-VERSION:7',
    '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="EN",URI="audio-en/playlist.m3u8"',
    '#EXT-X-STREAM-INF:BANDWIDTH=4692000,RESOLUTION=1920x1080',
    '1080p/playlist.jpg',
  ].join('\n');

  const out = rewriteM3u8(
    master,
    'https://nebula.bright67.online/hls/123/master.m3u8',
    WORKER_ORIGIN,
    'https://cinejoy.pk/'
  );

  assert.match(out, /URI="https:\/\/cinejoyproxy\.lenoxlkzsdy\.workers\.dev\/playlist\.m3u8\?url=https%3A%2F%2Fnebula\.bright67\.online%2Fhls%2F123%2Faudio-en%2Fplaylist\.m3u8&ref=https%3A%2F%2Fcinejoy\.pk%2F"/);
  assert.match(out, /^https:\/\/cinejoyproxy\.lenoxlkzsdy\.workers\.dev\/playlist\.m3u8\?url=https%3A%2F%2Fnebula\.bright67\.online%2Fhls%2F123%2F1080p%2Fplaylist\.jpg&ref=https%3A%2F%2Fcinejoy\.pk%2F$/m);
});

test('rewriteM3u8 rewrites EXT-X-MAP init.png and fMP4 segments as .mp4 and TS segments as .ts', () => {
  const fmp4Media = [
    '#EXTM3U',
    '#EXT-X-VERSION:7',
    '#EXT-X-MAP:URI="init.png"',
    '#EXTINF:4.0,',
    'seg-v0.png',
  ].join('\n');

  const outMp4 = rewriteM3u8(
    fmp4Media,
    'https://lightspeed.st/hls/abc/360p/playlist.m3u8',
    WORKER_ORIGIN,
    'https://cinejoy.pk/'
  );
  assert.match(outMp4, /#EXT-X-MAP:URI="https:\/\/[^"]+\/init\.mp4\?url=[^"]+init\.png&ref=https%3A%2F%2Fcinejoy\.pk%2F"/);
  assert.match(outMp4, /^https:\/\/[^"]+\/seg\.mp4\?url=[^"]+seg-v0\.png&ref=https%3A%2F%2Fcinejoy\.pk%2F$/m);

  const tsMedia = [
    '#EXTM3U',
    '#EXT-X-KEY:METHOD=AES-128,URI="enc.key"',
    '#EXTINF:4.0,',
    'part0.ts',
  ].join('\n');

  const outTs = rewriteM3u8(
    tsMedia,
    'https://vro265724.vrodaz.com/files/aa/index.m3u8',
    WORKER_ORIGIN,
    'https://cinejoy.pk/'
  );
  assert.match(outTs, /URI="https:\/\/[^"]+\/key\.bin\?url=[^"]+enc\.key/);
  assert.match(outTs, /^https:\/\/[^"]+\/seg\.ts\?url=[^"]+part0\.ts/m);
});

test('sniffMediaMagic detects #EXTM3U with BOM, fMP4 boxes, MPEG-TS, and fake PNG tsDa', () => {
  const m3u8Bom = new Uint8Array([0xef, 0xbb, 0xbf, ...Buffer.from('#EXTM3U\n#EXT-X-VERSION:3')]);
  assert.equal(isLikelyM3u8Bytes(m3u8Bom), true);
  assert.equal(sniffMediaMagic(m3u8Bom)?.kind, 'm3u8');

  const styp = new Uint8Array(32);
  styp.set([0, 0, 0, 24, 0x73, 0x74, 0x79, 0x70], 0); // styp
  assert.equal(sniffMediaMagic(styp)?.mime, 'video/mp4');

  const moof = new Uint8Array(32);
  moof.set([0, 0, 0x0e, 0x80, 0x6d, 0x6f, 0x6f, 0x66], 0); // moof
  assert.equal(sniffMediaMagic(moof)?.mime, 'video/mp4');

  const ts = new Uint8Array(376);
  ts[0] = 0x47;
  ts[188] = 0x47;
  assert.equal(sniffMediaMagic(ts)?.mime, 'video/mp2t');
});

test('PNG tsDa unwrapper extracts exact TS payload and strips IEND trailer', async () => {
  const tsPayload = new Uint8Array(376);
  tsPayload[0] = 0x47;
  tsPayload[1] = 0x40;
  tsPayload[188] = 0x47;
  tsPayload[189] = 0x11;

  // Build synthetic PNG matching Polaris (IHDR + IDAT + tsDa + IEND)
  const pngSig = Buffer.from('89504e470d0a1a0a', 'hex');
  const ihdr = Buffer.concat([Buffer.from('0000000d', 'hex'), Buffer.from('IHDR'), Buffer.alloc(13 + 4)]);
  const idat = Buffer.concat([Buffer.from('00000004', 'hex'), Buffer.from('IDAT'), Buffer.alloc(4 + 4)]);
  const tsLen = Buffer.alloc(4);
  tsLen.writeUInt32BE(tsPayload.length, 0);
  const tsCrc = Buffer.from('e5a78405', 'hex');
  const iend = Buffer.from('0000000049454e44ae426082', 'hex');
  const fakePng = Buffer.concat([pngSig, ihdr, idat, tsLen, Buffer.from('tsDa'), Buffer.from(tsPayload), tsCrc, iend]);

  const parsed = parsePngWrappedOffset(fakePng);
  assert.ok(parsed);
  assert.equal(parsed.mime, 'video/mp2t');
  assert.deepEqual(Buffer.from(unwrapPngBuffer(fakePng)), Buffer.from(tsPayload));

  // Verify streaming unwrap through worker.fetch across split chunks
  const origFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => {
      const stream = new ReadableStream({
        start(controller) {
          // Split across small chunks to test header skip & 16-byte tail buffer
          controller.enqueue(fakePng.subarray(0, 100));
          controller.enqueue(fakePng.subarray(100, 260));
          controller.enqueue(fakePng.subarray(260));
          controller.close();
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'image/png', 'Content-Length': String(fakePng.length) },
      });
    };

    const req = new Request(buildProxyUrl(WORKER_ORIGIN, 'https://p16-oec-general-useast5.ttcdn-us.com/seg', 'seg', 'https://cinejoy.pk/'));
    const res = await worker.fetch(req);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'video/mp2t');
    assert.equal(res.headers.get('content-length'), null);
    const outBytes = Buffer.from(await res.arrayBuffer());
    assert.deepEqual(outBytes, Buffer.from(tsPayload));
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('resolveUpstreamHeaders forwards explicit ref or falls back to cinejoy.pk for known CDNs', () => {
  const h1 = resolveUpstreamHeaders(new URL('https://lightspeed.st/hls/a/master.m3u8'), '', '', 'bytes=0-100');
  assert.equal(h1.get('Referer'), 'https://cinejoy.pk/');
  assert.equal(h1.get('Origin'), 'https://cinejoy.pk');
  assert.equal(h1.get('Range'), 'bytes=0-100');

  const h2 = resolveUpstreamHeaders(new URL('https://vro265724.vrodaz.com/a.m3u8'), 'https://cinejoy.pk/', '', null);
  assert.equal(h2.get('Referer'), 'https://cinejoy.pk/');
  assert.equal(h2.get('Origin'), 'https://cinejoy.pk');
});
