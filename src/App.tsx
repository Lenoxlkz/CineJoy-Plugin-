import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CheckCircle2, Tv, Terminal, AlertCircle } from 'lucide-react';
import { ScreenSimulator, ScreenItem } from './components/ScreenSimulator';
import { SdkRunner } from './components/SdkRunner';
import {
  DeviceMode,
  DpadDirection,
  FocusZone,
  nextDpadFocus,
  SCREEN_TABS,
  SDK_DEFAULT_ARGS,
  SdkFunction,
  sdkFunctionNeedsArg,
} from './utils/screenHelpers';

export default function App() {
  const [activeTab, setActiveTab] = useState<'screen' | 'runner'>('screen');

  // Screen & TV State
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('tv');
  const [screenTree, setScreenTree] = useState<any>(null);
  const [screenLoading, setScreenLoading] = useState(false);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState('trending');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [activeZone, setActiveZone] = useState<FocusZone>('tabs');

  // Share Modal State
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareText, setShareText] = useState('¡Disfrutando de películas y series en CineJoy!');
  const [attachTitle, setAttachTitle] = useState(true);
  const [shareSending, setShareSending] = useState(false);

  // Toast State (race-safe)
  const [toast, setToast] = useState<{ message: string; kind: 'info' | 'error' } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Terminal Runner State
  const [commandRunning, setCommandRunning] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string>('');
  const [terminalStatus, setTerminalStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [testFunc, setTestFunc] = useState<SdkFunction>('resolve');
  const [testArg, setTestArg] = useState(SDK_DEFAULT_ARGS.resolve);
  const [testFixture, setTestFixture] = useState('fixtures/nuvio-test.json');
  const [validationState, setValidationState] = useState<'pending' | 'valid' | 'invalid'>('pending');

  const screenReqIdRef = useRef(0);

  const showToast = useCallback((message: string, kind: 'info' | 'error' = 'info') => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ message, kind });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Load Screen Tree from Server (race-safe)
  const loadScreen = useCallback(async (tabName = currentTab, mode = deviceMode) => {
    const reqId = ++screenReqIdRef.current;
    setScreenLoading(true);
    setScreenError(null);
    try {
      const res = await fetch('/api/screen-tree', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device: mode, tab: tabName }),
      });
      const data = await res.json();
      if (reqId !== screenReqIdRef.current) return;

      if (res.ok && data.success && data.tree) {
        setScreenTree(data.tree);
        const items = data.tree?.body?.children?.[0]?.items || [];
        setFocusedIndex(prev => (items.length > 0 ? Math.min(prev, items.length - 1) : 0));
      } else {
        setScreenError(data.error || 'No se pudo obtener el árbol de pantalla del plugin.');
      }
    } catch (e: any) {
      if (reqId !== screenReqIdRef.current) return;
      setScreenError(e?.message || 'Error de red cargando la pantalla.');
    } finally {
      if (reqId === screenReqIdRef.current) {
        setScreenLoading(false);
      }
    }
  }, [currentTab, deviceMode]);

  useEffect(() => {
    loadScreen(currentTab, deviceMode);
  }, [deviceMode]);

  // Tab switch in Screen (runs screenEvent changeTab then loads screen)
  const handleTabChange = useCallback(async (tabName: string) => {
    let resolvedTab = tabName;
    try {
      const res = await fetch('/api/screen-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'changeTab',
          arg: tabName,
          state: { tab: currentTab },
          device: deviceMode,
          trigger: 'tap',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.answer?.state?.tab) {
        resolvedTab = data.answer.state.tab;
      }
    } catch {
      // Fallback to requested tabName
    }
    setCurrentTab(resolvedTab);
    setActiveZone('tabs');
    setFocusedIndex(Math.max(0, SCREEN_TABS.indexOf(resolvedTab as any)));
    await loadScreen(resolvedTab, deviceMode);
  }, [currentTab, deviceMode, loadScreen]);

  // Open Share via screenEvent openShare
  const handleOpenShare = useCallback(async () => {
    try {
      const res = await fetch('/api/screen-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'openShare',
          arg: '',
          state: { tab: currentTab },
          device: deviceMode,
          trigger: 'tap',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const inputs = data.answer?.state?.inputs;
        if (inputs) {
          setShareText(inputs.shareText ?? '¡Disfrutando de películas y series en CineJoy!');
          setAttachTitle(inputs.shareTitle !== false);
        }
        setShowShareModal(true);
      } else {
        showToast(data.error || 'No se pudo abrir la hoja de compartir.', 'error');
      }
    } catch {
      showToast('Error de conexión al abrir compartir.', 'error');
    }
  }, [currentTab, deviceMode, showToast]);

  // Share Send simulation via screenEvent sendShare
  const handleSendShare = useCallback(async () => {
    if (shareSending) return;
    setShareSending(true);
    try {
      const res = await fetch('/api/screen-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'sendShare',
          arg: '',
          value: { shareText, shareTitle: attachTitle },
          state: {
            tab: currentTab,
            share: { name: 'CineJoy' },
            inputs: { shareText, shareTitle: attachTitle },
          },
          device: deviceMode,
          trigger: 'submit',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Error ejecutando sendShare.', 'error');
        return;
      }
      const shouldClose = Array.isArray(data.answer?.ui) && data.answer.ui.some((u: any) => u?.close === 'shareSheet');
      if (shouldClose) {
        setShowShareModal(false);
      }
      const toastMsg = data.answer?.toast?.text || (typeof data.answer?.toast === 'string' ? data.answer.toast : null);
      if (toastMsg) {
        showToast(toastMsg);
      } else {
        showToast('Evento sendShare ejecutado.');
      }
    } catch {
      showToast('Error de conexión al enviar a Kino Social.', 'error');
    } finally {
      setShareSending(false);
    }
  }, [shareSending, shareText, attachTitle, currentTab, deviceMode, showToast]);

  // TV Remote Navigation Handlers
  const handleDpad = useCallback((direction: DpadDirection) => {
    const items = screenTree?.body?.children?.[0]?.items || [];

    if (showShareModal) {
      if (direction === 'ok') {
        handleSendShare();
      }
      return;
    }

    if (direction === 'ok') {
      if (activeZone === 'appbar') {
        handleOpenShare();
      } else if (activeZone === 'tabs') {
        const nextTab = SCREEN_TABS[focusedIndex] || 'trending';
        handleTabChange(nextTab);
      } else if (activeZone === 'grid') {
        const selected = items[focusedIndex];
        if (selected) {
          showToast(`Seleccionado: ${selected.title} (${selected.ref})`);
        }
      }
      return;
    }

    const next = nextDpadFocus(
      { zone: activeZone, focusedIndex },
      direction,
      {
        tabsCount: SCREEN_TABS.length,
        itemsCount: items.length,
        cols: deviceMode === 'tv' ? 4 : 2,
        currentTabIndex: Math.max(0, SCREEN_TABS.indexOf(currentTab as any)),
      }
    );
    setActiveZone(next.zone);
    setFocusedIndex(next.focusedIndex);
  }, [
    screenTree,
    showShareModal,
    activeZone,
    focusedIndex,
    deviceMode,
    currentTab,
    handleSendShare,
    handleOpenShare,
    handleTabChange,
    showToast,
  ]);

  const handleBackButton = useCallback(() => {
    if (showShareModal) {
      setShowShareModal(false);
      return;
    }
    if (activeZone === 'grid') {
      setActiveZone('tabs');
      setFocusedIndex(Math.max(0, SCREEN_TABS.indexOf(currentTab as any)));
      return;
    }
    if (activeZone === 'tabs') {
      setActiveZone('appbar');
    }
  }, [showShareModal, activeZone, currentTab]);

  const handleHomeButton = useCallback(() => {
    setShowShareModal(false);
    handleTabChange('trending');
  }, [handleTabChange]);

  const handleTestItemInSdk = useCallback((item: ScreenItem) => {
    if (!item.ref) return;
    const isSeries = item.kind === 'series' || item.ref.startsWith('series:') || item.ref.startsWith('tv:');
    const fn: SdkFunction = isSeries ? 'episodes' : 'resolve';
    setTestFunc(fn);
    setTestArg(item.ref);
    setActiveTab('runner');
    showToast(`Cargado ${item.ref} en la consola SDK (${fn})`);
  }, [showToast]);

  // SDK Runner Handlers
  const handleFuncChange = (fn: SdkFunction) => {
    setTestFunc(fn);
    setTestArg(SDK_DEFAULT_ARGS[fn]);
  };

  const runValidation = async () => {
    setCommandRunning(true);
    setTerminalStatus('idle');
    setTerminalOutput('Ejecutando: node sdk/validate.mjs cinejoy-plugin ...\n');
    try {
      const res = await fetch('/api/validate', { method: 'POST' });
      const data = await res.json();
      setTerminalStatus(data.success ? 'success' : 'error');
      setValidationState(data.success ? 'valid' : 'invalid');
      setTerminalOutput(prev => prev + '\n' + (data.output || 'Sin respuesta'));
    } catch (err: any) {
      setTerminalStatus('error');
      setValidationState('invalid');
      setTerminalOutput(prev => prev + '\nError: ' + err.message);
    } finally {
      setCommandRunning(false);
    }
  };

  const runExecution = async () => {
    setCommandRunning(true);
    setTerminalStatus('idle');
    const cleanArg = sdkFunctionNeedsArg(testFunc) ? testArg.trim() : '';
    const argPreview = cleanArg ? ` ${cleanArg.includes(' ') ? `"${cleanArg}"` : cleanArg}` : '';
    const cmdStr = `${testFixture.trim() ? `KINO_NUVIO_FIXTURE=${testFixture.trim()} ` : ''}node sdk/run.mjs cinejoy-plugin ${testFunc}${argPreview}`;
    setTerminalOutput(`Ejecutando: ${cmdStr} ...\n`);
    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ func: testFunc, arg: cleanArg, fixture: testFixture.trim() }),
      });
      const data = await res.json();
      setTerminalStatus(data.success ? 'success' : 'error');
      setTerminalOutput(prev => prev + '\n' + (data.output || 'Sin salida'));
    } catch (err: any) {
      setTerminalStatus('error');
      setTerminalOutput(prev => prev + '\nError: ' + err.message);
    } finally {
      setCommandRunning(false);
    }
  };

  const runOfflineTests = async () => {
    setCommandRunning(true);
    setTerminalStatus('idle');
    setTerminalOutput('Ejecutando: node --test test/plugin.test.mjs ...\n');
    try {
      const res = await fetch('/api/test-offline', { method: 'POST' });
      const data = await res.json();
      setTerminalStatus(data.success ? 'success' : 'error');
      setTerminalOutput(prev => prev + '\n' + (data.output || 'Sin salida'));
    } catch (err: any) {
      setTerminalStatus('error');
      setTerminalOutput(prev => prev + '\nError: ' + err.message);
    } finally {
      setCommandRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Toast Alert */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed top-4 right-4 z-50 font-semibold px-4 py-2.5 rounded-xl shadow-2xl flex items-center space-x-2 border ${
            toast.kind === 'error'
              ? 'bg-rose-950 text-rose-200 border-rose-500/50'
              : 'bg-[#95FF50] text-slate-950 border-[#95FF50]/50'
          }`}
        >
          {toast.kind === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span className="text-xs">{toast.message}</span>
        </div>
      )}

      {/* Main Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-black border border-[#95FF50]/40 flex items-center justify-center shadow-lg shadow-[#95FF50]/10 overflow-hidden">
              <img src="/plugin/icon.png" alt="CineJoy Icon" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <h1 className="text-lg font-bold text-white tracking-tight whitespace-nowrap">CineJoy TV Studio</h1>
                <span className="bg-[#95FF50]/20 text-[#95FF50] border border-[#95FF50]/30 text-xs px-2 py-0.5 rounded-full font-mono font-semibold whitespace-nowrap">
                  v1.0.9
                </span>
                <span className="bg-sky-500/20 text-sky-400 border border-sky-500/30 text-xs px-2 py-0.5 rounded-full font-mono whitespace-nowrap">
                  + Nuvio
                </span>
                <span className="bg-purple-500/20 text-purple-400 border border-purple-500/30 text-xs px-2 py-0.5 rounded-full font-mono whitespace-nowrap">
                  + Kino Social
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Simulador de pantalla Kino con control de TV y consola de pruebas SDK
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="max-w-7xl mx-auto px-3 sm:px-6 flex space-x-1 overflow-x-auto border-t border-slate-800/60 pt-1 text-sm" aria-label="Secciones principales">
          {[
            { id: 'screen', label: 'Pantalla Screen con Control TV', icon: Tv },
            { id: 'runner', label: 'Consola y Pruebas SDK', icon: Terminal },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as 'screen' | 'runner')}
                className={`flex items-center space-x-1.5 sm:space-x-2 px-2.5 sm:px-4 py-2.5 border-b-2 font-medium text-[11px] sm:text-xs whitespace-nowrap transition ${
                  isActive
                    ? 'border-[#95FF50] text-[#95FF50] bg-[#95FF50]/5 font-bold'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {activeTab === 'screen' && (
          <ScreenSimulator
            deviceMode={deviceMode}
            onDeviceModeChange={setDeviceMode}
            screenTree={screenTree}
            screenLoading={screenLoading}
            screenError={screenError}
            onRetryLoad={() => loadScreen(currentTab, deviceMode)}
            currentTab={currentTab}
            onTabChange={handleTabChange}
            activeZone={activeZone}
            focusedIndex={focusedIndex}
            onFocusCard={(idx, item) => {
              setActiveZone('grid');
              setFocusedIndex(idx);
              showToast(`Título: ${item.title}${item.ref ? ` (${item.ref})` : ''}`);
            }}
            onTestItemInSdk={handleTestItemInSdk}
            onDpad={handleDpad}
            onBackButton={handleBackButton}
            onHomeButton={handleHomeButton}
            showShareModal={showShareModal}
            shareText={shareText}
            attachTitle={attachTitle}
            shareSending={shareSending}
            onOpenShare={handleOpenShare}
            onCloseShare={() => setShowShareModal(false)}
            onShareTextChange={setShareText}
            onAttachTitleChange={setAttachTitle}
            onSendShare={handleSendShare}
            onCloseScreen={() => showToast('Cerrando pantalla (go.close: true)')}
          />
        )}

        {activeTab === 'runner' && (
          <SdkRunner
            testFunc={testFunc}
            testArg={testArg}
            testFixture={testFixture}
            commandRunning={commandRunning}
            terminalOutput={terminalOutput}
            terminalStatus={terminalStatus}
            onFuncChange={handleFuncChange}
            onArgChange={setTestArg}
            onFixtureChange={setTestFixture}
            onRunValidation={runValidation}
            onRunExecution={runExecution}
            onRunOfflineTests={runOfflineTests}
            onClearTerminal={() => {
              setTerminalOutput('');
              setTerminalStatus('idle');
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>CineJoy &bull; apiVersion 20 &bull; Nuvio Scrapers &bull; Kino Social (wall/share)</span>
          <span
            className={`font-mono ${
              validationState === 'valid'
                ? 'text-emerald-400'
                : validationState === 'invalid'
                ? 'text-rose-400'
                : 'text-slate-400'
            }`}
          >
            {validationState === 'valid'
              ? 'sdk/validate.mjs: ✓ Kino acepta este plugin'
              : validationState === 'invalid'
              ? 'sdk/validate.mjs: ✗ Validación fallida'
              : 'sdk/validate.mjs: Listo para validar en Consola SDK'}
          </span>
        </div>
      </footer>
    </div>
  );
}
