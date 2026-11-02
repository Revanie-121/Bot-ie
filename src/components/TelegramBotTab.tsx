import React, { useState } from 'react';
import { Send, Terminal, MessageSquare, CheckCircle2, AlertCircle } from 'lucide-react';
import { BotEvent, UserProfile } from '../types';

interface TelegramBotTabProps {
  events: BotEvent[];
  user: UserProfile;
  onSendCommand: (message: string, username: string) => Promise<void>;
  isSending: boolean;
}

const QUICK_BOT_COMMANDS = [
  { label: '/start', cmd: '/start' },
  {
    label: '/dl Track B08X9K2M1P (FLAC)',
    cmd: '/dl https://music.amazon.com/tracks/B08X9K2M1P flac',
  },
  {
    label: '/dl Album B09K4T8W2N (OPUS)',
    cmd: '/dl https://music.amazon.com/albums/B09K4T8W2N opus',
  },
  { label: '/search B08X9K2M1P', cmd: '/search B08X9K2M1P' },
  { label: '/status', cmd: '/status' },
  { label: '/settings', cmd: '/settings' },
];

export function TelegramBotTab({
  events,
  user,
  onSendCommand,
  isSending,
}: TelegramBotTabProps) {
  const [commandInput, setCommandInput] = useState('/dl https://music.amazon.com/tracks/B08X9K2M1P flac');
  const [username, setUsername] = useState('@kiky_operator');
  const [cmdError, setCmdError] = useState<string | null>(null);

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setCmdError(null);
    if (!commandInput.trim()) {
      setCmdError('Enter a Telegram bot command (e.g. /dl, /search, /status, /settings).');
      return;
    }
    try {
      await onSendCommand(commandInput.trim(), username.trim() || '@kiky_operator');
    } catch (err: any) {
      setCmdError(err?.message || 'Command execution failed.');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Interactive Async Polling Command Console */}
      <div className="lg:col-span-5 border border-slate-800 bg-slate-900/60 rounded-xl p-6 space-y-5">
        <div>
          <span className="text-xs font-medium text-amber-400">
            Async Long-Polling Simulator (getUpdates)
          </span>
          <h2 className="text-lg font-bold text-slate-100 mt-1">
            Telegram Bot Command Dispatcher
          </h2>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Test incoming Telegram messages against the asynchronous polling router. Valid{' '}
            <code className="text-slate-200">/dl</code> commands immediately create verified{' '}
            <code className="text-slate-200">lucidadl</code> jobs in PostgreSQL and synchronize
            per-user state.
          </p>
        </div>

        <div>
          <span className="block text-xs text-slate-400 mb-2">
            Quick Telegram Bot Commands:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_BOT_COMMANDS.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setCommandInput(item.cmd);
                  setCmdError(null);
                }}
                className="px-2.5 py-1.5 text-xs font-mono text-slate-300 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleDispatch} className="space-y-4">
          <div>
            <label
              htmlFor="tg-username"
              className="block text-xs font-medium text-slate-300 mb-1"
            >
              Simulated Telegram Sender (Chat ID: {user.telegramChatId || '99481024'})
            </label>
            <input
              id="tg-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-mono bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label
              htmlFor="tg-command-input"
              className="block text-xs font-medium text-slate-300 mb-1"
            >
              Telegram Bot Command or Amazon Music URL
            </label>
            <input
              id="tg-command-input"
              type="text"
              value={commandInput}
              onChange={(e) => {
                setCommandInput(e.target.value);
                setCmdError(null);
              }}
              placeholder="/dl https://music.amazon.com/tracks/B08X9K2M1P flac"
              className="w-full px-3 py-2 text-sm font-mono bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          {cmdError && (
            <div role="alert" className="text-xs text-red-400 bg-red-950/40 border border-red-900/60 rounded-lg px-3 py-2">
              {cmdError}
            </div>
          )}

          <button
            type="submit"
            disabled={isSending}
            className="w-full py-2.5 px-4 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isSending ? 'Processing Update...' : 'Send Telegram Update'}</span>
          </button>
        </form>

        <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-1.5">
          <div className="font-semibold text-slate-200">Supported Bot Commands:</div>
          <div className="font-mono text-slate-400 space-y-1">
            <div>/start — Display bot capabilities & worker status</div>
            <div>/dl &lt;ASIN|URL&gt; [flac|mp3|opus|wav] — Enqueue lucidadl task</div>
            <div>/search &lt;query|ASIN&gt; — Resolve ASIN or inspect catalog status</div>
            <div>/status [job_id] — Query active queue or specific job</div>
            <div>/cancel &lt;job_id&gt; — Terminate running lucidadl subprocess</div>
            <div>/settings — View user state persisted in PostgreSQL</div>
          </div>
        </div>
      </div>

      {/* Right Column: Live Telegram Bot Polling Event Log */}
      <div className="lg:col-span-7 border border-slate-800 bg-slate-900/60 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-amber-400" />
            <h3 className="text-base font-semibold text-slate-100">
              Telegram Polling Event Log
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400 tabular-nums">
            {events.length} processed updates
          </span>
        </div>

        <div className="divide-y divide-slate-800/80 max-h-[560px] overflow-y-auto">
          {events.map((ev) => (
            <div key={ev.id} className="p-4 space-y-2 hover:bg-slate-900/90 transition-colors">
              <div className="flex items-center justify-between gap-4 text-xs font-mono tabular-nums">
                <div className="flex items-center gap-2">
                  {ev.status === 'processed' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  )}
                  <span className="text-slate-200 font-semibold">{ev.telegramUsername}</span>
                  <span className="text-slate-500">·</span>
                  <span className="text-slate-400">Chat {ev.chatId}</span>
                </div>
                <span className="text-slate-400">
                  {ev.status.toUpperCase()} · {ev.latencyMs}ms
                </span>
              </div>

              <div className="pl-5 space-y-1.5">
                <div className="text-xs font-mono text-amber-400">
                  &gt; {ev.payload}
                </div>
                <pre className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-300 whitespace-pre-wrap">
                  {ev.responseText}
                </pre>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
