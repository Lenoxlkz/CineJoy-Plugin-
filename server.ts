import express from 'express';
import { createServer as createViteServer } from 'vite';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import http from 'http';
import path from 'path';

const execFileAsync = promisify(execFile);
const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

const PLUGIN_DIR = path.resolve(process.cwd(), 'cinejoy-plugin');
const ALLOWED_SDK_FUNCS = new Set(['resolve', 'home', 'search', 'episodes', 'screen']);
const ALLOWED_DEVICES = new Set(['tv', 'phone']);
const ALLOWED_TABS = new Set(['trending', 'movies', 'series', 'action']);
const ALLOWED_TRIGGERS = new Set(['tap', 'change', 'submit']);

function combineOutput(stdout = '', stderr = ''): string {
  const out = stdout.trim();
  const err = stderr.trim();
  if (err && out) return `${err}\n\n${out}`;
  return out || err || '';
}

function resolveFixturePath(fixture: unknown): string | null {
  if (typeof fixture !== 'string' || !fixture.trim()) return null;
  const root = process.cwd();
  const resolved = path.resolve(root, fixture.trim());
  if (!resolved.startsWith(root + path.sep)) {
    throw new Error('Ruta de fixture no permitida.');
  }
  if (!fs.existsSync(resolved)) {
    throw new Error(`No se encontró el archivo fixture: ${fixture.trim()}`);
  }
  return fixture.trim();
}

