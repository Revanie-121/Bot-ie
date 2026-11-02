import React, { useState } from 'react';
import {
  Check,
  Copy,
  FileAudio,
  FolderOpen,
  RotateCcw,
  Search,
  Terminal,
  XCircle,
} from 'lucide-react';
import { DownloadJob } from '../types';

interface DownloadsTabProps {
  jobs: DownloadJob[];
  onCancelJob: (jobUid: string) => Promise<void>;
  onRetryJob: (jobUid: string) => Promise<void>;
}

type FilterStatus = 'all' | 'active' | 'queued' | 'completed' | 'failed';

export function DownloadsTab({ jobs, onCancelJob, onRetryJob }: DownloadsTabProps) {
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJobUid, setSelectedJobUid] = useState<string>(jobs[0]?.jobUid || '');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      !searchQuery.trim() ||
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.asin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.jobUid.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filter === 'all') return true;
    if (filter === 'active') {
      return ['downloading', 'processing', 'resolving', 'validating'].includes(job.status);
    }
    if (filter === 'queued') return job.status === 'queued';
    if (filter === 'completed') return job.status === 'completed';
    if (filter === 'failed') return job.status === 'failed' || job.status === 'cancelled';
    return true;
  });

  const selectedJob =
    jobs.find((j) => j.jobUid === selectedJobUid) || filteredJobs[0] || null;

  const handleCopy = (label: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 1600);
  };

  return (
    <div className="space-y-6">
      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-slate-800 bg-slate-900/60 rounded-xl p-4">
        <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg overflow-x-auto">
          {(
            [
              { id: 'all', label: `All Jobs (${jobs.length})` },
              {
                id: 'active',
                label: `Active (${
                  jobs.filter((j) =>
                    ['downloading', 'processing', 'resolving', 'validating'].includes(j.status)
                  ).length
                })`,
              },
              {
                id: 'queued',
                label: `Queue (${jobs.filter((j) => j.status === 'queued').length})`,
              },
              {
                id: 'completed',
                label: `Completed (${jobs.filter((j) => j.status === 'completed').length})`,
              },
              {
                id: 'failed',
                label: `Failed / Cancelled (${
                  jobs.filter((j) => j.status === 'failed' || j.status === 'cancelled').length
                })`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                filter === tab.id
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            aria-label="Filter jobs by ASIN, title, or job ID"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by ASIN, title, or job_id..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
          />
        </div>
      </div>

      {/* Main Split: High-Density Jobs Table + Detailed Subprocess Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 border border-slate-800 bg-slate-900/60 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-100">
              LucidaDL Job Queue & History
            </h2>
            <span className="text-xs text-slate-400 font-mono tabular-nums">
              Showing {filteredJobs.length} of {jobs.length} records
            </span>
          </div>

          {filteredJobs.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-sm text-slate-300 font-medium">
                No download jobs match the selected filter.
              </p>
              <p className="text-xs text-slate-500">
                Reset the filter above or enqueue a new ASIN task from the Overview tab.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {filteredJobs.map((job) => {
                const isSelected = selectedJob?.jobUid === job.jobUid;
                const isActive = [
                  'queued',
                  'validating',
                  'resolving',
                  'downloading',
                  'processing',
                ].includes(job.status);

                return (
                  <div
                    key={job.jobUid}
                    className={`p-4 transition-colors ${
                      isSelected ? 'bg-slate-800/60' : 'hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <button
                        type="button"
                        onClick={() => setSelectedJobUid(job.jobUid)}
                        className="text-left min-w-0 flex-1 focus:outline-none"
                      >
                        <div className="text-sm font-semibold text-slate-100 truncate">
                          {job.artist} — {job.title}
                        </div>
                        <div className="mt-1 text-xs text-slate-400 font-mono tabular-nums">
                          {job.jobUid} · {job.entityType.toUpperCase()} · ASIN {job.asin} ·{' '}
                          {job.requestedFormat.toUpperCase()} · {job.audioQuality || 'Lossless'}
                        </div>
                        <div className="mt-1.5 text-xs text-slate-300">{job.message}</div>
                      </button>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span
                          className={`text-xs font-mono font-semibold uppercase tabular-nums ${
                            job.status === 'completed'
                              ? 'text-emerald-400'
                              : job.status === 'failed'
                              ? 'text-red-400'
                              : job.status === 'cancelled'
                              ? 'text-slate-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {job.status}
                          {job.progress !== null ? ` · ${job.progress}%` : ''}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedJobUid(job.jobUid)}
                            className="px-2.5 py-1 text-xs font-medium text-slate-300 bg-slate-950 hover:bg-slate-800 border border-slate-700 rounded-md whitespace-nowrap shrink-0"
                          >
                            Inspect Logs
                          </button>

                          {isActive && (
                            <button
                              type="button"
                              onClick={() => onCancelJob(job.jobUid)}
                              aria-label={`Cancel job ${job.jobUid}`}
                              className="px-2.5 py-1 text-xs font-medium text-red-300 bg-red-950/50 hover:bg-red-900/60 border border-red-800/70 rounded-md flex items-center gap-1 whitespace-nowrap shrink-0"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Cancel</span>
                            </button>
                          )}

                          {(job.status === 'failed' || job.status === 'cancelled') && (
                            <button
                              type="button"
                              onClick={() => onRetryJob(job.jobUid)}
                              aria-label={`Retry job ${job.jobUid}`}
                              className="px-2.5 py-1 text-xs font-medium text-amber-300 bg-amber-950/50 hover:bg-amber-900/60 border border-amber-800/70 rounded-md flex items-center gap-1 whitespace-nowrap shrink-0"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Retry</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Real numeric progress bar only when available */}
                    {job.progress !== null && (
                      <div className="mt-3 w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className={`h-full transition-all duration-200 ${
                            job.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, job.progress))}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Selected Job Subprocess & File Output Inspector */}
        <div className="lg:col-span-5 border border-slate-800 bg-slate-900/60 rounded-xl p-5 space-y-4">
          {selectedJob ? (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <span className="text-xs font-mono text-amber-400">
                    Job Inspector · {selectedJob.jobUid}
                  </span>
                  <h3 className="text-base font-bold text-slate-100 mt-0.5">
                    {selectedJob.artist} — {selectedJob.title}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Album: {selectedJob.album} · Format: {selectedJob.requestedFormat.toUpperCase()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy('asin', selectedJob.asin)}
                  className="px-2.5 py-1 text-xs font-mono text-slate-300 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-md flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  {copiedField === 'asin' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>ASIN: {selectedJob.asin}</span>
                </button>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Canonical App URL:</span>
                    <button
                      type="button"
                      onClick={() => handleCopy('canonical', selectedJob.canonicalUrl)}
                      className="text-amber-400 hover:underline"
                    >
                      {copiedField === 'canonical' ? 'Copied' : 'Copy URL'}
                    </button>
                  </div>
                  <div className="text-slate-200 break-all">{selectedJob.canonicalUrl}</div>
                </div>

                <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
                  <div className="text-slate-400">Verified Upstream Source URL:</div>
                  <div className="text-slate-300 break-all">{selectedJob.sourceUrl}</div>
                </div>

                <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="flex items-center gap-1">
                      <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                      <span>Output Directory & Verified Files ({selectedJob.outputFilesList.length}):</span>
                    </span>
                    {selectedJob.outputFilesList[0] && (
                      <button
                        type="button"
                        onClick={() => handleCopy('path', selectedJob.outputFilesList[0])}
                        className="text-amber-400 hover:underline"
                      >
                        {copiedField === 'path' ? 'Copied Path' : 'Copy Path'}
                      </button>
                    )}
                  </div>
                  {selectedJob.outputFilesList.length > 0 ? (
                    <ul className="space-y-1 text-emerald-400 pt-1">
                      {selectedJob.outputFilesList.map((file) => (
                        <li key={file} className="flex items-start gap-1.5 break-all">
                          <FileAudio className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{file}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-slate-500">
                      No verified output files written yet (Directory: {selectedJob.outputDir})
                    </div>
                  )}
                </div>
              </div>

              {selectedJob.errorSummary && (
                <div className="p-3 bg-red-950/40 border border-red-900/70 rounded-lg text-xs text-red-300 font-mono">
                  <div className="font-semibold text-red-400 mb-1">Subprocess Error Summary:</div>
                  {selectedJob.errorSummary}
                </div>
              )}

              <div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
                  <Terminal className="w-3.5 h-3.5 text-amber-400" />
                  <span>LucidaDL Subprocess stdout / stderr Stream</span>
                </div>
                <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-300 overflow-x-auto max-h-56 whitespace-pre-wrap">
                  {selectedJob.stdoutLogs || '[Waiting for subprocess output...]'}
                  {selectedJob.stderrLogs ? `\n--- STDERR ---\n${selectedJob.stderrLogs}` : ''}
                </pre>
              </div>
            </>
          ) : (
            <div className="text-xs text-slate-400 py-8 text-center">
              Select a job from the queue to inspect its canonical URL, output files, and CLI logs.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
