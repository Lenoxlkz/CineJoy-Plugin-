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
