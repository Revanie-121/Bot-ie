import React, { useCallback, useEffect, useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleAuthProvider } from './lib/firebase';
import { DashboardPayload } from './types';
import { OverviewTab } from './components/OverviewTab';
import { DownloadsTab } from './components/DownloadsTab';
import { TelegramBotTab } from './components/TelegramBotTab';
import { ErrorLogsTab } from './components/ErrorLogsTab';
import { ArchitectureTab } from './components/ArchitectureTab';
import { AudioFormat, EntityType } from './utils/sonoraLogic';

type ActiveTab = 'overview' | 'downloads' | 'telegram' | 'logs' | 'architecture';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [authToken, setAuthToken] = useState<string>('');
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState<boolean>(false);

  const fetchDashboard = useCallback(async (tokenToUse: string) => {
    if (!tokenToUse) return;
    try {
      const res = await fetch('/api/dashboard', {
        headers: {
          Authorization: `Bearer ${tokenToUse}`,
        },
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }
      const payload = (await res.json()) as DashboardPayload;
      setData(payload);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to synchronize dashboard state.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize JWT session on mount and poll every 2.5s when active jobs exist
  useEffect(() => {
    let mounted = true;
    async function initSession() {
      try {
        const res = await fetch('/api/auth/jwt/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'kikysenpai27@gmail.com',
            role: 'operator',
          }),
        });
        const sessionData = await res.json();
        if (!mounted) return;
        if (sessionData.access_token) {
          setAuthToken(sessionData.access_token);
          await fetchDashboard(sessionData.access_token);
        } else {
          setError(sessionData.error || 'Failed to initialize JWT session');
          setLoading(false);
        }
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message || 'Failed to connect to backend server');
        setLoading(false);
      }
    }
    initSession();
    return () => {
      mounted = false;
    };
  }, [fetchDashboard]);

  // Real-time progress polling when any job is in an active state
  useEffect(() => {
    if (!authToken || !data) return;
    const hasActive = data.jobs.some((j) =>
      ['queued', 'validating', 'resolving', 'downloading', 'processing'].includes(j.status)
    );
    if (!hasActive) return;

    const timer = setInterval(() => {
      fetchDashboard(authToken);
    }, 1500);
    return () => clearInterval(timer);
  }, [authToken, data, fetchDashboard]);

  const handleDispatchJob = async (payload: {
    entity_type: EntityType;
    asin: string;
    source_url: string;
    metadata: { title: string; artist: string; album: string };
    output_dir: string;
    requested_format: AudioFormat;
  }) => {
    setIsBusy(true);
    try {
      const res = await fetch('/api/downloads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || 'Failed to enqueue download job');
      }
      await fetchDashboard(authToken);
      setActiveTab('downloads');
    } finally {
      setIsBusy(false);
    }
  };

  const handleCancelJob = async (jobUid: string) => {
    const res = await fetch(`/api/downloads/${jobUid}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.ok) {
      await fetchDashboard(authToken);
    }
  };

  const handleRetryJob = async (jobUid: string) => {
    const res = await fetch(`/api/downloads/${jobUid}/retry`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.ok) {
      await fetchDashboard(authToken);
    }
  };

  const handleSendTelegramCommand = async (message: string, username: string) => {
    setIsBusy(true);
    try {
      const res = await fetch('/api/telegram/command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ message, username }),
      });
      const body = await res.json();
      await fetchDashboard(authToken);
      if (!res.ok) {
        throw new Error(body.error || 'Bot command returned an error');
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleToggleLogResolve = async (id: number, resolved: boolean) => {
    const res = await fetch(`/api/logs/${id}/resolve`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ resolved }),
    });
    if (res.ok) {
      await fetchDashboard(authToken);
    }
  };

  const handleRunAiAnalysis = async (query: string, contextLog: string) => {
    const res = await fetch('/api/ai/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ query, contextLog }),
    });
    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.error || 'AI analysis failed');
    }
    return body;
  };

  const handleUpdateSettings = async (updates: {
    preferredFormat: string;
    outputDir: string;
    concurrencyLimit: number;
    telegramChatId: string;
  }) => {
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(updates),
    });
    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.error || 'Failed to update settings');
    }
    await fetchDashboard(authToken);
  };

  const handleRotateJwt = async (email: string, role: string) => {
    const res = await fetch('/api/auth/jwt/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    });
    const body = await res.json();
    if (body.access_token) {
      setAuthToken(body.access_token);
      await fetchDashboard(body.access_token);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await cred.user.getIdToken();
      setAuthToken(idToken);
      await fetchDashboard(idToken);
    } catch (err: any) {
      console.warn('Google Sign-In popup closed or blocked in preview:', err?.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-slate-800 bg-slate-950/90 sticky top-0 z-30 backdrop-blur">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#overview"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('overview');
          }}
          className="text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0"
        >
          Sonora LucidaDL
        </a>

        {/* Zone 2: 5 clean single-line text navigation links */}
        <nav aria-label="Main navigation" className="flex items-center gap-6 text-sm font-medium text-slate-400 overflow-x-auto">
          {(
            [
              { id: 'overview', label: 'Overview' },
              { id: 'downloads', label: 'Downloads' },
              { id: 'telegram', label: 'Telegram Bot' },
              { id: 'logs', label: 'Error Logs' },
              { id: 'architecture', label: 'Architecture' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === item.id
                  ? 'text-slate-100 border-amber-500 font-semibold'
                  : 'text-slate-400 hover:text-slate-100 border-transparent'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('architecture')}
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            FastAPI & JWT Stack
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1360px] w-full mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <div className="space-y-4">
            <div className="h-48 bg-slate-900/60 border border-slate-800 rounded-xl animate-pulse" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="h-24 bg-slate-900/60 border border-slate-800 rounded-xl animate-pulse" />
              <div className="h-24 bg-slate-900/60 border border-slate-800 rounded-xl animate-pulse" />
              <div className="h-24 bg-slate-900/60 border border-slate-800 rounded-xl animate-pulse" />
              <div className="h-24 bg-slate-900/60 border border-slate-800 rounded-xl animate-pulse" />
            </div>
          </div>
        ) : error || !data ? (
          <div className="p-6 border border-red-900/70 bg-red-950/30 rounded-xl space-y-3">
            <h2 className="text-base font-bold text-red-300">
              Backend Synchronization Error
            </h2>
            <p className="text-xs text-red-200 font-mono">{error}</p>
            <button
              type="button"
              onClick={() => fetchDashboard(authToken)}
              className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-500 rounded-lg"
            >
              Retry Synchronization
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <OverviewTab
                data={data}
                onDispatchJob={handleDispatchJob}
                onNavigateTab={setActiveTab}
                isSubmitting={isBusy}
              />
            )}
            {activeTab === 'downloads' && (
              <DownloadsTab
                jobs={data.jobs}
                onCancelJob={handleCancelJob}
                onRetryJob={handleRetryJob}
              />
            )}
            {activeTab === 'telegram' && (
              <TelegramBotTab
                events={data.botEvents}
                user={data.user}
                onSendCommand={handleSendTelegramCommand}
                isSending={isBusy}
              />
            )}
            {activeTab === 'logs' && (
              <ErrorLogsTab
                logs={data.errorLogs}
                onToggleResolve={handleToggleLogResolve}
                onRunAiAnalysis={handleRunAiAnalysis}
              />
            )}
            {activeTab === 'architecture' && (
              <ArchitectureTab
                user={data.user}
                authToken={authToken}
                authMethod={data.authMethod}
                onUpdateSettings={handleUpdateSettings}
                onRotateJwt={handleRotateJwt}
                onGoogleSignIn={handleGoogleSignIn}
              />
            )}
          </>
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-900 px-6 py-4 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-4 max-w-[1360px] w-full mx-auto">
        <span>Sonora Local & Telegram LucidaDL Server · FastAPI 127.0.0.1:8000 · Docker & Ubuntu PRoot</span>
        <span className="font-mono tabular-nums">
          Canonical URL Schema v1 · HS256 JWT + OAuth 2.0
        </span>
      </footer>
    </div>
  );
}
