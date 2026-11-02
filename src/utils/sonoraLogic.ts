import crypto from 'node:crypto';

export type EntityType = 'track' | 'album';
export type AudioFormat = 'flac' | 'mp3' | 'opus' | 'wav';
export type JobStatus =
  | 'queued'
  | 'validating'
  | 'resolving'
  | 'downloading'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface AsinValidationResult {
  valid: boolean;
  asin: string | null;
  entityType: EntityType;
  canonicalUrl: string | null;
  sourceUrl: string | null;
  error?: string;
}

export interface ParsedTelegramCommand {
  valid: boolean;
  command: string;
  args: string[];
  action: 'start' | 'search' | 'download' | 'status' | 'cancel' | 'settings' | 'help' | 'unknown';
  asinOrUrl?: string;
  requestedFormat?: AudioFormat;
  query?: string;
  jobId?: string;
  error?: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  telegramChatId?: string;
  iat: number;
  exp: number;
}

const ASIN_REGEX = /^[A-Z0-9]{10}$/;
const ALLOWED_FORMATS: AudioFormat[] = ['flac', 'mp3', 'opus', 'wav'];
const ALLOWED_OUTPUT_PREFIXES = ['/sdcard/Music', '/sdcard/Download', '/data/data/com.termux/files/home/Music', '/app/downloads'];

/**
 * Validates a raw ASIN or Amazon Music HTTPS URL and normalizes it into
 * the required canonical format:
 * - Track: https://music.amazon.com/tracks/{ASIN}
 * - Album: https://music.amazon.com/albums/{ASIN}
 */
export function validateAndNormalizeAsinInput(
  rawInput: string,
  preferredEntityType: EntityType = 'track'
): AsinValidationResult {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) {
    return {
      valid: false,
      asin: null,
      entityType: preferredEntityType,
      canonicalUrl: null,
      sourceUrl: null,
      error: 'Input cannot be empty. Provide a 10-character ASIN or Amazon Music HTTPS URL.',
    };
  }

  // Case 1: Direct 10-character ASIN
  const upperCandidate = trimmed.toUpperCase();
  if (ASIN_REGEX.test(upperCandidate)) {
    const canonicalUrl = buildCanonicalUrl(upperCandidate, preferredEntityType);
    return {
      valid: true,
      asin: upperCandidate,
      entityType: preferredEntityType,
      canonicalUrl,
      sourceUrl: canonicalUrl,
    };
  }

  // Case 2: URL validation
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      valid: false,
      asin: null,
      entityType: preferredEntityType,
      canonicalUrl: null,
      sourceUrl: null,
      error: 'Invalid ASIN or malformed URL. ASIN must be 10 alphanumeric characters.',
    };
  }

  if (parsed.protocol !== 'https:') {
    return {
      valid: false,
      asin: null,
      entityType: preferredEntityType,
      canonicalUrl: null,
      sourceUrl: null,
      error: 'Only HTTPS scheme is permitted for Amazon Music URLs.',
    };
  }

  const host = parsed.hostname.toLowerCase();
  if (host !== 'music.amazon.com' && !host.endsWith('.music.amazon.com')) {
    return {
      valid: false,
      asin: null,
      entityType: preferredEntityType,
      canonicalUrl: null,
      sourceUrl: null,
      error: `Unsupported host "${parsed.hostname}". Only music.amazon.com is allowed.`,
    };
  }

  // Inspect query param trackAsin first if present (e.g. /albums/B08XXX?trackAsin=B08YYY)
  const trackAsinParam = parsed.searchParams.get('trackAsin')?.toUpperCase();
  if (trackAsinParam && ASIN_REGEX.test(trackAsinParam)) {
    const canonicalUrl = buildCanonicalUrl(trackAsinParam, 'track');
    return {
      valid: true,
      asin: trackAsinParam,
      entityType: 'track',
      canonicalUrl,
      sourceUrl: trimmed,
    };
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length >= 2) {
    const category = segments[0].toLowerCase();
    const rawId = segments[1].toUpperCase();
    if ((category === 'tracks' || category === 'albums') && ASIN_REGEX.test(rawId)) {
      const entityType: EntityType = category === 'albums' ? 'album' : 'track';
      const canonicalUrl = buildCanonicalUrl(rawId, entityType);
      return {
        valid: true,
        asin: rawId,
        entityType,
        canonicalUrl,
        sourceUrl: trimmed,
      };
    }
  }

  return {
    valid: false,
    asin: null,
    entityType: preferredEntityType,
    canonicalUrl: null,
    sourceUrl: null,
    error: 'Unrecognized Amazon Music URL path. Expected /tracks/{ASIN} or /albums/{ASIN}.',
  };
}

