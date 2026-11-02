import React, { useState } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  Copy,
  Check,
  Disc,
  Download,
  FolderCheck,
  Music,
  RefreshCw,
  Search,
  Terminal,
  AlertTriangle,
} from 'lucide-react';
import { DashboardPayload, DownloadJob } from '../types';
import { validateAndNormalizeAsinInput, EntityType, AudioFormat } from '../utils/sonoraLogic';

interface OverviewTabProps {
  data: DashboardPayload;
  onDispatchJob: (payload: {
    entity_type: EntityType;
    asin: string;
    source_url: string;
    metadata: { title: string; artist: string; album: string };
    output_dir: string;
    requested_format: AudioFormat;
  }) => Promise<void>;
  onNavigateTab: (tab: 'overview' | 'downloads' | 'telegram' | 'logs' | 'architecture') => void;
  isSubmitting: boolean;
}

const VERIFIED_PRESETS = [
  {
    label: 'Track: Boards of Canada — Roygbiv',
    asin: 'B08X9K2M1P',
    entityType: 'track' as EntityType,
    sourceUrl: 'https://music.amazon.com/tracks/B08X9K2M1P',
    title: 'Roygbiv (2024 Remaster)',
    artist: 'Boards of Canada',
    album: 'Music Has the Right to Children',
  },
  {
    label: 'Album: Autechre — Amber',
    asin: 'B09K4T8W2N',
    entityType: 'album' as EntityType,
    sourceUrl: 'https://music.amazon.com/albums/B09K4T8W2N',
    title: 'Amber',
    artist: 'Autechre',
    album: 'Amber (Warp Records)',
  },
  {
    label: 'Track (Album Query URL): Burial — Archangel',
    asin: 'B07T5M3R8L',
    entityType: 'track' as EntityType,
    sourceUrl: 'https://music.amazon.com/albums/B07ALBUM99?trackAsin=B07T5M3R8L',
    title: 'Archangel',
    artist: 'Burial',
    album: 'Untrue',
  },
];

