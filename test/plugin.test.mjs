// Offline test for CineJoy + Nuvio plugin
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from '../sdk/validate.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'cinejoy-plugin');
const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures.json');

test('Kino accepts the manifest and the exports', async () => {
  const r = await validate(root);
  assert.deepEqual(r.problems, [], `Validation problems: ${r.problems.join(', ')}`);
});

test('search answers offline from recorded fixtures, and Kino drops nothing', { skip: !existsSync(fixtures) && 'record test/fixtures.json first' }, async () => {
  const r = await validate(root, { run: 'search', args: ['Matrix'], replay: fixtures });
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.drops, []);
});

test('manifest adheres to Kino and Nuvio specifications', () => {
  const manifest = JSON.parse(readFileSync(join(root, 'kino-plugin.json'), 'utf8'));
  assert.equal(manifest.id, 'cinejoy');
  assert.equal(manifest.apiVersion, 20);
  assert.ok(manifest.capabilities.includes('nuvio'), 'Must declare nuvio capability');
  assert.ok(manifest.capabilities.includes('screen'), 'Must declare screen capability');
  assert.ok(manifest.capabilities.includes('download'), 'Must declare download capability');
  assert.equal(manifest.streamHosts, 'any');
  assert.ok(manifest.hosts.includes('api2.wing.st'), 'Must declare api2.wing.st host');
  assert.ok(manifest.hosts.includes('cinejoyproxy.lenoxlkzsdy.workers.dev'), 'Must declare proxy host');
  assert.ok(Array.isArray(manifest.nuvioRepos) && manifest.nuvioRepos.length >= 1, 'Must have nuvioRepos');
  assert.ok(manifest.recommends.includes('kinotvapp/kino-social'), 'Must recommend kino-social');
  assert.ok(manifest.consumes?.social?.calls?.includes('share'), 'Must consume social.share');
});

test('screen returns valid scaffold with compact merge bar and share action', async () => {
  const plugin = await import(join(root, 'plugin.js'));
  const sc = await plugin.screen({});
  assert.equal(sc.type, 'scaffold');
  assert.equal(sc.appBar.mergeWithKinoBar, true);
  assert.equal(sc.appBar.dense, true);
  assert.equal(sc.appBar.leading?.onTap?.go?.close, true);
  assert.ok(Array.isArray(sc.appBar.actions) && sc.appBar.actions.length > 0);
  assert.equal(sc.appBar.actions[0].onTap?.event, 'openShare');
});

test('screenEvent handles openShare and returns popup open UI', async () => {
  const plugin = await import(join(root, 'plugin.js'));
  const res = await plugin.screenEvent({ name: 'openShare' });
  assert.ok(res.ui && res.ui.some(u => u.open === 'shareSheet'));
  assert.ok(res.state?.share);
});

test('screenEvent handles sendShare and handles provider_missing cleanly', async () => {
  const plugin = await import(join(root, 'plugin.js'));
  const prevKino = globalThis.kino;
  globalThis.kino = {
    plugins: {
      call: async () => {
        const err = new Error('Provider missing');
        err.code = 'provider_missing';
        throw err;
      }
    }
  };
  try {
    const res = await plugin.screenEvent({
      name: 'sendShare',
      value: { shareText: 'Prueba compartir' },
      installed: {}
    });
    assert.equal(res.go?.installPlugin?.repo, 'kinotvapp/kino-social');
    assert.ok(res.toast);
  } finally {
    globalThis.kino = prevKino;
  }
});

