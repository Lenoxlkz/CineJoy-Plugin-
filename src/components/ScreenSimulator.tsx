import React, { useEffect, useRef } from 'react';
import {
  Tv,
  Smartphone,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Share2,
  X,
  Send,
  AlertCircle,
  Play,
} from 'lucide-react';
import {
  countScreenNodes,
  DeviceMode,
  DpadDirection,
  FocusZone,
  SCREEN_TABS,
} from '../utils/screenHelpers';

export interface ScreenItem {
  id?: string;
  ref?: string;
  title: string;
  kind?: string;
  year?: string | number;
  poster?: string;
  rating?: number;
}

interface ScreenSimulatorProps {
  deviceMode: DeviceMode;
  onDeviceModeChange: (mode: DeviceMode) => void;
  screenTree: any;
  screenLoading: boolean;
  screenError: string | null;
  onRetryLoad: () => void;
  currentTab: string;
  onTabChange: (tabName: string) => void;
  activeZone: FocusZone;
  focusedIndex: number;
  onFocusCard: (index: number, item: ScreenItem) => void;
  onTestItemInSdk: (item: ScreenItem) => void;
  onDpad: (direction: DpadDirection) => void;
  onBackButton: () => void;
  onHomeButton: () => void;
  showShareModal: boolean;
  shareText: string;
  attachTitle: boolean;
  shareSending: boolean;
  onOpenShare: () => void;
  onCloseShare: () => void;
  onShareTextChange: (value: string) => void;
  onAttachTitleChange: (checked: boolean) => void;
  onSendShare: () => void;
  onCloseScreen: () => void;
}

const TAB_LABELS: Record<(typeof SCREEN_TABS)[number], string> = {
  trending: 'Tendencias',
  movies: 'Películas',
  series: 'Series TV',
  action: 'Acción',
};

