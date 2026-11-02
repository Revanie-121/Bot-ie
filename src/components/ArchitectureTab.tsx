import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  FileCode2,
  FolderCog,
  KeyRound,
  LogIn,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { UserProfile } from '../types';

interface ArchitectureTabProps {
  user: UserProfile;
  authToken: string;
  authMethod: 'jwt' | 'firebase';
  onUpdateSettings: (updates: {
    preferredFormat: string;
    outputDir: string;
    concurrencyLimit: number;
    telegramChatId: string;
  }) => Promise<void>;
  onRotateJwt: (email: string, role: string) => Promise<void>;
  onGoogleSignIn: () => Promise<void>;
}

interface BackendFile {
  path: string;
  content: string;
}

export function ArchitectureTab({
  user,
  authToken,
  authMethod,
  onUpdateSettings,
  onRotateJwt,
  onGoogleSignIn,
}: ArchitectureTabProps) {
  const [files, setFiles] = useState<BackendFile[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>('sonora_backend/app/main.py');
  const [copiedCode, setCopiedCode] = useState(false);

  // Settings Form State
  const [outputDir, setOutputDir] = useState(user.outputDir || '/sdcard/Music');
  const [preferredFormat, setPreferredFormat] = useState(user.preferredFormat || 'flac');
  const [concurrencyLimit, setConcurrencyLimit] = useState(user.concurrencyLimit || 2);
  const [telegramChatId, setTelegramChatId] = useState(user.telegramChatId || '99481024');
  const [settingsMsg, setSettingsMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // JWT Test Verifier State
  const [jwtVerifyStatus, setJwtVerifyStatus] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/backend-files', {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((r) => r.json())
      .then((res) => {
        if (active && Array.isArray(res.files)) {
          setFiles(res.files);
        }
      })
      .catch((err) => console.error('Failed to load backend files:', err));
    return () => {
      active = false;
    };
  }, [authToken]);

  const currentFile = files.find((f) => f.path === selectedPath) || files[0] || null;

  const handleCopyFile = () => {
    if (!currentFile) return;
    navigator.clipboard.writeText(currentFile.content);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1600);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsMsg(null);
    try {
      await onUpdateSettings({
        preferredFormat,
        outputDir,
        concurrencyLimit: Number(concurrencyLimit) || 2,
        telegramChatId,
      });
      setSettingsMsg({
        type: 'ok',
        text: 'Settings validated and persisted to PostgreSQL.',
      });
    } catch (err: any) {
      setSettingsMsg({
        type: 'err',
        text: err?.message || 'Failed to save settings.',
      });
    }
  };

  const handleVerifyCurrentJwt = async () => {
    const res = await fetch('/api/auth/jwt/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: authToken }),
    });
    const data = await res.json();
    if (data.valid) {
      setJwtVerifyStatus(
        `Verified HS256 Signature · sub=${data.payload.sub} · role=${data.payload.role} · exp=${new Date(
          data.payload.exp * 1000
        ).toISOString()}`
      );
    } else {
      setJwtVerifyStatus(`Token note: ${data.error || 'Using Firebase Auth ID Token'}`);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Row: Storage & Downloader Settings + JWT & Google OAuth Session Security */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 border border-slate-800 bg-slate-900/60 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <FolderCog className="w-4 h-4 text-amber-400" />
            <h2 className="text-base font-bold text-slate-100">
              Storage & LucidaDL Worker Configuration
            </h2>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Paths are validated against permitted Android shared storage roots (
            <code className="text-slate-200">/sdcard/Music</code>,{' '}
            <code className="text-slate-200">/sdcard/Download</code>,{' '}
            <code className="text-slate-200">/app/downloads</code>) and reject traversal sequences.
          </p>

          <form onSubmit={handleSaveSettings} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="setting-output-dir"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Validated Output Directory
                </label>
                <input
                  id="setting-output-dir"
                  type="text"
                  value={outputDir}
                  onChange={(e) => setOutputDir(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-mono bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label
                  htmlFor="setting-format"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Default Audio Format
                </label>
                <select
                  id="setting-format"
                  value={preferredFormat}
                  onChange={(e) => setPreferredFormat(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-mono bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="flac">FLAC (Lossless)</option>
                  <option value="opus">OPUS</option>
                  <option value="mp3">MP3 (320kbps)</option>
                  <option value="wav">WAV (PCM)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="setting-concurrency"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Max Concurrent Workers (1–8)
                </label>
                <input
                  id="setting-concurrency"
                  type="number"
                  min={1}
                  max={8}
                  value={concurrencyLimit}
                  onChange={(e) => setConcurrencyLimit(Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-xs font-mono bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500 tabular-nums"
                />
              </div>

              <div>
                <label
                  htmlFor="setting-chat-id"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Telegram Chat ID
                </label>
                <input
                  id="setting-chat-id"
                  type="text"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-mono bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500 tabular-nums"
                />
              </div>
            </div>

            {settingsMsg && (
              <div
                className={`text-xs px-3 py-2 rounded-lg border ${
                  settingsMsg.type === 'ok'
                    ? 'text-emerald-300 bg-emerald-950/40 border-emerald-800/60'
                    : 'text-red-300 bg-red-950/40 border-red-800/60'
                }`}
              >
                {settingsMsg.text}
              </div>
            )}

            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Save Backend & Storage Settings
            </button>
          </form>
        </div>

        {/* Right Card: JWT Session & Google Sign-In Authentication */}
        <div className="lg:col-span-6 border border-slate-800 bg-slate-900/60 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-400" />
              <h2 className="text-base font-bold text-slate-100">
                JWT Session & OAuth Authentication
              </h2>
            </div>
            <span className="text-xs font-mono text-emerald-400 uppercase">
              Active: {authMethod}
            </span>
          </div>

          <p className="text-xs text-slate-400">
            All API endpoints enforce Bearer token verification via RFC 7519 HS256 JWT or Firebase
            Authentication Google Sign-In.
          </p>

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1 text-xs font-mono">
            <div className="text-slate-400">Active Bearer Token (Truncated):</div>
            <div className="text-slate-200 truncate">{authToken}</div>
          </div>

          {jwtVerifyStatus && (
            <div className="p-2.5 bg-slate-950 border border-emerald-800/60 rounded-lg text-xs font-mono text-emerald-300">
              {jwtVerifyStatus}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleVerifyCurrentJwt}
              className="px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Verify JWT Signature</span>
            </button>

            <button
              type="button"
              onClick={() => onRotateJwt(user.email, 'admin')}
              className="px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg whitespace-nowrap shrink-0"
            >
              Rotate HS256 JWT Token
            </button>

            <button
              type="button"
              onClick={onGoogleSignIn}
              className="px-3.5 py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In with Google</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Section: Complete Browseable Python FastAPI + Docker + Termux PRoot Codebase */}
      <div className="border border-slate-800 bg-slate-900/60 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <FileCode2 className="w-4 h-4 text-amber-400" />
            <div>
              <h2 className="text-base font-bold text-slate-100">
                Sonora Backend Source Code & Docker / Termux PRoot Files (
                <code className="text-amber-400 font-mono text-sm">sonora_backend/</code>)
              </h2>
              <p className="text-xs text-slate-400">
                Complete modular FastAPI, SQLAlchemy PostgreSQL, Async Telegram Polling, LucidaDL
                subprocess wrapper, Dockerfile, and unit test suite
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopyFile}
            className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            {copiedCode ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copiedCode ? 'Copied File' : 'Copy Current File'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12">
          <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-slate-800 p-3 space-y-1 bg-slate-950/60 max-h-[540px] overflow-y-auto">
            {files.map((file) => (
              <button
                key={file.path}
                type="button"
                onClick={() => setSelectedPath(file.path)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono transition-colors truncate ${
                  selectedPath === file.path
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:bg-slate-900'
                }`}
              >
                {file.path}
              </button>
            ))}
          </div>

          <div className="lg:col-span-8 p-4 bg-slate-950">
            {currentFile ? (
              <pre className="text-xs font-mono text-slate-200 overflow-x-auto max-h-[500px] whitespace-pre leading-relaxed">
                {currentFile.content}
              </pre>
            ) : (
              <div className="text-xs text-slate-500 p-6">Loading source files...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