test('resolve queries all servers including Nebula, proxies Polaris/Paris via Worker, and sends Light/Sirius/Nebula directly with Origin+Referer', async () => {
  const plugin = await import(join(root, 'plugin.js'));
  const prevKino = globalThis.kino;
  const crypto = await import('node:crypto');

  const capturedPaths = [];
  let savedEphPub = null;
  let savedResKey = null;

  globalThis.kino = {
    lang: 'es-MX',
    settings: { hls_proxy: true, server: 'auto', lang: 'es' },
    sleep: async () => {},
    log: () => {},
    error: (code, msg, extra) => Object.assign(new Error(msg), { code, ...extra }),
    crypto: {
      importKey: ({ key }) => ({ raw: key }),
      generateKeyPair: () => {
        const ephPub = Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 0x11)]).toString('base64');
        return { privateKey: { handle: 'test' }, publicKey: { raw: ephPub } };
      },
      deriveSharedSecret: () => Buffer.alloc(32, 0x22).toString('hex'),
      hmac: (_alg, key, data, p) => {
        const kBuf = Buffer.from(key, p.keyEncoding || 'utf8');
        const dBuf = Buffer.from(data, p.inputEncoding || 'utf8');
        return crypto.createHmac('sha256', kBuf).update(dBuf).digest(p.outputEncoding || 'hex');
      },
      randomBytes: (n, enc) => Buffer.alloc(n, 0x33).toString(enc),
      convert: (data, from, to) => Buffer.from(data, from).toString(to),
      encrypt: (_alg, p) => {
        const pt = JSON.parse(p.data);
        capturedPaths.push(pt.path);
        const ephPub = Buffer.from(p.aad, 'hex').subarray(-65);
        savedEphPub = ephPub;
        const shared = Buffer.alloc(32, 0x22);
        const prk = crypto.createHmac('sha256', ephPub).update(shared).digest();
        savedResKey = crypto.createHmac('sha256', prk).update(Buffer.concat([Buffer.from('lumen-gate-v2|s2c'), Buffer.from([1])])).digest();
        const c = crypto.createCipheriv('aes-256-gcm', Buffer.from(p.key, 'hex'), Buffer.from(p.iv, 'hex'));
        c.setAAD(Buffer.from(p.aad, 'hex'));
        return Buffer.concat([c.update(p.data, 'utf8'), c.final(), c.getAuthTag()]).toString('hex');
      },
      decrypt: (_alg, p) => {
        const buf = Buffer.from(p.data, 'hex');
        const d = crypto.createDecipheriv('aes-256-gcm', Buffer.from(p.key, 'hex'), Buffer.from(p.iv, 'hex'));
        d.setAAD(Buffer.from(p.aad, 'hex'));
        d.setAuthTag(buf.subarray(buf.length - 16));
        return Buffer.concat([d.update(buf.subarray(0, buf.length - 16)), d.final()]).toString('utf8');
      }
    },
    fetch: async (url) => {
      if (url.includes('api.themoviedb.org')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            title: 'Pelicula Prueba',
            original_title: 'Test Movie',
            release_date: '2025-01-01',
            external_ids: { imdb_id: 'tt1234567' }
          })
        };
      }
      if (url === 'https://api2.wing.st/servers') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            servers: [
              { name: 'Light', status: 'ok' },
              { name: 'Nebula', status: 'ok' },
              { name: 'Sirius', status: 'ok' },
              { name: 'Polaris', status: 'ok' },
              { name: 'Paris', status: 'ok' }
            ]
          })
        };
      }
      if (url === 'https://api2.wing.st/g') {
        const lastPath = capturedPaths[capturedPaths.length - 1];
        const map = {
          '/Polaris/movie': {
            data: {
              stream: [{
                type: 'hls',
                playlist: 'https://erebus.cursed.st/playlists/movie/550/1080p.m3u8?token=abc',
                captions: [{ type: 'vtt', id: 'es', url: 'https://erebus.cursed.st/subtitles/movie/550/spanish.vtt?token=abc' }]
              }]
            },
            status: 200
          },
          '/Paris/movie': {
            data: { stream: [{ type: 'hls', playlist: 'https://vro1.vrodaz.com/files/aa/index.m3u8' }] },
            status: 200
          },
          '/Light/movie': {
            data: {
              stream: [{
                type: 'hls',
                playlist: 'https://lightspeed.st/hls/test/master.m3u8',
                captions: [{ type: 'vtt', id: 'en', url: 'https://lightspeed.st/hls/test/en.vtt' }]
              }]
            },
            status: 200
          },
          '/Sirius/movie': {
            data: { stream: [{ type: 'hls', playlist: 'https://ru.ferb.st/897300.m3u8' }] },
            status: 200
          },
          '/Nebula/movie': {
            data: { stream: [{ type: 'hls', playlist: 'https://nebula.bright67.online/hls/test/master.m3u8' }] },
            status: 200
          }
        };
        const bodyObj = map[lastPath] || { data: { error: 'Not Found' }, status: 404 };
        const iv = Buffer.alloc(12, 0x44);
        const aad = Buffer.concat([Buffer.from('lumen-gate-v2'), Buffer.from([0, 2, 2]), savedEphPub]);
        const c = crypto.createCipheriv('aes-256-gcm', savedResKey, iv);
        c.setAAD(aad);
        const pt = Buffer.from(JSON.stringify(bodyObj), 'utf8');
        const resp = Buffer.concat([iv, c.update(pt), c.final(), c.getAuthTag()]);
        return {
          ok: true,
          status: 200,
          base64: async () => resp.toString('base64')
        };
      }
      return { ok: false, status: 404 };
    }
  };

  try {
    const out = await plugin.resolve('movie:550');
    for (const srv of ['Light', 'Sirius', 'Nebula', 'Paris']) {
      assert.ok(capturedPaths.includes(`/${srv}/movie`), `Missing fast query for ${srv}`);
    }
    assert.ok(!capturedPaths.includes('/Polaris/movie'), 'Polaris should be deferred as a lazy alternative when fast servers succeed');

    assert.equal(out.label, 'CineJoy · Light');
    assert.equal(out.url, 'https://lightspeed.st/hls/test/master.m3u8');
    assert.equal(out.headers.Origin, 'https://cinejoy.pk');
    assert.equal(out.headers.Referer, 'https://cinejoy.pk/');

    const siriusAlt = out.alternatives.find(a => a.label === 'CineJoy · Sirius');
    const nebulaAlt = out.alternatives.find(a => a.label === 'CineJoy · Nebula');
    const parisAlt = out.alternatives.find(a => a.label === 'CineJoy · Paris');
    const polarisLazy = out.alternatives.find(a => a.label === 'CineJoy · Polaris');
    assert.ok(siriusAlt && nebulaAlt && parisAlt && polarisLazy, 'Sirius, Nebula, Paris, and Polaris must all appear in alternatives');
    assert.equal(siriusAlt.url, 'https://ru.ferb.st/897300.m3u8');
    assert.equal(nebulaAlt.url, 'https://nebula.bright67.online/hls/test/master.m3u8');
    assert.match(parisAlt.url, /^https:\/\/cinejoyproxy\.lenoxlkzsdy\.workers\.dev\/playlist\.m3u8\?url=https%3A%2F%2Fvro1\.vrodaz\.com/);
    assert.equal(polarisLazy.ref, 'cinejoy-srv:Polaris:movie:550');

    assert.equal(out.subtitles.length, 1);
    assert.equal(out.subtitles[0].url, 'https://lightspeed.st/hls/test/en.vtt');

    capturedPaths.length = 0;
    const polarisOut = await plugin.resolve('cinejoy-srv:Polaris:movie:550');
    assert.deepEqual(capturedPaths, ['/Polaris/movie']);
    assert.equal(polarisOut.label, 'CineJoy · Polaris');
    assert.match(polarisOut.url, /^https:\/\/cinejoyproxy\.lenoxlkzsdy\.workers\.dev\/playlist\.m3u8\?url=https%3A%2F%2Ferebus\.cursed\.st/);
    assert.equal(polarisOut.subtitles.length, 1);
    assert.equal(polarisOut.subtitles[0].lang, 'es');
    assert.match(polarisOut.subtitles[0].url, /\/sub\.vtt\?url=https%3A%2F%2Ferebus\.cursed\.st/);
  } finally {
    globalThis.kino = prevKino;
  }
});


