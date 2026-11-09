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
  // Fake kino with plugins.call throwing provider_missing
  globalThis.kino = {
    plugins: {
      call: async () => {
        const err = new Error('Provider missing');
        err.code = 'provider_missing';
        throw err;
      }
    }
  };
  const res = await plugin.screenEvent({
    name: 'sendShare',
    value: { shareText: 'Prueba compartir' },
    installed: {}
  });
  assert.equal(res.go?.installPlugin?.repo, 'kinotvapp/kino-social');
  assert.ok(res.toast);
});
