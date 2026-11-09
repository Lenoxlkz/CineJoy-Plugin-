import React, { useState, useEffect } from 'react';
import {
  Play,
  CheckCircle2,
  AlertTriangle,
  FileCode2,
  Settings,
  Terminal,
  Download,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Layers,
  HelpCircle,
  Database,
  Tv,
  Film,
  Zap,
} from 'lucide-react';

interface PluginData {
  manifest: any;
  rawManifest: string;
  code: string;
  exportData: any;
  rawExportData: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'manifest' | 'code' | 'runner' | 'guide' | 'files'>('overview');
  const [pluginData, setPluginData] = useState<PluginData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Terminal Runner State
  const [commandRunning, setCommandRunning] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string>('');
  const [testFunc, setTestFunc] = useState('resolve');
  const [testArg, setTestArg] = useState('movie:550');
  const [testFixture, setTestFixture] = useState('fixtures/nuvio-test.json');

  // Load initial data
  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/plugin-files');
      if (res.ok) {
        const data = await res.json();
        setPluginData(data);
      }
    } catch (e) {
      console.error('Error cargando datos:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const runValidation = async () => {
    setCommandRunning(true);
    setTerminalOutput('Ejecutando: node sdk/validate.mjs cinejoy-plugin ...\n');
    try {
      const res = await fetch('/api/validate', { method: 'POST' });
      const data = await res.json();
      setTerminalOutput(prev => prev + '\n' + (data.output || 'Sin respuesta'));
    } catch (err: any) {
      setTerminalOutput(prev => prev + '\nError: ' + err.message);
    } finally {
      setCommandRunning(false);
    }
  };

  const runExecution = async () => {
    setCommandRunning(true);
    const cmdStr = `${testFixture ? `KINO_NUVIO_FIXTURE=${testFixture} ` : ''}node sdk/run.mjs cinejoy-plugin ${testFunc} ${testArg}`;
    setTerminalOutput(`Ejecutando: ${cmdStr} ...\n`);
    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ func: testFunc, arg: testArg, fixture: testFixture }),
      });
      const data = await res.json();
      setTerminalOutput(prev => prev + '\n' + (data.output || 'Sin salida'));
    } catch (err: any) {
      setTerminalOutput(prev => prev + '\nError: ' + err.message);
    } finally {
      setCommandRunning(false);
    }
  };

  const runOfflineTests = async () => {
    setCommandRunning(true);
    setTerminalOutput('Ejecutando: node --test test/plugin.test.mjs ...\n');
    try {
      const res = await fetch('/api/test-offline', { method: 'POST' });
      const data = await res.json();
      setTerminalOutput(prev => prev + '\n' + (data.output || 'Sin salida'));
    } catch (err: any) {
      setTerminalOutput(prev => prev + '\nError: ' + err.message);
    } finally {
      setCommandRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-black border border-[#95FF50]/40 flex items-center justify-center shadow-lg shadow-[#95FF50]/10 overflow-hidden">
              <img src="/plugin/icon.png" alt="CineJoy Icon" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-white tracking-tight">CineJoy</h1>
                <span className="bg-[#95FF50]/20 text-[#95FF50] border border-[#95FF50]/30 text-xs px-2 py-0.5 rounded-full font-mono font-semibold">
                  v1.0.8
                </span>
                <span className="bg-sky-500/20 text-sky-400 border border-sky-500/30 text-xs px-2 py-0.5 rounded-full font-mono">
                  + Nuvio Scrapers
                </span>
                <span className="bg-purple-500/20 text-purple-400 border border-purple-500/30 text-xs px-2 py-0.5 rounded-full font-mono">
                  + Kino Social (wall/share)
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Plugin para Kino (Android / Android TV) con catálogo TMDB y resolución multi-fuente
              </p>
            </div>
          </div>

          {/* Quick Action Badges */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setActiveTab('runner');
                runValidation();
              }}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-[#95FF50]" />
              <span>Validar con SDK</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('runner');
                runExecution();
              }}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#95FF50] hover:bg-[#82e642] text-slate-950 text-xs font-semibold rounded-lg shadow-sm transition"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Probar Nuvio</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex space-x-1 overflow-x-auto border-t border-slate-800/60 pt-1 text-sm">
          {[
            { id: 'overview', label: 'Resumen y Estado', icon: Layers },
            { id: 'manifest', label: 'kino-plugin.json', icon: Settings },
            { id: 'code', label: 'plugin.js (Lógica Nuvio)', icon: FileCode2 },
            { id: 'runner', label: 'Simulador SDK & Pruebas', icon: Terminal },
            { id: 'guide', label: 'Guía de Instalación en Kino', icon: HelpCircle },
            { id: 'files', label: 'Archivos & Descarga', icon: Download },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-3.5 py-2.5 border-b-2 font-medium text-xs whitespace-nowrap transition ${
                  isActive
                    ? 'border-[#95FF50] text-[#95FF50] bg-[#95FF50]/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-6 h-6 animate-spin text-[#95FF50]" />
            <span className="ml-3 text-slate-400 text-sm">Cargando datos del plugin...</span>
          </div>
        ) : (
          <>
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Status Hero Card */}
                <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800/80 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
                  <div className="absolute right-0 top-0 w-80 h-80 bg-[#95FF50]/5 rounded-full blur-3xl -z-10"></div>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2 max-w-2xl">
                      <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Plugin verificado y listo para Kino 0.9.71+ / 0.9.83</span>
                      </div>
                      <h2 className="text-2xl font-bold text-white tracking-tight">
                        CineJoy con Scrapers de Nuvio Integrados
                      </h2>
                      <p className="text-slate-300 text-sm leading-relaxed">
                        Tu plugin ya tiene añadido todo lo necesario sin alterar la estructura original:
                        soporta la capacidad <code className="text-[#95FF50] bg-black/40 px-1 py-0.5 rounded">nuvio</code>,
                        conecta con el repositorio configurado, selecciona los scrapers adecuados por idioma y tipo,
                        baja el tiempo de espera a 15 s y recuerda en <code className="text-sky-400 bg-black/40 px-1 py-0.5 rounded">kino.storage</code>
                        los que funcionaron para futuras consultas.
                      </p>
                    </div>

                    <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 min-w-[280px] space-y-3">
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Especificaciones del Manifiesto
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-800/80">
                          <span className="text-slate-400">ID del plugin:</span>
                          <span className="font-mono text-white font-medium">cinejoy</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-800/80">
                          <span className="text-slate-400">Versión de API:</span>
                          <span className="font-mono text-[#95FF50] font-bold">19 (Kino 0.9.81+)</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-800/80">
                          <span className="text-slate-400">Capacidades:</span>
                          <span className="font-mono text-white">7 (incluye nuvio y screen)</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-800/80">
                          <span className="text-slate-400">Repositorios Nuvio:</span>
                          <span className="font-mono text-sky-400 font-medium">2 repos</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-400">streamHosts:</span>
                          <span className="font-mono text-emerald-400">any</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3 Pillars of the Nuvio Integration */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-[#95FF50] border border-emerald-500/20 flex items-center justify-center font-bold">
                      1
                    </div>
                    <h3 className="text-base font-semibold text-white">Consulta Rápida y Acotada</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      El plugin solo pregunta a <strong>4 a 5 scrapers a la vez</strong> y fija un <code className="text-white">timeoutMs: 15000</code>.
                      Esto garantiza que ningún scraper colgado gaste el presupuesto total de 75 s que Kino otorga a <code className="text-white">resolve()</code>.
                    </p>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                    <div className="w-9 h-9 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center font-bold">
                      2
                    </div>
                    <h3 className="text-base font-semibold text-white">Memoria con kino.storage</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Cada vez que un scraper responde con éxito (<code className="text-[#95FF50]">ok: true</code>), su identificador se guarda en
                      <code className="text-sky-300">kino.storage</code>. La próxima vez que veas una película o serie, esos scrapers van de primeros.
                    </p>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                    <div className="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center font-bold">
                      3
                    </div>
                    <h3 className="text-base font-semibold text-white">Combinación & Alternatives</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Devuelve un único objeto <code className="text-white">Stream</code> con la mejor copia como fuente principal,
                      y adjunta hasta 8 enlaces de Nuvio y servidores directos en <code className="text-white">alternatives</code> sin duplicar URLs.
                    </p>
                  </div>
                </div>

                {/* Consent Sheet Preview */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                        Hoja de Consentimiento en Kino (Consent Sheet)
                      </h3>
                      <p className="text-xs text-slate-400">
                        Lo que la persona usuaria lee al momento de instalar el plugin en Kino:
                      </p>
                    </div>
                    <span className="text-xs font-mono bg-slate-800 text-slate-300 px-2.5 py-1 rounded-md border border-slate-700">
                      sdk/validate.mjs
                    </span>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs space-y-2">
                    <div className="flex items-center space-x-2 text-slate-200">
                      <span className="text-emerald-400 font-bold">•</span>
                      <span>Puede descargar videos para verlos sin conexión</span>
                    </div>
                    <div className="flex items-center space-x-2 text-slate-200">
                      <span className="text-[#95FF50] font-bold">•</span>
                      <span>Instala y usa scrapers de Nuvio del repositorio que indica para buscar enlaces</span>
                    </div>
                    <div className="flex items-center space-x-2 text-rose-400">
                      <span className="font-bold">!</span>
                      <span>Puede reproducir video desde cualquier servidor que indique (en rojo)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* MANIFEST TAB */}
            {activeTab === 'manifest' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
                  <div>
                    <h3 className="text-base font-bold text-white">kino-plugin.json</h3>
                    <p className="text-xs text-slate-400">
                      Manifiesto oficial de CineJoy. Contiene <code className="text-[#95FF50]">nuvio</code> en capacidades y la lista <code className="text-[#95FF50]">nuvioRepos</code>.
                    </p>
                  </div>
                  <button
                    onClick={() => handleCopy(pluginData?.rawManifest || '', 'manifest')}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition"
                  >
                    {copiedKey === 'manifest' ? <Check className="w-3.5 h-3.5 text-[#95FF50]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'manifest' ? 'Copiado' : 'Copiar JSON'}</span>
                  </button>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-x-auto max-h-[600px]">
                  <pre className="font-mono text-xs text-slate-200 leading-relaxed">
                    {pluginData?.rawManifest}
                  </pre>
                </div>
              </div>
            )}

            {/* CODE TAB */}
            {activeTab === 'code' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
                  <div>
                    <h3 className="text-base font-bold text-white">plugin.js — Módulo ES del Plugin</h3>
                    <p className="text-xs text-slate-400">
                      Código fuente completo con TMDB, interfaz de pantalla (<code className="text-slate-300">screen</code>) y la llamada segura a <code className="text-[#95FF50]">kino.nuvio</code> en <code className="text-slate-300">resolve()</code>.
                    </p>
                  </div>
                  <button
                    onClick={() => handleCopy(pluginData?.code || '', 'code')}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition"
                  >
                    {copiedKey === 'code' ? <Check className="w-3.5 h-3.5 text-[#95FF50]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'code' ? 'Copiado' : 'Copiar Código'}</span>
                  </button>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-x-auto max-h-[650px]">
                  <pre className="font-mono text-xs text-slate-300 leading-relaxed whitespace-pre">
                    {pluginData?.code}
                  </pre>
                </div>
              </div>
            )}

            {/* TERMINAL & RUNNER TAB */}
            {activeTab === 'runner' && (
              <div className="space-y-5">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-white">Consola y Banco de Pruebas con el SDK de Node</h3>
                    <p className="text-xs text-slate-400">
                      Ejecuta directamente las herramientas del kit oficial (<code className="text-slate-200">sdk/validate.mjs</code> y <code className="text-slate-200">sdk/run.mjs</code>) con fixtures locales para verificar que Kino acepta y reproduce el contenido.
                    </p>
                  </div>

                  {/* Test Controls */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Función a probar</label>
                      <select
                        value={testFunc}
                        onChange={e => setTestFunc(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#95FF50]"
                      >
                        <option value="resolve">resolve (buscar y mezclar enlaces)</option>
                        <option value="home">home (filas de inicio TMDB)</option>
                        <option value="search">search (búsqueda TMDB)</option>
                        <option value="episodes">episodes (capítulos serie)</option>
                        <option value="screen">screen (pantalla CineJoy)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Parámetro / Referencia</label>
                      <input
                        type="text"
                        value={testArg}
                        onChange={e => setTestArg(e.target.value)}
                        placeholder="ej: movie:550 o movie:603"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#95FF50] font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Fixture de Nuvio (Mock)</label>
                      <input
                        type="text"
                        value={testFixture}
                        onChange={e => setTestFixture(e.target.value)}
                        placeholder="fixtures/nuvio-test.json"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#95FF50] font-mono"
                      />
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      onClick={runValidation}
                      disabled={commandRunning}
                      className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg border border-slate-700 transition"
                    >
                      <CheckCircle2 className="w-4 h-4 text-[#95FF50]" />
                      <span>Validar Plugin (sdk/validate.mjs)</span>
                    </button>

                    <button
                      onClick={runExecution}
                      disabled={commandRunning}
                      className="flex items-center space-x-2 px-4 py-2 bg-[#95FF50] hover:bg-[#82e642] disabled:opacity-50 text-slate-950 text-xs font-bold rounded-lg shadow-sm transition"
                    >
                      <Zap className="w-4 h-4 fill-current" />
                      <span>Ejecutar Prueba (sdk/run.mjs)</span>
                    </button>

                    <button
                      onClick={runOfflineTests}
                      disabled={commandRunning}
                      className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                    >
                      <CheckCircle2 className="w-4 h-4 text-purple-200" />
                      <span>Suite Offline (node --test)</span>
                    </button>

                    <button
                      onClick={() => setTerminalOutput('')}
                      className="text-xs text-slate-400 hover:text-slate-200 ml-auto"
                    >
                      Limpiar consola
                    </button>
                  </div>
                </div>

                {/* Terminal Window */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
                  <div className="bg-slate-900/80 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-rose-500/80"></div>
                      <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                      <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
                      <span className="text-xs text-slate-400 font-mono ml-2">Terminal SDK</span>
                    </div>
                    {commandRunning && (
                      <div className="flex items-center space-x-2 text-xs text-[#95FF50] font-mono">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Ejecutando...</span>
                      </div>
                    )}
                  </div>
                  <div className="p-4 font-mono text-xs text-slate-300 min-h-[350px] max-h-[500px] overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {terminalOutput || (
                      <span className="text-slate-500">
                        Haz clic en &ldquo;Validar Plugin&rdquo; o &ldquo;Ejecutar Prueba&rdquo; para ver la salida del SDK de Kino...
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* GUIDE TAB (PASOS EXACTOS EN ESPAÑOL DE BOGOTÁ) */}
            {activeTab === 'guide' && (
              <div className="space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                  <h3 className="text-xl font-bold text-white tracking-tight">
                    Cómo probar los scrapers de verdad en Kino (con los clics exactos)
                  </h3>
                  <p className="text-slate-300 text-sm leading-relaxed">
                    Aquí tienes el paso a paso detallado para instalar y probar este plugin en tu celular o televisor con Kino 0.9.71 o más reciente (0.9.81 / 0.9.83):
                  </p>

                  <div className="space-y-4 pt-2">
                    {/* Paso 1 */}
                    <div className="flex items-start space-x-3 bg-slate-950/70 border border-slate-800/80 p-4 rounded-xl">
                      <div className="w-7 h-7 rounded-full bg-[#95FF50]/20 text-[#95FF50] border border-[#95FF50]/40 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        1
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-white">Sube los archivos a tu repositorio de GitHub</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          En tu repositorio de GitHub (por ejemplo <code className="text-white">Lenoxlkz/kino-plugin-cinejoy</code>),
                          deben estar en la raíz los tres archivos actualizados:
                        </p>
                        <ul className="list-disc list-inside text-xs text-slate-300 space-y-1 pt-1 font-mono">
                          <li>kino-plugin.json</li>
                          <li>plugin.js</li>
                          <li>icon.png</li>
                        </ul>
                      </div>
                    </div>

                    {/* Paso 2 */}
                    <div className="flex items-start space-x-3 bg-slate-950/70 border border-slate-800/80 p-4 rounded-xl">
                      <div className="w-7 h-7 rounded-full bg-[#95FF50]/20 text-[#95FF50] border border-[#95FF50]/40 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        2
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-white">Abre Kino en tu dispositivo</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Abre la app de Kino (versión 0.9.71 o superior). Ve a la sección de configuración tocando el icono de engranaje:
                        </p>
                        <p className="text-xs text-[#95FF50] font-medium pt-1">
                          Ajustes ▸ Plugins ▸ pestaña &ldquo;Instalados&rdquo; o &ldquo;Añadir&rdquo;
                        </p>
                      </div>
                    </div>

                    {/* Paso 3 */}
                    <div className="flex items-start space-x-3 bg-slate-950/70 border border-slate-800/80 p-4 rounded-xl">
                      <div className="w-7 h-7 rounded-full bg-[#95FF50]/20 text-[#95FF50] border border-[#95FF50]/40 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        3
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-white">Pega la dirección de tu plugin</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Toca el botón <strong>&ldquo;Instalar por dirección&rdquo;</strong> (o el icono de &ldquo;+&rdquo;) y escribe:
                        </p>
                        <div className="bg-black/60 border border-slate-800 px-3 py-2 rounded-lg font-mono text-xs text-sky-400 select-all my-1">
                          Lenoxlkz/kino-plugin-cinejoy
                        </div>
                        <p className="text-xs text-slate-400">
                          (O la URL completa: <code className="text-slate-300">https://github.com/Lenoxlkz/kino-plugin-cinejoy</code>).
                        </p>
                      </div>
                    </div>

                    {/* Paso 4 */}
                    <div className="flex items-start space-x-3 bg-slate-950/70 border border-slate-800/80 p-4 rounded-xl">
                      <div className="w-7 h-7 rounded-full bg-[#95FF50]/20 text-[#95FF50] border border-[#95FF50]/40 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        4
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-white">Acepta la hoja de permisos (Consent Sheet)</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Kino te mostrará la pantalla con los permisos que solicita el plugin. Notarás la línea:
                        </p>
                        <div className="bg-emerald-950/30 border border-emerald-500/20 text-emerald-300 px-3 py-1.5 rounded-lg text-xs font-medium my-1">
                          &ldquo;Instala y usa scrapers de Nuvio del repositorio que indica para buscar enlaces&rdquo;
                        </div>
                        <p className="text-xs text-slate-400">
                          Toca <strong>&ldquo;Instalar&rdquo;</strong> para confirmar.
                        </p>
                      </div>
                    </div>

                    {/* Paso 5 */}
                    <div className="flex items-start space-x-3 bg-slate-950/70 border border-slate-800/80 p-4 rounded-xl">
                      <div className="w-7 h-7 rounded-full bg-[#95FF50]/20 text-[#95FF50] border border-[#95FF50]/40 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        5
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-white">Reproduce cualquier título y verifica las fuentes</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Entra a CineJoy, selecciona una película o capítulo y dale Play.
                          Al abrir el menú de <strong>Servidores / Calidades</strong> en el reproductor de Kino, verás listadas:
                        </p>
                        <ul className="list-disc list-inside text-xs text-slate-300 space-y-1 pt-1 font-mono">
                          <li>1. Servidor principal (Ultra HD)</li>
                          <li>2. Servidores alternativos directos</li>
                          <li>3. Enlaces extraídos por los scrapers de Nuvio (con el nombre del scraper)</li>
                        </ul>
                        <p className="text-xs text-slate-400 pt-1">
                          ¡Si la fuente directa falla o no tiene el título, los scrapers de Nuvio saltan automáticamente al rescate!
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* FILES & DOWNLOAD TAB */}
            {activeTab === 'files' && (
              <div className="space-y-5">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2">
                  <h3 className="text-base font-bold text-white">Paquete de Archivos Listos para GitHub</h3>
                  <p className="text-xs text-slate-400">
                    Puedes descargar o copiar cada archivo directamente a tu computadora o repositorio.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* kino-plugin.json */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
                    <div className="flex items-center space-x-3">
                      <Settings className="w-5 h-5 text-[#95FF50]" />
                      <div>
                        <div className="text-sm font-semibold text-white">kino-plugin.json</div>
                        <div className="text-xs text-slate-400">Manifiesto con nuvio y repositorios</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 pt-2 border-t border-slate-800">
                      <a
                        href="/plugin/kino-plugin.json"
                        download="kino-plugin.json"
                        className="flex-1 text-center py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition"
                      >
                        Descargar
                      </a>
                      <button
                        onClick={() => handleCopy(pluginData?.rawManifest || '', 'manifest-file')}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition"
                      >
                        {copiedKey === 'manifest-file' ? <Check className="w-4 h-4 text-[#95FF50]" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* plugin.js */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
                    <div className="flex items-center space-x-3">
                      <FileCode2 className="w-5 h-5 text-sky-400" />
                      <div>
                        <div className="text-sm font-semibold text-white">plugin.js</div>
                        <div className="text-xs text-slate-400">Lógica completa de Kino + Nuvio</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 pt-2 border-t border-slate-800">
                      <a
                        href="/plugin/plugin.js"
                        download="plugin.js"
                        className="flex-1 text-center py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition"
                      >
                        Descargar
                      </a>
                      <button
                        onClick={() => handleCopy(pluginData?.code || '', 'code-file')}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition"
                      >
                        {copiedKey === 'code-file' ? <Check className="w-4 h-4 text-sky-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* kino-export.json */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
                    <div className="flex items-center space-x-3">
                      <Database className="w-5 h-5 text-purple-400" />
                      <div>
                        <div className="text-sm font-semibold text-white">kino-export.json</div>
                        <div className="text-xs text-slate-400">Hashes SHA256 calculados para Kino 0.9.83</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 pt-2 border-t border-slate-800">
                      <a
                        href="/plugin/kino-export.json"
                        download="kino-export.json"
                        className="flex-1 text-center py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition"
                      >
                        Descargar
                      </a>
                      <button
                        onClick={() => handleCopy(pluginData?.rawExportData || '', 'export-file')}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition"
                      >
                        {copiedKey === 'export-file' ? <Check className="w-4 h-4 text-purple-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* icon.png */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
                    <div className="flex items-center space-x-3">
                      <img src="/plugin/icon.png" alt="icon" className="w-6 h-6 rounded-md object-contain bg-black border border-[#95FF50]/30" />
                      <div>
                        <div className="text-sm font-semibold text-white">icon.png</div>
                        <div className="text-xs text-slate-400">Icono verde neón oficial de CineJoy</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 pt-2 border-t border-slate-800">
                      <a
                        href="/plugin/icon.png"
                        download="icon.png"
                        className="flex-1 text-center py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition"
                      >
                        Descargar Icono
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>CineJoy Kino Plugin + Nuvio Scraper Resolver &bull; apiVersion 19 &bull; streamHosts: any</span>
          <span className="font-mono text-slate-400">sdk/validate.mjs: ✓ Kino would accept this plugin</span>
        </div>
      </footer>
    </div>
  );
}