// Endpoint to get plugin files
app.get('/api/plugin-files', (_req, res) => {
  try {
    const manifestPath = path.join(PLUGIN_DIR, 'kino-plugin.json');
    const codePath = path.join(PLUGIN_DIR, 'plugin.js');
    const exportPath = path.join(PLUGIN_DIR, 'kino-export.json');

    const manifest = fs.existsSync(manifestPath) ? fs.readFileSync(manifestPath, 'utf8') : '';
    const code = fs.existsSync(codePath) ? fs.readFileSync(codePath, 'utf8') : '';
    const exportData = fs.existsSync(exportPath) ? fs.readFileSync(exportPath, 'utf8') : '';

    res.json({
      manifest: manifest ? JSON.parse(manifest) : null,
      rawManifest: manifest,
      code,
      exportData: exportData ? JSON.parse(exportData) : null,
      rawExportData: exportData,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to update manifest or code
app.post('/api/save-file', (req, res) => {
  try {
    const { filename, content } = req.body;
    if (!['kino-plugin.json', 'plugin.js', 'kino-export.json'].includes(filename)) {
      return res.status(400).json({ error: 'Archivo no permitido' });
    }
    const targetPath = path.join(PLUGIN_DIR, filename);
    fs.writeFileSync(targetPath, content, 'utf8');

    // Also sync to public/plugin
    const publicTarget = path.resolve(process.cwd(), 'public/plugin', filename);
    fs.writeFileSync(publicTarget, content, 'utf8');

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to run sdk/validate.mjs
app.post('/api/validate', async (_req, res) => {
  try {
    const { stdout, stderr } = await execFileAsync('node', ['sdk/validate.mjs', 'cinejoy-plugin'], {
      timeout: 25000,
    });
    const combined = combineOutput(stdout, stderr);
    res.json({ success: true, output: combined, rawOutput: combined });
  } catch (err: any) {
    res.json({
      success: false,
      output: combineOutput(err.stdout, err.stderr) || err.message,
      error: err.message,
    });
  }
});

// Endpoint to run sdk/run.mjs
app.post('/api/run', async (req, res) => {
  const func = typeof req.body?.func === 'string' ? req.body.func.trim() : 'resolve';
  const arg = typeof req.body?.arg === 'string' ? req.body.arg.trim() : '';

  if (!ALLOWED_SDK_FUNCS.has(func)) {
    return res.status(400).json({
      success: false,
      command: `node sdk/run.mjs cinejoy-plugin ${func}`,
      output: `Función no permitida: ${func}`,
      error: 'Función no permitida',
    });
  }

  let safeFixture: string | null = null;
  try {
    safeFixture = resolveFixturePath(req.body?.fixture);
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      command: `node sdk/run.mjs cinejoy-plugin ${func}`,
      output: err.message,
      error: err.message,
    });
  }

  const args = ['sdk/run.mjs', 'cinejoy-plugin', func];
  if (arg && func !== 'home' && func !== 'screen') {
    args.push(arg);
  }

  const env = { ...process.env };
  if (safeFixture) {
    env.KINO_NUVIO_FIXTURE = safeFixture;
  } else {
    delete env.KINO_NUVIO_FIXTURE;
  }

  const displayCmd = `${safeFixture ? `KINO_NUVIO_FIXTURE=${safeFixture} ` : ''}node ${args.map(a => (a.includes(' ') ? `"${a}"` : a)).join(' ')}`;

  try {
    const { stdout, stderr } = await execFileAsync('node', args, { env, timeout: 25000 });
    res.json({
      success: true,
      command: displayCmd,
      output: combineOutput(stdout, stderr),
      stdout,
      stderr,
    });
  } catch (err: any) {
    res.json({
      success: false,
      command: displayCmd,
      output: combineOutput(err.stdout, err.stderr) || err.message,
      error: err.message,
    });
  }
});

// Endpoint to run node --test test/plugin.test.mjs
app.post('/api/test-offline', async (_req, res) => {
  try {
    const { stdout, stderr } = await execFileAsync('node', ['--test', 'test/plugin.test.mjs'], {
      timeout: 25000,
    });
    res.json({ success: true, output: combineOutput(stdout, stderr) });
  } catch (err: any) {
    res.json({
      success: false,
      output: combineOutput(err.stdout, err.stderr) || err.message,
      error: err.message,
    });
  }
});

// Screen tree preview endpoint
app.post('/api/screen-tree', async (req, res) => {
  try {
    const device = ALLOWED_DEVICES.has(req.body?.device) ? req.body.device : 'tv';
    const tab = ALLOWED_TABS.has(req.body?.tab) ? req.body.tab : 'trending';
    const args = [
      'sdk/run.mjs',
      '--device',
      device,
      '--state',
      JSON.stringify({ tab }),
      'cinejoy-plugin',
      'screen',
    ];
    const { stdout, stderr } = await execFileAsync('node', args, { timeout: 25000 });

    const jsonStart = stdout.indexOf('{');
    if (jsonStart !== -1) {
      const parsed = JSON.parse(stdout.slice(jsonStart));
      return res.json({ success: true, tree: parsed, logs: stderr || '' });
    }
    res.json({ success: false, raw: stdout, error: stderr || 'No se recibió árbol de pantalla válido.' });
  } catch (err: any) {
    res.json({
      success: false,
      error: combineOutput(err.stdout, err.stderr) || err.message,
    });
  }
});

// Screen event simulation endpoint
app.post('/api/screen-event', async (req, res) => {
  try {
    const name = typeof req.body?.name === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(req.body.name)
      ? req.body.name
      : 'changeTab';
    const arg = req.body?.arg === undefined || req.body?.arg === null ? '' : String(req.body.arg);
    const state = req.body?.state && typeof req.body.state === 'object' && !Array.isArray(req.body.state)
      ? req.body.state
      : {};
    const device = ALLOWED_DEVICES.has(req.body?.device) ? req.body.device : 'tv';
    const trigger = ALLOWED_TRIGGERS.has(req.body?.trigger) ? req.body.trigger : 'tap';

    const args = [
      'sdk/run.mjs',
      '--device',
      device,
      '--state',
      JSON.stringify(state),
    ];

    if (req.body?.context && typeof req.body.context === 'object' && !Array.isArray(req.body.context)) {
      args.push('--context', JSON.stringify(req.body.context));
    }

    args.push('cinejoy-plugin', 'screenEvent', name);
    if (arg !== '' || req.body?.value !== undefined) {
      args.push(arg);
    }
    if (req.body?.value !== undefined) {
      args.push(JSON.stringify(req.body.value));
    }
    args.push('--trigger', trigger);

    const { stdout, stderr } = await execFileAsync('node', args, { timeout: 25000 });

    const jsonStart = stdout.indexOf('{');
    if (jsonStart !== -1) {
      const parsed = JSON.parse(stdout.slice(jsonStart));
      return res.json({ success: true, answer: parsed, logs: stderr || '' });
    }
    res.json({ success: true, answer: {}, raw: stdout, logs: stderr || '' });
  } catch (err: any) {
    res.json({
      success: false,
      error: combineOutput(err.stdout, err.stderr) || err.message,
    });
  }
});

async function startServer() {
  const httpServer = http.createServer(app);
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      ws: { server: httpServer },
      hmr: false,
    },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`CineJoy & Nuvio workbench running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