export function ScreenSimulator({
  deviceMode,
  onDeviceModeChange,
  screenTree,
  screenLoading,
  screenError,
  onRetryLoad,
  currentTab,
  onTabChange,
  activeZone,
  focusedIndex,
  onFocusCard,
  onTestItemInSdk,
  onDpad,
  onBackButton,
  onHomeButton,
  showShareModal,
  shareText,
  attachTitle,
  shareSending,
  onOpenShare,
  onCloseShare,
  onShareTextChange,
  onAttachTitleChange,
  onSendShare,
  onCloseScreen,
}: ScreenSimulatorProps) {
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const gridItems: ScreenItem[] = screenTree?.body?.children?.[0]?.items || [];
  const nodeCount = countScreenNodes(screenTree);
  const withinBudget = nodeCount <= 600;
  const focusedItem = activeZone === 'grid' ? gridItems[focusedIndex] : undefined;

  useEffect(() => {
    if (activeZone === 'grid') {
      const el = cardRefs.current[focusedIndex];
      if (el) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [activeZone, focusedIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        onDpad('up');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        onDpad('down');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onDpad('left');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onDpad('right');
      } else if (e.key === 'Enter' && !target?.closest('button')) {
        e.preventDefault();
        onDpad('ok');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onBackButton();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDpad, onBackButton]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
        <div>
          <h2 className="text-base font-bold text-white flex items-center space-x-2">
            <Tv className="w-4 h-4 text-[#95FF50]" />
            <span>Simulador de Pantalla Kino (Screen) con Control TV</span>
          </h2>
          <p className="text-xs text-slate-400">
            Barra compacta (<code className="text-[#95FF50]">mergeWithKinoBar: true</code>,{' '}
            <code className="text-[#95FF50]">dense: true</code>), navegación D-Pad y eventos reales de{' '}
            <code className="text-sky-400">screenEvent</code>.
          </p>
        </div>

        {/* Device Selector */}
        <div className="flex items-center space-x-2 bg-slate-950 p-1 rounded-xl border border-slate-800" role="group" aria-label="Modo de dispositivo">
          <button
            type="button"
            onClick={() => onDeviceModeChange('tv')}
            aria-pressed={deviceMode === 'tv'}
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
            type="button"
            onClick={() => onDeviceModeChange('phone')}
            aria-pressed={deviceMode === 'phone'}
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
        {/* Screen Viewport (Col 1-8) */}
        <div className="lg:col-span-8 flex justify-center">
          <div
            className={`w-full bg-black border-4 border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative min-h-[580px] flex flex-col transition-all ${
              deviceMode === 'phone' ? 'max-w-[400px]' : ''
            }`}
          >
            {/* Screen Glare Effect */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.02] to-transparent pointer-events-none z-30" />

            {/* Kino App Bar (Merged Compact Bar) */}
            <div className="bg-slate-900/95 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between shrink-0 z-20">
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={onCloseScreen}
                  aria-label="Cerrar pantalla"
                  className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300"
                  title="Cerrar (close: true)"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-sm tracking-tight text-white">CineJoy</span>
                  <span className="text-[10px] bg-[#95FF50]/10 text-[#95FF50] px-1.5 py-0.5 rounded font-mono">
                    {deviceMode === 'tv' ? 'TV Screen' : 'Mobile Screen'}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={onOpenShare}
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
            <div className="bg-slate-900/80 border-b border-slate-800/80 px-4 py-2 flex items-center space-x-2 overflow-x-auto shrink-0 z-10" role="tablist" aria-label="Categorías de CineJoy">
              {SCREEN_TABS.map((tabId, idx) => {
                const isSelected = currentTab === tabId;
                const isFocused = activeZone === 'tabs' && focusedIndex === idx;
                return (
                  <button
                    key={tabId}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => onTabChange(tabId)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                      isFocused
                        ? 'ring-2 ring-[#95FF50] bg-[#95FF50] text-slate-950 font-bold scale-105'
                        : isSelected
                        ? 'bg-[#95FF50]/20 text-[#95FF50] border border-[#95FF50]/30 font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {TAB_LABELS[tabId]}
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
              ) : screenError ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-3">
                  <AlertCircle className="w-8 h-8 text-rose-400" />
                  <div className="text-xs font-semibold text-rose-300">Error al cargar la pantalla</div>
                  <p className="text-xs text-slate-400 max-w-md">{screenError}</p>
                  <button
                    type="button"
                    onClick={onRetryLoad}
                    className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reintentar</span>
                  </button>
                </div>
              ) : gridItems.length > 0 ? (
                <div className={`grid ${deviceMode === 'tv' ? 'grid-cols-4 gap-4' : 'grid-cols-2 gap-3'}`}>
                  {gridItems.map((item, idx) => {
                    const isFocused = activeZone === 'grid' && focusedIndex === idx;
                    return (
                      <button
                        key={item.id || idx}
                        ref={el => {
                          cardRefs.current[idx] = el;
                        }}
                        type="button"
                        onClick={() => onFocusCard(idx, item)}
                        className={`group text-left relative bg-slate-900 rounded-xl overflow-hidden cursor-pointer transition transform ${
                          isFocused
                            ? 'ring-4 ring-[#95FF50] scale-[1.03] shadow-xl shadow-[#95FF50]/20 z-10'
                            : 'hover:scale-[1.02] border border-slate-800/80'
                        }`}
                      >
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
                          {item.rating ? (
                            <div className="absolute top-2 right-2 bg-black/80 backdrop-blur px-1.5 py-0.5 rounded text-[10px] font-bold text-[#95FF50]">
                              ★ {item.rating}
                            </div>
                          ) : null}
                        </div>

                        <div className="p-2.5">
                          <h4 className="text-xs font-semibold text-white truncate">{item.title}</h4>
                          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                            <span>{item.year || '—'}</span>
                            <span className="uppercase text-[9px] text-[#95FF50]">
                              {item.kind === 'series' ? 'Serie' : 'Película'}
                            </span>
                          </div>
                        </div>
                      </button>
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
              <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm z-40 flex items-end justify-center p-4"
                role="dialog"
                aria-modal="true"
                aria-labelledby="share-modal-title"
              >
                <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-4 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center space-x-2">
                      <Share2 className="w-4 h-4 text-[#95FF50]" />
                      <h3 id="share-modal-title" className="text-sm font-bold text-white">
                        Compartir en Kino Social
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={onCloseShare}
                      aria-label="Cerrar modal de compartir"
                      className="text-slate-400 hover:text-white p-1 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label htmlFor="share-text-input" className="block text-xs font-medium text-slate-300 mb-1">
                        ¿Qué quieres contar?
                      </label>
                      <textarea
                        id="share-text-input"
                        value={shareText}
                        onChange={e => onShareTextChange(e.target.value)}
                        rows={3}
                        maxLength={500}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-[#95FF50]"
                      />
                    </div>

                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={attachTitle}
                        onChange={e => onAttachTitleChange(e.target.checked)}
                        className="rounded bg-slate-950 border-slate-700 text-[#95FF50] focus:ring-0"
                      />
                      <span className="text-xs text-slate-300">Adjuntar el título de CineJoy</span>
                    </label>

                    <p className="text-[11px] text-slate-400">
                      Llega a Kino Social como borrador: allá lo revisas y lo publicas.
                    </p>

                    <div className="flex items-center justify-end space-x-2 pt-2">
                      <button
                        type="button"
                        onClick={onCloseShare}
                        className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={onSendShare}
                        disabled={shareSending}
                        className="flex items-center space-x-1.5 px-4 py-2 bg-[#95FF50] hover:bg-[#82e642] disabled:opacity-50 text-slate-950 font-bold rounded-lg text-xs transition"
                      >
                        {shareSending ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        <span>{shareSending ? 'Enviando...' : 'Enviar a Kino Social'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* TV Remote Control (Col 9-12) */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col items-center space-y-5 shadow-xl">
          <div className="text-center">
            <div className="text-xs font-bold text-white uppercase tracking-wider">Control Remoto de TV</div>
            <div className="text-[11px] text-slate-400">Navega con botones o flechas del teclado</div>
          </div>

          {/* D-Pad Circle */}
          <div className="relative w-48 h-48 bg-slate-950 rounded-full border-4 border-slate-800 shadow-inner flex items-center justify-center p-2">
            <button
              type="button"
              onClick={() => onDpad('up')}
              aria-label="Arriba"
              className="absolute top-2 w-12 h-10 bg-slate-800 hover:bg-slate-700 active:bg-[#95FF50] active:text-slate-950 rounded-t-xl flex items-center justify-center text-slate-300 transition"
            >
              <ChevronUp className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => onDpad('down')}
              aria-label="Abajo"
              className="absolute bottom-2 w-12 h-10 bg-slate-800 hover:bg-slate-700 active:bg-[#95FF50] active:text-slate-950 rounded-b-xl flex items-center justify-center text-slate-300 transition"
            >
              <ChevronDown className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => onDpad('left')}
              aria-label="Izquierda"
              className="absolute left-2 w-10 h-12 bg-slate-800 hover:bg-slate-700 active:bg-[#95FF50] active:text-slate-950 rounded-l-xl flex items-center justify-center text-slate-300 transition"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => onDpad('right')}
              aria-label="Derecha"
              className="absolute right-2 w-10 h-12 bg-slate-800 hover:bg-slate-700 active:bg-[#95FF50] active:text-slate-950 rounded-r-xl flex items-center justify-center text-slate-300 transition"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => onDpad('ok')}
              className="w-16 h-16 rounded-full bg-[#95FF50] hover:bg-[#82e642] text-slate-950 font-bold flex items-center justify-center shadow-lg active:scale-95 transition"
            >
              OK
            </button>
          </div>

          {/* Additional TV Buttons */}
          <div className="grid grid-cols-3 gap-2 w-full max-w-[240px]">
            <button
              type="button"
              onClick={onBackButton}
              className="py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg text-slate-300 transition"
            >
              Atrás
            </button>
            <button
              type="button"
              onClick={onHomeButton}
              className="py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg text-slate-300 transition"
            >
              Inicio
            </button>
            <button
              type="button"
              onClick={onOpenShare}
              className="py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg text-[#95FF50] transition"
            >
              Compartir
            </button>
          </div>

          {/* Current State Diagnostic Box */}
          <div className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-[11px] font-mono space-y-1.5">
            <div className="text-slate-400 font-bold">Estado del foco en pantalla:</div>
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
              <span className={withinBudget ? 'text-emerald-400' : 'text-rose-400'}>
                {screenTree ? `${nodeCount} / 600 nodos (${withinBudget ? 'Válido' : 'Excede'})` : 'Sin cargar'}
              </span>
            </div>

            {focusedItem && focusedItem.ref && (
              <div className="pt-2 mt-2 border-t border-slate-800 space-y-2">
                <div className="text-slate-400 truncate" title={focusedItem.title}>
                  Título: <span className="text-white">{focusedItem.title}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onTestItemInSdk(focusedItem)}
                  className="w-full flex items-center justify-center space-x-1.5 py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-[#95FF50] rounded-lg text-[11px] font-sans font-semibold transition"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Probar {focusedItem.ref} en SDK</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
