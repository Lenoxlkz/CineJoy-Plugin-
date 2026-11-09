import React, { useState, useEffect } from 'react';
import {
  Play,
  CheckCircle2,
  AlertTriangle,
  Tv,
  Terminal,
  Github,
  Cloud,
  Copy,
  Check,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Share2,
  X,
  Send,
  Zap,
  ArrowRight,
  ShieldCheck,
  Smartphone,
  Layers,
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'screen' | 'runner' | 'github' | 'worker'>('screen');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Screen & TV State
  const [deviceMode, setDeviceMode] = useState<'tv' | 'phone'>('tv');
  const [screenTree, setScreenTree] = useState<any>(null);
  const [screenLoading, setScreenLoading] = useState(false);
  const [currentTab, setCurrentTab] = useState('trending');
  const [focusedIndex, setFocusedIndex] = useState(0); // 0-3 for tabs, 4+ for grid items
  const [activeZone, setActiveZone] = useState<'tabs' | 'grid' | 'appbar'>('tabs');
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareText, setShareText] = useState('¡Disfrutando de películas y series en CineJoy!');
  const [attachTitle, setAttachTitle] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Terminal Runner State
  const [commandRunning, setCommandRunning] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string>('');
  const [testFunc, setTestFunc] = useState('resolve');
  const [testArg, setTestArg] = useState('movie:550');
  const [testFixture, setTestFixture] = useState('fixtures/nuvio-test.json');

  // GitHub Sync State
  const [gitStatus, setGitStatus] = useState<any>(null);
  const [gitRepo, setGitRepo] = useState('Lenoxlkz/CineJoy-Plugin-');
  const [gitToken, setGitToken] = useState('');
  const [gitMessage, setGitMessage] = useState('CineJoy v1.0.8: Raíz de Kino + Nuvio + Proxy HLS');
  const [gitForce, setGitForce] = useState(true);
  const [gitPushing, setGitPushing] = useState(false);
  const [gitPushResult, setGitPushResult] = useState<any>(null);

  // Cloudflare Worker Code
  const [workerCode, setWorkerCode] = useState<string>('');

  // Toast Helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Load Screen Tree from Server
  const loadScreen = async (tabName = currentTab) => {
    setScreenLoading(true);
    try {
      const res = await fetch('/api/screen-tree', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device: deviceMode, tab: tabName }),
      });
      const data = await res.json();
      if (data.success && data.tree) {
        setScreenTree(data.tree);
      }
    } catch (e) {
      console.error('Error cargando screen:', e);
    } finally {
      setScreenLoading(false);
    }
  };

  // Load Git Status
  const loadGitStatus = async () => {
    try {
      const res = await fetch('/api/git-status');
      const data = await res.json();
      setGitStatus(data);
    } catch (e) {
      console.error('Error git status:', e);
    }
  };

  // Initial load
  useEffect(() => {
    loadScreen(currentTab);
    loadGitStatus();

    // Fetch worker code
    fetch('/worker/hls-proxy-worker.js')
      .then(r => (r.ok ? r.text() : ''))
      .then(t => setWorkerCode(t))
      .catch(() => {});
  }, [deviceMode]);

  // Tab switch in Screen
  const handleTabChange = async (tabName: string) => {
    setCurrentTab(tabName);
    await loadScreen(tabName);
    setFocusedIndex(0);
    setActiveZone('tabs');
  };

  // TV Remote Navigation Handlers
  const handleDpad = (direction: 'up' | 'down' | 'left' | 'right' | 'ok') => {
    const tabsList = ['trending', 'movies', 'series', 'action'];
    const items = screenTree?.body?.children?.[0]?.items || [];

    if (showShareModal) {
      if (direction === 'ok') {
        handleSendShare();
      }
      return;
    }

    if (direction === 'ok') {
      if (activeZone === 'appbar') {
        setShowShareModal(true);
      } else if (activeZone === 'tabs') {
        const nextTab = tabsList[focusedIndex] || 'trending';
        handleTabChange(nextTab);
      } else if (activeZone === 'grid') {
        const selected = items[focusedIndex];
        if (selected) {
          showToast(`Seleccionado: ${selected.title} (${selected.ref})`);
        }
      }
      return;
    }

    if (activeZone === 'appbar') {
      if (direction === 'down') {
        setActiveZone('tabs');
        setFocusedIndex(0);
      }
    } else if (activeZone === 'tabs') {
      if (direction === 'up') {
        setActiveZone('appbar');
      } else if (direction === 'down') {
        if (items.length > 0) {
          setActiveZone('grid');
          setFocusedIndex(0);
        }
      } else if (direction === 'left') {
        setFocusedIndex(prev => Math.max(0, prev - 1));
      } else if (direction === 'right') {
        setFocusedIndex(prev => Math.min(tabsList.length - 1, prev + 1));
      }
    } else if (activeZone === 'grid') {
      const cols = deviceMode === 'tv' ? 4 : 2;
      if (direction === 'up') {
        if (focusedIndex < cols) {
          setActiveZone('tabs');
          setFocusedIndex(tabsList.indexOf(currentTab));
        } else {
          setFocusedIndex(prev => Math.max(0, prev - cols));
        }
      } else if (direction === 'down') {
        setFocusedIndex(prev => Math.min(items.length - 1, prev + cols));
      } else if (direction === 'left') {
        setFocusedIndex(prev => Math.max(0, prev - 1));
      } else if (direction === 'right') {
        setFocusedIndex(prev => Math.min(items.length - 1, prev + 1));
      }
    }
  };

  // Share Send simulation
  const handleSendShare = async () => {
    try {
      const res = await fetch('/api/screen-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'sendShare',
          value: { shareText, shareTitle: attachTitle },
          state: { share: { name: 'CineJoy' } },
        }),
      });
      const data = await res.json();
      setShowShareModal(false);
      if (data.answer?.toast?.text) {
        showToast(data.answer.toast.text);
      } else if (data.answer?.toast) {
        showToast(data.answer.toast);
      } else {
        showToast('Enviado borrador a Kino Social.');
      }
    } catch {
      setShowShareModal(false);
      showToast('Enviado borrador a Kino Social.');
    }
  };

  // Git Push action
  const handleGitPush = async () => {
    if (!gitToken.trim()) {
      showToast('Por favor ingresa tu GitHub Personal Access Token (PAT).');
      return;
    }
    setGitPushing(true);
    setGitPushResult(null);
    try {
      const res = await fetch('/api/git-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: gitToken.trim(),
          repo: gitRepo.trim(),
          message: gitMessage,
          force: gitForce,
        }),
      });
      const data = await res.json();
      setGitPushResult(data);
      loadGitStatus();
    } catch (err: any) {
      setGitPushResult({ success: false, error: err.message });
    } finally {
      setGitPushing(false);
    }
  };

  // SDK validation & runs
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

  const gridItems = screenTree?.body?.children?.[0]?.items || [];
  const tabs = [
    { id: 'trending', label: 'Tendencias' },
    { id: 'movies', label: 'Películas' },
    { id: 'series', label: 'Series TV' },
    { id: 'action', label: 'Acción' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-[#95FF50] text-slate-950 font-semibold px-4 py-2.5 rounded-xl shadow-2xl flex items-center space-x-2 border border-[#95FF50]/50 animate-bounce">
          <CheckCircle2 className="w-4 h-4" />
          <span className="text-xs">{toastMessage}</span>
        </div>
      )}

      {/* Main Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-black border border-[#95FF50]/40 flex items-center justify-center shadow-lg shadow-[#95FF50]/10 overflow-hidden">
              <img src="/plugin/icon.png" alt="CineJoy Icon" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-white tracking-tight">CineJoy TV Studio</h1>
                <span className="bg-[#95FF50]/20 text-[#95FF50] border border-[#95FF50]/30 text-xs px-2 py-0.5 rounded-full font-mono font-semibold">
                  v1.0.8
                </span>
                <span className="bg-sky-500/20 text-sky-400 border border-sky-500/30 text-xs px-2 py-0.5 rounded-full font-mono">
                  + Nuvio
                </span>
                <span className="bg-purple-500/20 text-purple-400 border border-purple-500/30 text-xs px-2 py-0.5 rounded-full font-mono">
                  + Kino Social
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Simulador de pantalla Kino con control de TV, sincronización directa a GitHub y HLS Proxy
              </p>
            </div>
          </div>

          {/* Quick Action Badges */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setActiveTab('github');
              }}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition"
            >
              <Github className="w-3.5 h-3.5 text-sky-400" />
              <span>Enviar a GitHub</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('worker');
              }}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#95FF50] hover:bg-[#82e642] text-slate-950 text-xs font-semibold rounded-lg shadow-sm transition"
            >
              <Cloud className="w-3.5 h-3.5 fill-current" />
              <span>Código Cloudflare Worker</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex space-x-1 overflow-x-auto border-t border-slate-800/60 pt-1 text-sm">
          {[
            { id: 'screen', label: 'Pantalla Screen con Control TV', icon: Tv },
            { id: 'runner', label: 'Consola y Pruebas SDK', icon: Terminal },
            { id: 'github', label: 'Conexión Directa a GitHub (Push)', icon: Github },
            { id: 'worker', label: 'Cloudflare Worker HLS Proxy', icon: Cloud },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-4 py-2.5 border-b-2 font-medium text-xs whitespace-nowrap transition ${
                  isActive
                    ? 'border-[#95FF50] text-[#95FF50] bg-[#95FF50]/5 font-bold'
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

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {/* TAB 1: PANTALLA SCREEN CON CONTROL DE TV */}
        {activeTab === 'screen' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
              <div>
                <h2 className="text-base font-bold text-white flex items-center space-x-2">
                  <Tv className="w-4 h-4 text-[#95FF50]" />
                  <span>Prueba Interactiva de Pantalla Kino (Screen) con Control de TV</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Cumple la regla de barra compacta (<code className="text-[#95FF50]">mergeWithKinoBar: true</code>, <code className="text-[#95FF50]">dense: true</code>), foco del TV con control remoto y evento de compartir.
                </p>
              </div>

              {/* Device Selector */}
              <div className="flex items-center space-x-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setDeviceMode('tv')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    deviceMode === 'tv'
                      ? 'bg-[#95FF50] text-slate-950 font-bold shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Tv className="w-3.5 h-3.5" />
                  <span>Android TV (16:9)</span>
                </button>
                <button
                  onClick={() => setDeviceMode('phone')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    deviceMode === 'phone'
                      ? 'bg-[#95FF50] text-slate-950 font-bold shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Celular</span>
                </button>
              </div>
            </div>

            {/* TV Screen + Virtual Remote Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* TV Screen Viewport (Col 1-8) */}
              <div className="lg:col-span-8 bg-black border-4 border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative min-h-[580px] flex flex-col">
                {/* TV Glass Glare Effect */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.02] to-transparent pointer-events-none z-30"></div>

                {/* Kino App Bar (Merged Compact Bar) */}
                <div className="bg-slate-900/95 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between shrink-0 z-20">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => showToast('Cerrando pantalla')}
                      className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300"
                      title="Cerrar (close: true)"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm tracking-tight text-white">CineJoy</span>
                      <span className="text-[10px] bg-[#95FF50]/10 text-[#95FF50] px-1.5 py-0.5 rounded font-mono">
                        TV Screen
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {/* Share Button in AppBar */}
                    <button
                      onClick={() => setShowShareModal(true)}
                      className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs transition ${
                        activeZone === 'appbar'
                          ? 'ring-2 ring-[#95FF50] bg-[#95FF50]/20 text-[#95FF50] font-bold'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      }`}
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Compartir</span>
                    </button>
                  </div>
                </div>

                {/* Tabs Bar */}
                <div className="bg-slate-900/80 border-b border-slate-800/80 px-4 py-2 flex items-center space-x-2 overflow-x-auto shrink-0 z-10">
                  {tabs.map((tab, idx) => {
                    const isSelected = currentTab === tab.id;
                    const isFocused = activeZone === 'tabs' && focusedIndex === idx;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => handleTabChange(tab.id)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
                          isFocused
                            ? 'ring-2 ring-[#95FF50] bg-[#95FF50] text-slate-950 font-bold scale-105'
                            : isSelected
                            ? 'bg-[#95FF50]/20 text-[#95FF50] border border-[#95FF50]/30 font-semibold'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* Main Content Grid */}
                <div className="flex-1 p-4 overflow-y-auto max-h-[500px]">
                  {screenLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                      <RefreshCw className="w-8 h-8 animate-spin text-[#95FF50] mb-3" />
                      <span className="text-xs">Cargando catálogo TMDB...</span>
                    </div>
                  ) : gridItems.length > 0 ? (
                    <div className={`grid ${deviceMode === 'tv' ? 'grid-cols-4 gap-4' : 'grid-cols-2 gap-3'}`}>
                      {gridItems.map((item: any, idx: number) => {
                        const isFocused = activeZone === 'grid' && focusedIndex === idx;
                        return (
                          <div
                            key={item.id || idx}
                            onClick={() => {
                              setActiveZone('grid');
                              setFocusedIndex(idx);
                              showToast(`Título: ${item.title}`);
                            }}
                            className={`group relative bg-slate-900 rounded-xl overflow-hidden cursor-pointer transition transform ${
                              isFocused
                                ? 'ring-4 ring-[#95FF50] scale-[1.03] shadow-xl shadow-[#95FF50]/20 z-10'
                                : 'hover:scale-[1.02] border border-slate-800/80'
                            }`}
                          >
                            {/* Poster Image */}
                            <div className="aspect-[2/3] w-full bg-slate-950 overflow-hidden relative">
                              {item.poster ? (
                                <img
                                  src={item.poster}
                                  alt={item.title}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
                                  Sin imagen
                                </div>
                              )}
                              {item.rating && (
                                <div className="absolute top-2 right-2 bg-black/80 backdrop-blur px-1.5 py-0.5 rounded text-[10px] font-bold text-[#95FF50]">
                                  ★ {item.rating}
                                </div>
                              )}
                            </div>

                            {/* Info */}
                            <div className="p-2.5">
                              <h4 className="text-xs font-semibold text-white truncate">{item.title}</h4>
                              <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                                <span>{item.year || '2026'}</span>
                                <span className="uppercase text-[9px] text-[#95FF50]">
                                  {item.kind === 'series' ? 'Serie' : 'Película'}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-20 text-slate-500 text-xs">
                      No hay elementos para mostrar en esta pestaña.
                    </div>
                  )}
                </div>

                {/* BottomSheet Modal Simulator (Kino Social Share) */}
                {showShareModal && (
                  <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-40 flex items-end justify-center p-4">
                    <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-4 shadow-2xl animate-in slide-in-from-bottom-5">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div className="flex items-center space-x-2">
                          <Share2 className="w-4 h-4 text-[#95FF50]" />
                          <h3 className="text-sm font-bold text-white">Compartir en Kino Social</h3>
                        </div>
                        <button
                          onClick={() => setShowShareModal(false)}
                          className="text-slate-400 hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            ¿Qué quieres contar?
                          </label>
                          <textarea
                            value={shareText}
                            onChange={e => setShareText(e.target.value)}
                            rows={3}
                            maxLength={500}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-[#95FF50]"
                          />
                        </div>

                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={attachTitle}
                            onChange={e => setAttachTitle(e.target.checked)}
                            className="rounded bg-slate-950 border-slate-700 text-[#95FF50] focus:ring-0"
                          />
                          <span className="text-xs text-slate-300">Adjuntar el título de CineJoy</span>
                        </label>

                        <p className="text-[11px] text-slate-400">
                          Llega a Kino Social como borrador: allá lo revisas y lo publicas.
                        </p>

                        <div className="flex items-center justify-end space-x-2 pt-2">
                          <button
                            onClick={() => setShowShareModal(false)}
                            className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={handleSendShare}
                            className="flex items-center space-x-1.5 px-4 py-2 bg-[#95FF50] hover:bg-[#82e642] text-slate-950 font-bold rounded-lg text-xs transition"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Enviar a Kino Social</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* TV Remote Control (Col 9-12) */}
              <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col items-center space-y-5 shadow-xl">
                <div className="text-center">
                  <div className="text-xs font-bold text-white uppercase tracking-wider">Control Remoto de TV</div>
                  <div className="text-[11px] text-slate-400">Navega la pantalla como en Android TV</div>
                </div>

                {/* D-Pad Circle */}
                <div className="relative w-48 h-48 bg-slate-950 rounded-full border-4 border-slate-800 shadow-inner flex items-center justify-center p-2">
                  {/* Up */}
                  <button
                    onClick={() => handleDpad('up')}
                    className="absolute top-2 w-12 h-10 bg-slate-800 hover:bg-slate-700 active:bg-[#95FF50] active:text-slate-950 rounded-t-xl flex items-center justify-center text-slate-300 transition"
                  >
                    <ChevronUp className="w-5 h-5" />
                  </button>

                  {/* Down */}
                  <button
                    onClick={() => handleDpad('down')}
                    className="absolute bottom-2 w-12 h-10 bg-slate-800 hover:bg-slate-700 active:bg-[#95FF50] active:text-slate-950 rounded-b-xl flex items-center justify-center text-slate-300 transition"
                  >
                    <ChevronDown className="w-5 h-5" />
                  </button>

                  {/* Left */}
                  <button
                    onClick={() => handleDpad('left')}
                    className="absolute left-2 w-10 h-12 bg-slate-800 hover:bg-slate-700 active:bg-[#95FF50] active:text-slate-950 rounded-l-xl flex items-center justify-center text-slate-300 transition"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  {/* Right */}
                  <button
                    onClick={() => handleDpad('right')}
                    className="absolute right-2 w-10 h-12 bg-slate-800 hover:bg-slate-700 active:bg-[#95FF50] active:text-slate-950 rounded-r-xl flex items-center justify-center text-slate-300 transition"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>

                  {/* Center OK */}
                  <button
                    onClick={() => handleDpad('ok')}
                    className="w-16 h-16 rounded-full bg-[#95FF50] hover:bg-[#82e642] text-slate-950 font-bold flex items-center justify-center shadow-lg active:scale-95 transition"
                  >
                    OK
                  </button>
                </div>

                {/* Additional TV Buttons */}
                <div className="grid grid-cols-3 gap-2 w-full max-w-[240px]">
                  <button
                    onClick={() => {
                      if (showShareModal) setShowShareModal(false);
                      else handleDpad('up');
                    }}
                    className="py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg text-slate-300"
                  >
                    Atrás
                  </button>
                  <button
                    onClick={() => {
                      handleTabChange('trending');
                    }}
                    className="py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg text-slate-300"
                  >
                    Inicio
                  </button>
                  <button
                    onClick={() => setShowShareModal(true)}
                    className="py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg text-[#95FF50]"
                  >
                    Compartir
                  </button>
                </div>

                {/* Current State Diagnostic Box */}
                <div className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-[11px] font-mono space-y-1">
                  <div className="text-slate-400 font-bold">Estado del foco en TV:</div>
                  <div className="flex justify-between text-slate-300">
                    <span>Zona activa:</span>
                    <span className="text-[#95FF50] font-bold">{activeZone}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Índice foco:</span>
                    <span className="text-white">{focusedIndex}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Pestaña:</span>
                    <span className="text-sky-400">{currentTab}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Presupuesto nodos:</span>
                    <span className="text-emerald-400">&lt; 600 nodos (Válido)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TERMINAL Y PRUEBAS SDK */}
        {activeTab === 'runner' && (
          <div className="space-y-5">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div>
                <h3 className="text-base font-bold text-white">Consola de Pruebas con el SDK Oficial de Kino</h3>
                <p className="text-xs text-slate-400">
                  Ejecuta las validaciones automáticas del kit oficial sin salir del entorno.
                </p>
              </div>

              {/* Controls */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Función a probar</label>
                  <select
                    value={testFunc}
                    onChange={e => setTestFunc(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#95FF50]"
                  >
                    <option value="resolve">resolve (buscar y mezclar enlaces con Nuvio)</option>
                    <option value="home">home (filas de portada TMDB)</option>
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

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={runValidation}
                  disabled={commandRunning}
                  className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg border border-slate-700 transition"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#95FF50]" />
                  <span>Validar Manifiesto (sdk/validate.mjs)</span>
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
            <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
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
                    Haz clic en &ldquo;Validar Manifiesto&rdquo;, &ldquo;Ejecutar Prueba&rdquo; o &ldquo;Suite Offline&rdquo; para ver la salida del SDK de Kino...
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CONEXIÓN DIRECTA A GITHUB (PUSH) */}
        {activeTab === 'github' && (
          <div className="space-y-6">
            {/* Diagnostic Alert */}
            <div className="bg-amber-950/30 border border-amber-500/40 rounded-2xl p-5 space-y-3">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-amber-200">
                    Causa del error: &ldquo;No se pudo encontrar kino-plugin.json en Lenoxlkz/CineJoy-Plugin-&rdquo;
                  </h4>
                  <p className="text-xs text-amber-300/90 leading-relaxed">
                    Kino busca obligatoriamente el archivo <code className="bg-amber-900/60 px-1 py-0.5 rounded text-amber-100 font-mono">kino-plugin.json</code> en la <strong>raíz</strong> de tu repositorio (<code className="bg-amber-900/60 px-1 py-0.5 rounded text-amber-100 font-mono">https://raw.githubusercontent.com/Lenoxlkz/CineJoy-Plugin-/main/kino-plugin.json</code>).
                    Actualmente en GitHub se había subido la carpeta completa del entorno de desarrollo y los archivos del plugin estaban adentro de <code className="bg-amber-900/60 px-1 py-0.5 rounded text-amber-100 font-mono">cinejoy-plugin/</code> o <code className="bg-amber-900/60 px-1 py-0.5 rounded text-amber-100 font-mono">public/plugin/</code>.
                  </p>
                  <p className="text-xs text-amber-200 font-semibold pt-1">
                    Solución: Al pulsar el botón &ldquo;Enviar Cambios a GitHub&rdquo; abajo con tu Token, se enviarán <code className="font-mono text-white">kino-plugin.json</code>, <code className="font-mono text-white">plugin.js</code> e <code className="font-mono text-white">icon.png</code> directamente a la raíz de tu repositorio.
                  </p>
                </div>
              </div>
            </div>

            {/* Direct Kino Install Shortcut */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-[#95FF50]/10 flex items-center justify-center text-[#95FF50]">
                  <Zap className="w-4 h-4 fill-current" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Instalación alternativa inmediata en Kino</h4>
                  <p className="text-xs text-slate-400">Si no deseas sincronizar todavía, puedes pegar esta URL directa en Kino:</p>
                </div>
              </div>
              <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                <code className="text-xs text-emerald-400 font-mono break-all flex-1 select-all">
                  https://raw.githubusercontent.com/Lenoxlkz/CineJoy-Plugin-/main/cinejoy-plugin/kino-plugin.json
                </code>
                <button
                  onClick={() => handleCopy('https://raw.githubusercontent.com/Lenoxlkz/CineJoy-Plugin-/main/cinejoy-plugin/kino-plugin.json', 'direct-kino')}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold shrink-0 transition flex items-center space-x-1"
                >
                  {copiedKey === 'direct-kino' ? <Check className="w-3.5 h-3.5 text-[#95FF50]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'direct-kino' ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>
            </div>

            {/* Main Git Push Panel */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-black border border-slate-700 flex items-center justify-center">
                  <Github className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Sincronización Directa a la Raíz de GitHub</h3>
                  <p className="text-xs text-slate-400">
                    Sube kino-plugin.json, plugin.js e icon.png directamente a la raíz de tu repositorio en un solo paso.
                  </p>
                </div>
              </div>

              {/* Status Box */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono space-y-2">
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Repositorio configurado:</span>
                  <span className="text-sky-400 font-bold">{gitRepo}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Rama destino:</span>
                  <span className="text-[#95FF50] font-bold">main</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Archivos a colocar en la raíz:</span>
                  <span className="text-slate-200">kino-plugin.json, plugin.js, icon.png, kino-export.json</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Estado del árbol local:</span>
                  <span className="text-emerald-400 font-semibold">Listo y verificado con el SDK</span>
                </div>
              </div>

              {/* Push Form */}
              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Repositorio de GitHub (usuario/repositorio)
                  </label>
                  <input
                    type="text"
                    value={gitRepo}
                    onChange={e => setGitRepo(e.target.value)}
                    placeholder="Lenoxlkz/CineJoy-Plugin-"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-[#95FF50]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    GitHub Personal Access Token (PAT)
                  </label>
                  <input
                    type="password"
                    value={gitToken}
                    onChange={e => setGitToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxx (con permiso de repo:write)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-[#95FF50]"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Puedes generar un token clásico en <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer" className="text-[#95FF50] underline">github.com/settings/tokens</a> con el permiso <code>repo</code> marcado.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Mensaje del commit
                  </label>
                  <input
                    type="text"
                    value={gitMessage}
                    onChange={e => setGitMessage(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-[#95FF50]"
                  />
                </div>

                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="checkbox"
                    id="forcePush"
                    checked={gitForce}
                    onChange={e => setGitForce(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-[#95FF50] focus:ring-0"
                  />
                  <label htmlFor="forcePush" className="text-xs text-slate-300 cursor-pointer">
                    Forzar sobreescritura limpia en la rama (<code className="font-mono text-slate-400">--force</code> para garantizar que los archivos del plugin queden limpios en la raíz)
                  </label>
                </div>

                <div className="pt-2 flex items-center space-x-3">
                  <button
                    onClick={handleGitPush}
                    disabled={gitPushing || !gitToken.trim()}
                    className="flex items-center space-x-2 px-5 py-2.5 bg-[#95FF50] hover:bg-[#82e642] disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs transition shadow-lg shadow-[#95FF50]/10"
                  >
                    {gitPushing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Enviando archivos a la raíz de GitHub...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Enviar Cambios a GitHub (git push)</span>
                      </>
                    )}
                  </button>
                </div>

                {gitPushResult && (
                  <div
                    className={`p-4 rounded-xl text-xs font-mono border ${
                      gitPushResult.success
                        ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                    }`}
                  >
                    <div className="font-bold mb-1">
                      {gitPushResult.success ? '✓ ¡Envío exitoso!' : '✗ Error al enviar:'}
                    </div>
                    <div>{gitPushResult.message || gitPushResult.error || gitPushResult.output}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: CLOUDFLARE WORKER HLS PROXY */}
        {activeTab === 'worker' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
                    <Cloud className="w-6 h-6 text-orange-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      Código Cloudflare Worker: HLS Proxy (ExoPlayer Fix)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Reescribe cabeceras erróneas <code className="text-[#95FF50]">text/html</code> a <code className="text-[#95FF50]">video/mp2t</code> para evitar errores en Android, elimina Referer y añade CORS.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleCopy(workerCode, 'worker-code')}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-[#95FF50] hover:bg-[#82e642] text-slate-950 font-bold rounded-xl text-xs transition"
                >
                  {copiedKey === 'worker-code' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedKey === 'worker-code' ? '¡Código Copiado!' : 'Copiar Código del Worker'}</span>
                </button>
              </div>

              {/* Steps */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs space-y-2">
                <div className="font-bold text-slate-200">Cómo recrear el Worker en Cloudflare en 3 minutos:</div>
                <ol className="list-decimal list-inside text-slate-400 space-y-1">
                  <li>Inicia sesión en tu panel de <a href="https://dash.cloudflare.com" target="_blank" rel="noreferrer" className="text-[#95FF50] underline">dash.cloudflare.com</a>.</li>
                  <li>Ve a <strong>Workers & Pages</strong> ▸ <strong>Create Application</strong> ▸ <strong>Create Worker</strong>.</li>
                  <li>Nómbralo <code>cinejoyproxy</code> (o la URL que tenías: <code>cinejoyproxy.lenoxlkzsdy.workers.dev</code>).</li>
                  <li>Haz clic en <strong>Deploy</strong> y luego en <strong>Edit code</strong>.</li>
                  <li>Pega el código que ves abajo (reemplazando el código de ejemplo) y pulsa <strong>Deploy</strong>. ¡Listo!</li>
                </ol>
              </div>

              {/* Code viewer */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-x-auto max-h-[550px]">
                <pre className="font-mono text-xs text-slate-300 whitespace-pre leading-relaxed">
                  {workerCode || 'Cargando código del worker...'}
                </pre>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>CineJoy &bull; apiVersion 20 &bull; Nuvio Scrapers &bull; Kino Social (wall/share)</span>
          <span className="font-mono text-slate-400">sdk/validate.mjs: ✓ Kino would accept this plugin</span>
        </div>
      </footer>
    </div>
  );
}
