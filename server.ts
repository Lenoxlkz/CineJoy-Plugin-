import express from 'express';
import { createServer as createViteServer } from 'vite';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);
const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

const PLUGIN_DIR = path.resolve(process.cwd(), 'cinejoy-plugin');

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
    const { stdout, stderr } = await execAsync('node sdk/validate.mjs cinejoy-plugin');
    res.json({ success: true, output: stdout || stderr, rawOutput: stdout });
  } catch (err: any) {
    res.json({ success: false, output: err.stdout || err.stderr || err.message, error: err.message });
  }
});

// Endpoint to run sdk/run.mjs
app.post('/api/run', async (req, res) => {
  try {
    const { func = 'resolve', arg = 'movie:550', fixture = 'fixtures/nuvio-test.json' } = req.body;
    const envPrefix = fixture ? `KINO_NUVIO_FIXTURE=${fixture} ` : '';
    const cmd = `${envPrefix}node sdk/run.mjs cinejoy-plugin ${func} ${arg}`;
    const { stdout, stderr } = await execAsync(cmd);
    res.json({ success: true, command: cmd, output: stdout || stderr });
  } catch (err: any) {
    res.json({
      success: false,
      command: req.body?.cmd || 'node sdk/run.mjs',
      output: err.stdout || err.stderr || err.message,
      error: err.message,
    });
  }
});

// Endpoint to run node --test test/plugin.test.mjs
app.post('/api/test-offline', async (_req, res) => {
  try {
    const { stdout, stderr } = await execAsync('node --test test/plugin.test.mjs');
    res.json({ success: true, output: stdout || stderr });
  } catch (err: any) {
    res.json({ success: false, output: err.stdout || err.stderr || err.message, error: err.message });
  }
});

// Git status endpoint
app.get('/api/git-status', async (_req, res) => {
  try {
    const { stdout: status } = await execAsync('cd cinejoy-plugin && git status -s');
    const { stdout: log } = await execAsync('cd cinejoy-plugin && git log -1 --pretty=format:"%h - %s (%ci)"');
    const { stdout: remote } = await execAsync('cd cinejoy-plugin && git remote -v');
    res.json({
      success: true,
      clean: status.trim().length === 0,
      status: status || 'Árbol limpio',
      lastCommit: log || 'Sin commits previos',
      remote: remote || 'https://github.com/Lenoxlkz/kino-plugin-cinejoy.git',
    });
  } catch (err: any) {
    res.json({ success: false, error: err.message });
  }
});

// Git push endpoint
app.post('/api/git-push', async (req, res) => {
  try {
    const { token, message = 'Update CineJoy plugin files' } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Debes proporcionar un GitHub Personal Access Token (PAT) con permisos de escritura (repo).' });
    }

    // Sync files from workspace cinejoy-plugin
    await execAsync('cd cinejoy-plugin && git add .');
    try {
      await execAsync(`cd cinejoy-plugin && git commit -m "${message.replace(/"/g, '\\"')}"`);
    } catch {
      // Nothing to commit is fine
    }

    const pushUrl = `https://${token.trim()}@github.com/Lenoxlkz/kino-plugin-cinejoy.git`;
    const { stdout, stderr } = await execAsync(`cd cinejoy-plugin && git push -u "${pushUrl}" main`);

    res.json({
      success: true,
      message: 'Archivos enviados exitosamente a GitHub (Lenoxlkz/kino-plugin-cinejoy)!',
      output: (stdout || stderr || 'Push completado exitosamente').replace(new RegExp(token.trim(), 'g'), '***'),
    });
  } catch (err: any) {
    const cleanMsg = (err.stderr || err.message || '').replace(new RegExp(req.body?.token || '', 'g'), '***');
    res.status(500).json({ success: false, error: cleanMsg });
  }
});

// Screen tree preview endpoint
app.post('/api/screen-tree', async (req, res) => {
  try {
    const { device = 'tv', tab = 'trending' } = req.body;
    const cmd = `node sdk/run.mjs --device ${device} --state '{"tab":"${tab}"}' cinejoy-plugin screen`;
    const { stdout } = await execAsync(cmd);

    // Extract JSON starting at first {
    const jsonStart = stdout.indexOf('{');
    if (jsonStart !== -1) {
      const jsonStr = stdout.slice(jsonStart);
      const parsed = JSON.parse(jsonStr);
      return res.json({ success: true, tree: parsed });
    }
    res.json({ success: false, raw: stdout });
  } catch (err: any) {
    res.json({ success: false, error: err.message });
  }
});

// Screen event simulation endpoint
app.post('/api/screen-event', async (req, res) => {
  try {
    const { name = 'changeTab', arg = 'trending', state = {} } = req.body;
    const stateStr = JSON.stringify(state);
    const cmd = `node sdk/run.mjs --state '${stateStr}' cinejoy-plugin screenEvent ${name} ${arg}`;
    const { stdout } = await execAsync(cmd);

    const jsonStart = stdout.indexOf('{');
    if (jsonStart !== -1) {
      const parsed = JSON.parse(stdout.slice(jsonStart));
      return res.json({ success: true, answer: parsed });
    }
    res.json({ success: true, answer: {}, raw: stdout });
  } catch (err: any) {
    res.json({ success: false, error: err.message });
  }
});

async function startServer() {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CineJoy & Nuvio workbench running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
