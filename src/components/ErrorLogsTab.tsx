import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  FileWarning,
  RefreshCw,
} from 'lucide-react';
import { ErrorLogEntry } from '../types';

interface ErrorLogsTabProps {
  logs: ErrorLogEntry[];
  onToggleResolve: (id: number, resolved: boolean) => Promise<void>;
  onRunAiAnalysis: (query: string, contextLog: string) => Promise<{
    model: string;
    thinkingLevel: string;
    notice?: string;
    analysis: string;
  }>;
}

export function ErrorLogsTab({
  logs,
  onToggleResolve,
  onRunAiAnalysis,
}: ErrorLogsTabProps) {
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'ERROR' | 'WARNING'>('ALL');
  const [aiQuery, setAiQuery] = useState(
    'Analyze why lucidadl exited with status 2 (LUCIDA_MANIFEST_403) and how to configure Termux Ubuntu PRoot shared storage mounts.'
  );
  const [selectedLog, setSelectedLog] = useState<ErrorLogEntry | null>(logs[0] || null);
  const [aiResult, setAiResult] = useState<{
    model: string;
    thinkingLevel: string;
    notice?: string;
    analysis: string;
  } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const filteredLogs = logs.filter((log) => {
    if (severityFilter === 'ALL') return true;
    return log.severity === severityFilter;
  });

  const handleAnalyzeLog = async (logEntry?: ErrorLogEntry) => {
    const target = logEntry || selectedLog;
    const promptText = logEntry
      ? `Diagnose error ${logEntry.errorCode} in module ${logEntry.module}: ${logEntry.message}`
      : aiQuery;
    const contextText = target
      ? `Error Code: ${target.errorCode}\nModule: ${target.module}\nMessage: ${target.message}\nStack Trace:\n${target.stackTrace}`
      : '';

    if (logEntry) {
      setSelectedLog(logEntry);
      setAiQuery(promptText);
    }

    setAnalyzing(true);
    try {
      const res = await onRunAiAnalysis(promptText, contextText);
      setAiResult(res);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Structured Error & Warning Logs */}
      <div className="lg:col-span-7 border border-slate-800 bg-slate-900/60 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              Structured Subprocess & Backend Error Logs
            </h2>
            <p className="text-xs text-slate-400">
              Isolated stderr traces from lucidadl, metadata adapter, and Telegram polling
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg">
            {(['ALL', 'ERROR', 'WARNING'] as const).map((sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => setSeverityFilter(sev)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  severityFilter === sev
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-slate-800/80">
          {filteredLogs.map((log) => (
            <div key={log.id} className="p-4 space-y-2.5 hover:bg-slate-900 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
                    <span
                      className={`font-semibold ${
                        log.severity === 'ERROR' ? 'text-red-400' : 'text-amber-400'
                      }`}
                    >
                      {log.severity}
                    </span>
                    <span className="text-slate-500">·</span>
                    <span className="text-slate-200">{log.errorCode}</span>
                    <span className="text-slate-500">·</span>
                    <span className="text-slate-400">{log.module}</span>
                    {log.jobUid && (
                      <>
                        <span className="text-slate-500">·</span>
                        <span className="text-amber-300">{log.jobUid}</span>
                      </>
                    )}
                  </div>
                  <p className="text-sm font-medium text-slate-100 mt-1">{log.message}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleAnalyzeLog(log)}
                    className="px-2.5 py-1 text-xs font-medium text-amber-300 bg-amber-950/40 hover:bg-amber-900/50 border border-amber-800/60 rounded-md whitespace-nowrap shrink-0"
                  >
                    Deep Analyze
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleResolve(log.id, !log.resolved)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md border whitespace-nowrap shrink-0 ${
                      log.resolved
                        ? 'text-emerald-400 bg-emerald-950/30 border-emerald-800/60'
                        : 'text-slate-300 bg-slate-950 hover:bg-slate-800 border-slate-700'
                    }`}
                  >
                    {log.resolved ? 'Resolved' : 'Mark Resolved'}
                  </button>
                </div>
              </div>

              <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-400 overflow-x-auto whitespace-pre-wrap">
                {log.stackTrace}
              </pre>
            </div>
          ))}
        </div>
      </div>

      {/* Right Column: High-Thinking Gemini 4 Argon Diagnostic Engine */}
      <div className="lg:col-span-5 border border-slate-800 bg-slate-900/60 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <span className="text-xs font-mono text-amber-400">
              gemini-4-argon · ThinkingLevel.HIGH
            </span>
            <h3 className="text-base font-bold text-slate-100 mt-0.5">
              High-Thinking Root-Cause Analyzer
            </h3>
          </div>
          <Cpu className="w-5 h-5 text-amber-400 shrink-0" />
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Perform deep multi-step reasoning on <code className="text-slate-200">lucidadl</code> exit
          codes, Termux Ubuntu PRoot bind mounts, SQLAlchemy connection pooling, or Telegram
          polling exceptions.
        </p>

        <div className="space-y-3">
          <label
            htmlFor="ai-diagnostic-query"
            className="block text-xs font-medium text-slate-300"
          >
            Diagnostic or Architecture Query
          </label>
          <textarea
            id="ai-diagnostic-query"
            rows={3}
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            className="w-full p-3 text-xs font-mono bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500"
          />
          <button
            type="button"
            disabled={analyzing}
            onClick={() => handleAnalyzeLog()}
            className="w-full py-2.5 px-4 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${analyzing ? 'animate-spin' : ''}`} />
            <span>
              {analyzing
                ? 'Running High-Thinking Analysis...'
                : 'Run High-Thinking Root-Cause Analysis'}
            </span>
          </button>
        </div>

        {aiResult && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span>Model: {aiResult.model}</span>
              <span>Thinking: {aiResult.thinkingLevel}</span>
            </div>
            {aiResult.notice && (
              <div className="p-2.5 bg-amber-950/40 border border-amber-800/60 rounded-lg text-xs text-amber-300">
                {aiResult.notice}
              </div>
            )}
            <pre className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 whitespace-pre-wrap max-h-96 overflow-y-auto leading-relaxed">
              {aiResult.analysis}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