export function OverviewTab({
  data,
  onDispatchJob,
  onNavigateTab,
  isSubmitting,
}: OverviewTabProps) {
  const [rawInput, setRawInput] = useState('https://music.amazon.com/tracks/B08X9K2M1P');
  const [entityType, setEntityType] = useState<EntityType>('track');
  const [format, setFormat] = useState<AudioFormat>(
    (data.user.preferredFormat as AudioFormat) || 'flac'
  );
  const [title, setTitle] = useState('Roygbiv (2024 Remaster)');
  const [artist, setArtist] = useState('Boards of Canada');
  const [album, setAlbum] = useState('Music Has the Right to Children');
  const [formError, setFormError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [bannerFailed, setBannerFailed] = useState(false);

  const liveValidation = validateAndNormalizeAsinInput(rawInput, entityType);

  const handlePresetClick = (preset: (typeof VERIFIED_PRESETS)[number]) => {
    setRawInput(preset.sourceUrl);
    setEntityType(preset.entityType);
    setTitle(preset.title);
    setArtist(preset.artist);
    setAlbum(preset.album);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const check = validateAndNormalizeAsinInput(rawInput, entityType);
    if (!check.valid || !check.asin || !check.sourceUrl) {
      setFormError(check.error || 'Enter a valid 10-character ASIN or Amazon Music HTTPS URL.');
      return;
    }
    if (!title.trim() || !artist.trim()) {
      setFormError('Title and Artist fields are required for metadata tagging.');
      return;
    }

    try {
      await onDispatchJob({
        entity_type: check.entityType,
        asin: check.asin,
        source_url: check.sourceUrl,
        metadata: {
          title: title.trim(),
          artist: artist.trim(),
          album: album.trim() || 'Single',
        },
        output_dir: data.user.outputDir,
        requested_format: format,
      });
    } catch (err: any) {
      setFormError(err?.message || 'Failed to enqueue job.');
    }
  };

  const copyCanonical = () => {
    if (!liveValidation.canonicalUrl) return;
    navigator.clipboard.writeText(liveValidation.canonicalUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 1800);
  };

  return (
    <div className="space-y-8">
      {/* 2-Column Hero Split: ASIN / LucidaDL Task Dispatcher + Audio Server Visual */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 border border-slate-800 bg-slate-900/70 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4 mb-3">
              <span className="text-xs font-medium text-amber-400 tracking-wide">
                01. Amazon Music ASIN & Canonical URL Dispatcher
              </span>
              <span className="text-xs text-slate-400 font-mono tabular-nums">
                Target: {data.diagnostics.fastapiBind} · {data.user.outputDir}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight text-balance">
              Dispatch Lossless Audio Tasks to LucidaDL
            </h1>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed max-w-2xl">
              Validate 10-character Amazon Music ASINs or full URLs, normalize canonical{' '}
              <code className="text-slate-200">/tracks/&#123;ASIN&#125;</code> and{' '}
              <code className="text-slate-200">/albums/&#123;ASIN&#125;</code> links while preserving upstream{' '}
              <code className="text-slate-200">source_url</code>, and execute non-interactive{' '}
              <code className="text-slate-200">lucidadl</code> workers.
            </p>

            {/* Quick Verified Presets */}
            <div className="mt-4">
              <span className="block text-xs text-slate-400 mb-2">
                Load verified ASIN test payload:
              </span>
              <div className="flex flex-wrap gap-2">
                {VERIFIED_PRESETS.map((preset) => (
                  <button
                    key={preset.asin}
                    type="button"
                    onClick={() => handlePresetClick(preset)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-7">
                  <label
                    htmlFor="asin-url-input"
                    className="block text-xs font-medium text-slate-300 mb-1.5"
                  >
                    Amazon Music HTTPS URL or 10-Char ASIN
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="asin-url-input"
                      type="text"
                      value={rawInput}
                      onChange={(e) => {
                        setRawInput(e.target.value);
                        setFormError(null);
                      }}
                      placeholder="B08X9K2M1P or https://music.amazon.com/tracks/B08X9K2M1P"
                      className="w-full pl-9 pr-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Entity Type
                  </label>
                  <div className="grid grid-cols-2 gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setEntityType('track')}
                      className={`py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        entityType === 'track'
                          ? 'bg-amber-500 text-slate-950 font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Track
                    </button>
                    <button
                      type="button"
                      onClick={() => setEntityType('album')}
                      className={`py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        entityType === 'album'
                          ? 'bg-amber-500 text-slate-950 font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Album
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="format-select"
                    className="block text-xs font-medium text-slate-300 mb-1.5"
                  >
                    Format
                  </label>
                  <select
                    id="format-select"
                    value={format}
                    onChange={(e) => setFormat(e.target.value as AudioFormat)}
                    className="w-full px-2.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                  >
                    <option value="flac">FLAC</option>
                    <option value="opus">OPUS</option>
                    <option value="mp3">MP3</option>
                    <option value="wav">WAV</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="meta-title"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Track / Album Title
                  </label>
                  <input
                    id="meta-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="meta-artist"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Artist Name
                  </label>
                  <input
                    id="meta-artist"
                    type="text"
                    value={artist}
                    onChange={(e) => setArtist(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="meta-album"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Album Name
                  </label>
                  <input
                    id="meta-album"
                    type="text"
                    value={album}
                    onChange={(e) => setAlbum(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Canonical URL Resolution Preview Bar */}
              <div className="p-3 bg-slate-950 border border-slate-800/90 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="text-xs font-mono space-y-0.5 overflow-hidden">
                  {liveValidation.valid ? (
                    <>
                      <div className="text-slate-400 truncate">
                        ASIN: <span className="text-emerald-400 font-semibold">{liveValidation.asin}</span>
                        {' · '}
                        Type: <span className="text-slate-200 uppercase">{liveValidation.entityType}</span>
                        {' · '}
                        Canonical:{' '}
                        <span className="text-amber-300">{liveValidation.canonicalUrl}</span>
                      </div>
                      <div className="text-slate-500 truncate">
                        CLI: {data.diagnostics.lucidadlExecutable} {liveValidation.entityType}{' '}
                        {liveValidation.sourceUrl} --output {data.user.outputDir} --format {format}
                      </div>
                    </>
                  ) : (
                    <div className="text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{liveValidation.error}</span>
                    </div>
                  )}
                </div>
                {liveValidation.valid && (
                  <button
                    type="button"
                    onClick={copyCanonical}
                    className="px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 border border-slate-800 rounded-md flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedUrl ? 'Copied URL' : 'Copy Canonical'}</span>
                  </button>
                )}
              </div>

              {formError && (
                <div role="alert" className="text-xs text-red-400 bg-red-950/40 border border-red-900/60 rounded-lg px-3 py-2">
                  {formError}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <span className="text-xs text-slate-400">
                  Output destination: <code className="text-slate-200">{data.user.outputDir}</code>
                </span>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>{isSubmitting ? 'Dispatching to LucidaDL...' : 'Enqueue LucidaDL Task'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Hardware / Pipeline Telemetry Card */}
        <div className="lg:col-span-5 border border-slate-800 bg-slate-900/70 rounded-xl overflow-hidden flex flex-col justify-between">
          <div className="relative h-48 sm:h-56 w-full bg-slate-950 overflow-hidden">
            {!bannerFailed ? (
              <img
                src="/src/assets/images/banner_audio_pipeline_1793557538444.jpg"
                alt="Sonora LucidaDL High-Precision Audio Pipeline Rack"
                referrerPolicy="no-referrer"
                onError={() => setBannerFailed(true)}
                className="w-full h-full object-cover opacity-90"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-950 to-amber-950/30 flex items-center justify-center">
                <Disc className="w-12 h-12 text-amber-400/60" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent" />
            <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
              <div>
                <div className="text-xs font-medium text-amber-400">
                  Ubuntu PRoot & Docker Worker Runtime
                </div>
                <div className="text-base font-bold text-white">
                  Async Subprocess & Telegram Bot Bridge
                </div>
              </div>
              <span className="text-xs font-mono text-emerald-400 tabular-nums">
                127.0.0.1:8000
              </span>
            </div>
          </div>

          <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">LucidaDL CLI Binary</span>
                <span className="font-mono text-slate-200">{data.diagnostics.lucidadlExecutable}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">Telegram Bot Mode</span>
                <span className="font-mono text-slate-200">{data.diagnostics.telegramPollingMode}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">Android Shared Storage Mount</span>
                <span className="font-mono text-emerald-400">
                  {data.diagnostics.storagePath} (Writable)
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-400">Session Auth Protocol</span>
                <span className="font-mono text-slate-200 uppercase">
                  {data.authMethod} Bearer Verified
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => onNavigateTab('telegram')}
                className="flex-1 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Terminal className="w-3.5 h-3.5 text-amber-400" />
                <span>Open Telegram Bot Console</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('architecture')}
                className="px-3 py-2 text-xs font-medium text-slate-300 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <span>FastAPI & Docker Stack</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Full-Width 4-Column KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="border border-slate-800 bg-slate-900/60 rounded-xl p-5">
          <div className="text-xs text-slate-400">Total Dispatched Jobs</div>
          <div className="mt-2 text-3xl font-bold text-slate-100 font-mono tabular-nums">
            {data.metrics.total}
          </div>
          <div className="mt-1 text-xs text-slate-400 font-mono tabular-nums">
            {data.metrics.tracks} tracks · {data.metrics.albums} albums
          </div>
        </div>

        <div className="border border-slate-800 bg-slate-900/60 rounded-xl p-5">
          <div className="text-xs text-slate-400">Active LucidaDL Workers</div>
          <div className="mt-2 text-3xl font-bold text-amber-400 font-mono tabular-nums">
            {data.metrics.active}
          </div>
          <div className="mt-1 text-xs text-slate-400 font-mono tabular-nums">
            Concurrency limit: {data.user.concurrencyLimit} processes
          </div>
        </div>

        <div className="border border-slate-800 bg-slate-900/60 rounded-xl p-5">
          <div className="text-xs text-slate-400">Verified Completed Outputs</div>
          <div className="mt-2 text-3xl font-bold text-emerald-400 font-mono tabular-nums">
            {data.metrics.completed}
          </div>
          <div className="mt-1 text-xs text-slate-400 font-mono tabular-nums">
            Success rate: {data.metrics.successRate}%
          </div>
        </div>

        <div className="border border-slate-800 bg-slate-900/60 rounded-xl p-5">
          <div className="text-xs text-slate-400">Telegram Polling Events</div>
          <div className="mt-2 text-3xl font-bold text-slate-100 font-mono tabular-nums">
            {data.botEvents.length}
          </div>
          <div className="mt-1 text-xs text-slate-400 font-mono tabular-nums">
            {data.errorLogs.filter((l) => !l.resolved).length} unresolved error logs
          </div>
        </div>
      </section>

      {/* Recent Tasks & Telegram Bot Activity Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 border border-slate-800 bg-slate-900/60 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">
                02. Recent LucidaDL Task Queue
              </h2>
              <p className="text-xs text-slate-400">
                Live subprocess status, canonical ASIN URLs, and verified storage outputs
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('downloads')}
              className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-950 border border-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              View All Jobs ({data.jobs.length})
            </button>
          </div>

          <div className="divide-y divide-slate-800/80">
            {data.jobs.slice(0, 4).map((job: DownloadJob) => (
              <div key={job.jobUid} className="py-3.5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-100 truncate">
                      {job.artist} — {job.title}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-400 font-mono tabular-nums truncate">
                    {job.jobUid} · {job.entityType.toUpperCase()} · {job.asin} ·{' '}
                    {job.requestedFormat.toUpperCase()} · {job.outputDir}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div
                    className={`text-xs font-mono font-semibold uppercase tabular-nums ${
                      job.status === 'completed'
                        ? 'text-emerald-400'
                        : job.status === 'failed'
                        ? 'text-red-400'
                        : job.status === 'cancelled'
                        ? 'text-slate-500'
                        : 'text-amber-400'
                    }`}
                  >
                    {job.status}
                    {job.progress !== null ? ` (${job.progress}%)` : ''}
                  </div>
                  <div className="text-xs text-slate-500 font-mono tabular-nums">
                    {job.outputFilesList.length} file(s)
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 border border-slate-800 bg-slate-900/60 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">
                03. Recent Telegram Bot Updates
              </h2>
              <p className="text-xs text-slate-400">
                Asynchronous Long-Polling command stream
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('telegram')}
              className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-950 border border-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Send Bot Command
            </button>
          </div>

          <div className="divide-y divide-slate-800/80">
            {data.botEvents.slice(0, 4).map((ev) => (
              <div key={ev.id} className="py-3 space-y-1">
                <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                  <span className="text-amber-400 font-medium">{ev.payload}</span>
                  <span className="text-slate-400">
                    {ev.telegramUsername} · {ev.latencyMs}ms
                  </span>
                </div>
                <p className="text-xs text-slate-300 line-clamp-2 font-mono">
                  {ev.responseText}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
