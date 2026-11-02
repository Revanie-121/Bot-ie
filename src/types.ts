export interface UserProfile {
  id: number;
  uid: string;
  email: string;
  telegramChatId: string | null;
  role: string;
  preferredFormat: string;
  outputDir: string;
  concurrencyLimit: number;
}

export interface DownloadJob {
  id: number;
  jobUid: string;
  userUid: string;
  entityType: 'track' | 'album';
  asin: string;
  canonicalUrl: string;
  sourceUrl: string;
  title: string;
  artist: string;
  album: string;
  artworkUrl?: string | null;
  durationSeconds?: number | null;
  releaseDate?: string | null;
  audioQuality?: string | null;
  outputDir: string;
  requestedFormat: 'flac' | 'mp3' | 'opus' | 'wav';
  status:
    | 'queued'
    | 'validating'
    | 'resolving'
    | 'downloading'
    | 'processing'
    | 'completed'
    | 'failed'
    | 'cancelled';
  progress: number | null;
  message: string;
  outputFiles: string;
  outputFilesList: string[];
  stdoutLogs: string;
  stderrLogs: string;
  errorSummary?: string | null;
  telegramChatId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BotEvent {
  id: number;
  userUid: string;
  telegramUsername: string;
  chatId: string;
  command: string;
  payload: string;
  responseText: string;
  status: string;
  latencyMs: number;
  createdAt: string;
}

export interface ErrorLogEntry {
  id: number;
  module: string;
  severity: 'ERROR' | 'WARNING' | 'CRITICAL';
  errorCode: string;
  message: string;
  stackTrace: string;
  jobUid: string | null;
  resolved: boolean;
  createdAt: string;
}

export interface QueueMetrics {
  total: number;
  active: number;
  queued: number;
  completed: number;
  failed: number;
  cancelled: number;
  tracks: number;
  albums: number;
  formats: Record<string, number>;
  successRate: number;
}

export interface DashboardPayload {
  user: UserProfile;
  authMethod: 'jwt' | 'firebase';
  metrics: QueueMetrics;
  jobs: DownloadJob[];
  botEvents: BotEvent[];
  errorLogs: ErrorLogEntry[];
  diagnostics: {
    fastapiBind: string;
    lucidadlExecutable: string;
    ffmpegAvailable: boolean;
    storagePath: string;
    storageWritable: boolean;
    prootSharedStorageBound: boolean;
    telegramPollingMode: string;
    metadataProviderConfigured: boolean;
  };
}
