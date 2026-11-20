import React, { useState } from 'react';
import {
  CheckCircle2,
  Zap,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react';
import { SdkFunction, sdkFunctionNeedsArg } from '../utils/screenHelpers';

interface SdkRunnerProps {
  testFunc: SdkFunction;
  testArg: string;
  testFixture: string;
  commandRunning: boolean;
  terminalOutput: string;
  terminalStatus: 'idle' | 'success' | 'error';
  onFuncChange: (fn: SdkFunction) => void;
  onArgChange: (arg: string) => void;
  onFixtureChange: (fixture: string) => void;
  onRunValidation: () => void;
  onRunExecution: () => void;
  onRunOfflineTests: () => void;
  onClearTerminal: () => void;
}

export function SdkRunner({
  testFunc,
  testArg,
  testFixture,
  commandRunning,
  terminalOutput,
  terminalStatus,
  onFuncChange,
  onArgChange,
  onFixtureChange,
  onRunValidation,
  onRunExecution,
  onRunOfflineTests,
  onClearTerminal,
}: SdkRunnerProps) {
  const [copied, setCopied] = useState(false);
  const needsArg = sdkFunctionNeedsArg(testFunc);

  const handleCopyOutput = () => {
    if (!terminalOutput) return;
    navigator.clipboard.writeText(terminalOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div>
          <h2 className="text-base font-bold text-white">Consola de Pruebas con el SDK Oficial de Kino</h2>
          <p className="text-xs text-slate-400">
            Ejecuta validaciones, pruebas unitarias offline y llamadas del plugin directamente con el SDK.
          </p>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          <div>
            <label htmlFor="sdk-func-select" className="block text-xs font-medium text-slate-400 mb-1">
              Función a probar
            </label>
            <select
              id="sdk-func-select"
              value={testFunc}
              onChange={e => onFuncChange(e.target.value as SdkFunction)}
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
            <label htmlFor="sdk-arg-input" className="block text-xs font-medium text-slate-400 mb-1">
              Parámetro / Referencia
            </label>
            <input
              id="sdk-arg-input"
              type="text"
              value={needsArg ? testArg : ''}
              disabled={!needsArg}
              onChange={e => onArgChange(e.target.value)}
              placeholder={needsArg ? 'ej: movie:550 o Matrix' : 'No requiere parámetro'}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#95FF50] font-mono disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label htmlFor="sdk-fixture-input" className="block text-xs font-medium text-slate-400 mb-1">
              Fixture de Nuvio (Mock)
            </label>
            <input
              id="sdk-fixture-input"
              type="text"
              value={testFixture}
              onChange={e => onFixtureChange(e.target.value)}
              placeholder="fixtures/nuvio-test.json"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#95FF50] font-mono"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onRunValidation}
            disabled={commandRunning}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg border border-slate-700 transition"
          >
            <CheckCircle2 className="w-4 h-4 text-[#95FF50]" />
            <span>Validar Manifiesto (sdk/validate.mjs)</span>
          </button>

          <button
            type="button"
            onClick={onRunExecution}
            disabled={commandRunning}
            className="flex items-center space-x-2 px-4 py-2 bg-[#95FF50] hover:bg-[#82e642] disabled:opacity-50 text-slate-950 text-xs font-bold rounded-lg shadow-sm transition"
          >
            <Zap className="w-4 h-4 fill-current" />
            <span>Ejecutar Prueba (sdk/run.mjs)</span>
          </button>

          <button
            type="button"
            onClick={onRunOfflineTests}
            disabled={commandRunning}
            className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm transition"
          >
            <CheckCircle2 className="w-4 h-4 text-purple-200" />
            <span>Suite Offline (node --test)</span>
          </button>

          <button
            type="button"
            onClick={onClearTerminal}
            className="text-xs text-slate-400 hover:text-slate-200 ml-auto"
          >
            Limpiar consola
          </button>
        </div>
      </div>

      {/* Terminal Window */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="bg-slate-900/80 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-rose-500/80" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
            <span className="text-xs text-slate-400 font-mono ml-2">Terminal SDK</span>
            {!commandRunning && terminalStatus === 'success' && (
              <span className="ml-2 inline-flex items-center space-x-1 text-[11px] text-emerald-400 font-mono">
                <CheckCircle2 className="w-3 h-3" />
                <span>OK</span>
              </span>
            )}
            {!commandRunning && terminalStatus === 'error' && (
              <span className="ml-2 inline-flex items-center space-x-1 text-[11px] text-rose-400 font-mono">
                <AlertCircle className="w-3 h-3" />
                <span>Error</span>
              </span>
            )}
          </div>
          <div className="flex items-center space-x-3">
            {commandRunning && (
              <div className="flex items-center space-x-2 text-xs text-[#95FF50] font-mono">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Ejecutando...</span>
              </div>
            )}
            {terminalOutput && (
              <button
                type="button"
                onClick={handleCopyOutput}
                aria-label="Copiar salida de consola"
                className="flex items-center space-x-1 text-xs text-slate-400 hover:text-white transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[#95FF50]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiado' : 'Copiar'}</span>
              </button>
            )}
          </div>
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
  );
}