export function buildCanonicalUrl(asin: string, entityType: EntityType): string {
  const normalizedAsin = asin.trim().toUpperCase();
  if (!ASIN_REGEX.test(normalizedAsin)) {
    throw new Error(`Invalid ASIN: ${asin}`);
  }
  const segment = entityType === 'album' ? 'albums' : 'tracks';
  return `https://music.amazon.com/${segment}/${normalizedAsin}`;
}

/**
 * Validates output directory against path traversal and permitted prefixes.
 */
export function validateOutputDirectory(rawPath: string): { valid: boolean; normalizedPath: string; error?: string } {
  const trimmed = (rawPath || '').trim();
  if (!trimmed) {
    return { valid: false, normalizedPath: '', error: 'Output directory cannot be empty.' };
  }
  if (trimmed.includes('\0') || trimmed.includes('..') || trimmed.includes(';') || trimmed.includes('|') || trimmed.includes('&')) {
    return {
      valid: false,
      normalizedPath: '',
      error: 'Output directory contains forbidden traversal or shell metacharacters.',
    };
  }
  const cleanPath = trimmed.replace(/\/+$/, '') || '/';
  const isAllowed = ALLOWED_OUTPUT_PREFIXES.some(
    (prefix) => cleanPath === prefix || cleanPath.startsWith(`${prefix}/`)
  );
  if (!isAllowed) {
    return {
      valid: false,
      normalizedPath: cleanPath,
      error: `Output path must be inside an allowed storage root: ${ALLOWED_OUTPUT_PREFIXES.join(', ')}`,
    };
  }
  return { valid: true, normalizedPath: cleanPath };
}

/**
 * Constructs safe, shell-free CLI arguments for lucidadl subprocess execution.
 */
export function buildLucidadlArgs(params: {
  executablePath: string;
  entityType: EntityType;
  sourceUrl: string;
  outputDir: string;
  requestedFormat: AudioFormat;
}): { executable: string; args: string[] } {
  const format: AudioFormat = ALLOWED_FORMATS.includes(params.requestedFormat)
    ? params.requestedFormat
    : 'flac';
  const dirCheck = validateOutputDirectory(params.outputDir);
  if (!dirCheck.valid) {
    throw new Error(dirCheck.error);
  }
  const urlCheck = validateAndNormalizeAsinInput(params.sourceUrl, params.entityType);
  if (!urlCheck.valid || !urlCheck.sourceUrl) {
    throw new Error(urlCheck.error || 'Invalid source URL');
  }

  const subcommand = params.entityType === 'album' ? 'album' : 'track';
  return {
    executable: params.executablePath.trim() || '/usr/local/bin/lucidadl',
    args: [
      subcommand,
      urlCheck.sourceUrl,
      '--output',
      dirCheck.normalizedPath,
      '--format',
      format,
      '--no-tui',
    ],
  };
}

/**
 * Parses incoming Telegram Bot commands for asynchronous polling handler.
 */
export function parseTelegramCommand(rawMessage: string): ParsedTelegramCommand {
  const trimmed = (rawMessage || '').trim();
  if (!trimmed.startsWith('/')) {
    // Check if the user pasted a direct Amazon Music URL or ASIN
    const check = validateAndNormalizeAsinInput(trimmed, 'track');
    if (check.valid && check.canonicalUrl) {
      return {
        valid: true,
        command: '/dl',
        args: [trimmed, 'flac'],
        action: 'download',
        asinOrUrl: trimmed,
        requestedFormat: 'flac',
      };
    }
    return {
      valid: false,
      command: '',
      args: [],
      action: 'unknown',
      error: 'Unrecognized input. Send a command (/search, /dl, /status, /settings) or paste an Amazon Music URL.',
    };
  }

  const parts = trimmed.split(/\s+/);
  const rawCmd = parts[0].split('@')[0].toLowerCase();
  const args = parts.slice(1);

  switch (rawCmd) {
    case '/start':
    case '/help':
      return {
        valid: true,
        command: rawCmd,
        args,
        action: rawCmd === '/start' ? 'start' : 'help',
      };
    case '/search': {
      const query = args.join(' ').trim();
      if (!query) {
        return {
          valid: false,
          command: rawCmd,
          args,
          action: 'search',
          error: 'Usage: /search <artist, track, or album title>',
        };
      }
      return {
        valid: true,
        command: rawCmd,
        args,
        action: 'search',
        query,
      };
    }
    case '/dl':
    case '/download': {
      if (args.length === 0) {
        return {
          valid: false,
          command: rawCmd,
          args,
          action: 'download',
          error: 'Usage: /dl <ASIN or Amazon Music URL> [flac|mp3|opus|wav]',
        };
      }
      const asinOrUrl = args[0];
      const rawFmt = (args[1] || 'flac').toLowerCase() as AudioFormat;
      const requestedFormat: AudioFormat = ALLOWED_FORMATS.includes(rawFmt) ? rawFmt : 'flac';
      return {
        valid: true,
        command: '/dl',
        args,
        action: 'download',
        asinOrUrl,
        requestedFormat,
      };
    }
    case '/status':
      return {
        valid: true,
        command: rawCmd,
        args,
        action: 'status',
        jobId: args[0],
      };
    case '/cancel':
      if (!args[0]) {
        return {
          valid: false,
          command: rawCmd,
          args,
          action: 'cancel',
          error: 'Usage: /cancel <job_id>',
        };
      }
      return {
        valid: true,
        command: rawCmd,
        args,
        action: 'cancel',
        jobId: args[0],
      };
    case '/settings':
      return {
        valid: true,
        command: rawCmd,
        args,
        action: 'settings',
      };
    default:
      return {
        valid: false,
        command: rawCmd,
        args,
        action: 'unknown',
        error: `Unknown command "${rawCmd}". Supported commands: /start, /search, /dl, /status, /cancel, /settings`,
      };
  }
}

/**
 * Signs a stateless RFC 7519 HS256 JWT token for operator/bot session authentication.
 */
export function signJwtToken(
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  secret: string,
  expiresInSeconds = 3600
): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JwtPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signingInput)
    .digest('base64url');
  return `${signingInput}.${signature}`;
}

/**
 * Verifies an HS256 JWT token and checks expiration.
 */
export function verifyJwtToken(
  token: string,
  secret: string
): { valid: boolean; payload?: JwtPayload; error?: string } {
  try {
    const parts = (token || '').trim().split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Malformed JWT structure: expected 3 segments.' };
    }
    const [encodedHeader, encodedPayload, signature] = parts;
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(signingInput)
      .digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return { valid: false, error: 'Invalid JWT signature.' };
    }

    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as JwtPayload;
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === 'number' && payload.exp < now) {
      return { valid: false, error: 'JWT token has expired.' };
    }
    return { valid: true, payload };
  } catch (err: any) {
    return { valid: false, error: err?.message || 'Failed to decode JWT.' };
  }
}

/**
 * Computes real-time queue and worker telemetry metrics from job records.
 */
export function computeQueueMetrics(jobs: Array<{ status: string; requestedFormat: string; entityType: string }>) {
  const counts = {
    total: jobs.length,
    active: 0,
    queued: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    tracks: 0,
    albums: 0,
    formats: { flac: 0, mp3: 0, opus: 0, wav: 0 } as Record<string, number>,
  };

  for (const job of jobs) {
    if (job.status === 'downloading' || job.status === 'processing' || job.status === 'resolving' || job.status === 'validating') {
      counts.active += 1;
    } else if (job.status === 'queued') {
      counts.queued += 1;
    } else if (job.status === 'completed') {
      counts.completed += 1;
    } else if (job.status === 'failed') {
      counts.failed += 1;
    } else if (job.status === 'cancelled') {
      counts.cancelled += 1;
    }

    if (job.entityType === 'album') {
      counts.albums += 1;
    } else {
      counts.tracks += 1;
    }

    const fmt = (job.requestedFormat || 'flac').toLowerCase();
    counts.formats[fmt] = (counts.formats[fmt] || 0) + 1;
  }

  const finishedCount = counts.completed + counts.failed;
  const successRate = finishedCount > 0 ? Math.round((counts.completed / finishedCount) * 100) : 100;

  return {
    ...counts,
    successRate,
  };
}
