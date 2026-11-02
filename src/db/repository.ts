import { desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { users, downloadJobs, botEvents, errorLogs } from './schema.ts';

async function withDbRetry<T>(operation: () => Promise<T>, retries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (err: any) {
      lastError = err;
      const msg = String(err?.message || err?.cause?.message || '');
      const isTransient =
        msg.includes('Connection terminated') ||
        msg.includes('ECONNRESET') ||
        msg.includes('Client has encountered a connection error') ||
        msg.includes('terminating connection');
      if (!isTransient || attempt === retries) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    }
  }
  throw lastError;
}

export async function getOrCreateUser(
  uid: string,
  email: string,
  telegramChatId?: string
) {
  try {
    const result = await withDbRetry(() =>
      db
        .insert(users)
        .values({
          uid,
          email,
          telegramChatId: telegramChatId || '99481024',
          role: 'operator',
          preferredFormat: 'flac',
          outputDir: '/sdcard/Music',
          concurrencyLimit: 2,
        })
        .onConflictDoUpdate({
          target: users.uid,
          set: {
            email,
          },
        })
        .returning()
    );

    return result[0];
  } catch (error) {
    console.error('Database user upsert failed:', error);
    throw new Error('Failed to synchronize user record in PostgreSQL.', { cause: error });
  }
}

export async function updateUserSettings(
  uid: string,
  updates: { preferredFormat?: string; outputDir?: string; concurrencyLimit?: number; telegramChatId?: string }
) {
  try {
    const result = await withDbRetry(() =>
      db
        .update(users)
        .set(updates)
        .where(eq(users.uid, uid))
        .returning()
    );
    return result[0];
  } catch (error) {
    console.error('Database user settings update failed:', error);
    throw new Error('Failed to update user settings in PostgreSQL.', { cause: error });
  }
}

export async function listDownloadJobs() {
  try {
    return await withDbRetry(() =>
      db.select().from(downloadJobs).orderBy(desc(downloadJobs.id))
    );
  } catch (error) {
    console.error('Database query listDownloadJobs failed:', error);
    throw new Error('Failed to load download jobs from PostgreSQL.', { cause: error });
  }
}

export async function getDownloadJobByUid(jobUid: string) {
  try {
    const rows = await withDbRetry(() =>
      db
        .select()
        .from(downloadJobs)
        .where(eq(downloadJobs.jobUid, jobUid))
    );
    return rows[0] || null;
  } catch (error) {
    console.error('Database query getDownloadJobByUid failed:', error);
    throw new Error('Failed to fetch download job details.', { cause: error });
  }
}

export async function createDownloadJobRecord(data: typeof downloadJobs.$inferInsert) {
  try {
    const result = await withDbRetry(() =>
      db.insert(downloadJobs).values(data).returning()
    );
    return result[0];
  } catch (error) {
    console.error('Database insert createDownloadJobRecord failed:', error);
    throw new Error('Failed to persist download job in PostgreSQL.', { cause: error });
  }
}

export async function updateDownloadJobRecord(
  jobUid: string,
  updates: Partial<typeof downloadJobs.$inferInsert>
) {
  try {
    const result = await withDbRetry(() =>
      db
        .update(downloadJobs)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(downloadJobs.jobUid, jobUid))
        .returning()
    );
    return result[0] || null;
  } catch (error) {
    console.error('Database updateDownloadJobRecord failed:', error);
    throw new Error('Failed to update download job state in PostgreSQL.', { cause: error });
  }
}

export async function listBotEvents() {
  try {
    return await withDbRetry(() =>
      db.select().from(botEvents).orderBy(desc(botEvents.id))
    );
  } catch (error) {
    console.error('Database listBotEvents failed:', error);
    throw new Error('Failed to load Telegram bot polling events.', { cause: error });
  }
}

export async function createBotEventRecord(data: typeof botEvents.$inferInsert) {
  try {
    const result = await withDbRetry(() =>
      db.insert(botEvents).values(data).returning()
    );
    return result[0];
  } catch (error) {
    console.error('Database createBotEventRecord failed:', error);
    throw new Error('Failed to record Telegram bot event.', { cause: error });
  }
}

export async function listErrorLogs() {
  try {
    return await withDbRetry(() =>
      db.select().from(errorLogs).orderBy(desc(errorLogs.id))
    );
  } catch (error) {
    console.error('Database listErrorLogs failed:', error);
    throw new Error('Failed to load error logs from PostgreSQL.', { cause: error });
  }
}

export async function createErrorLogRecord(data: typeof errorLogs.$inferInsert) {
  try {
    const result = await withDbRetry(() =>
      db.insert(errorLogs).values(data).returning()
    );
    return result[0];
  } catch (error) {
    console.error('Database createErrorLogRecord failed:', error);
    throw new Error('Failed to write error log entry.', { cause: error });
  }
}

export async function toggleErrorLogResolved(id: number, resolved: boolean) {
  try {
    const result = await withDbRetry(() =>
      db
        .update(errorLogs)
        .set({ resolved })
        .where(eq(errorLogs.id, id))
        .returning()
    );
    return result[0] || null;
  } catch (error) {
    console.error('Database toggleErrorLogResolved failed:', error);
    throw new Error('Failed to update error log resolution state.', { cause: error });
  }
}

let seeded = false;
export async function ensureInitialSeedData(defaultUserUid: string, defaultEmail: string) {
  if (seeded) return;
  try {
    await getOrCreateUser(defaultUserUid, defaultEmail, '99481024');
    const existingJobs = await listDownloadJobs();
    if (existingJobs.length === 0) {
      await createDownloadJobRecord({
        jobUid: 'job_904a1b',
        userUid: defaultUserUid,
        entityType: 'track',
        asin: 'B08X9K2M1P',
        canonicalUrl: 'https://music.amazon.com/tracks/B08X9K2M1P',
        sourceUrl: 'https://music.amazon.com/albums/B08ALBUM01?trackAsin=B08X9K2M1P',
        title: 'Roygbiv (2024 Remaster)',
        artist: 'Boards of Canada',
        album: 'Music Has the Right to Children',
        durationSeconds: 149,
        releaseDate: '1998-04-20',
        audioQuality: '24-bit / 96 kHz Ultra HD FLAC',
        outputDir: '/sdcard/Music',
        requestedFormat: 'flac',
        status: 'completed',
        progress: 100,
        message: 'Verified output file checksum and tags via lucidadl',
        outputFiles: JSON.stringify([
          '/sdcard/Music/Boards of Canada - Roygbiv (2024 Remaster).flac',
        ]),
        stdoutLogs:
          '[lucidadl] Resolving ASIN B08X9K2M1P via Amazon Music stream manifest\n[lucidadl] Stream negotiated: 24-bit/96kHz FLAC (lossless)\n[lucidadl] Downloading segments: 100%\n[lucidadl] Embedding Vorbis comments & 1200x1200 cover artwork\n[lucidadl] Completed -> /sdcard/Music/Boards of Canada - Roygbiv (2024 Remaster).flac',
        stderrLogs: '',
        telegramChatId: '99481024',
      });

      await createDownloadJobRecord({
        jobUid: 'job_712c8e',
        userUid: defaultUserUid,
        entityType: 'album',
        asin: 'B09M7F4L2Q',
        canonicalUrl: 'https://music.amazon.com/albums/B09M7F4L2Q',
        sourceUrl: 'https://music.amazon.com/albums/B09M7F4L2Q',
        title: 'Selected Ambient Works 85-92',
        artist: 'Aphex Twin',
        album: 'Selected Ambient Works 85-92',
        durationSeconds: 4462,
        releaseDate: '1992-11-09',
        audioQuality: '16-bit / 44.1 kHz HD FLAC',
        outputDir: '/sdcard/Music',
        requestedFormat: 'flac',
        status: 'downloading',
        progress: 64,
        message: 'Track 8/13: Downloading stream segments via lucidadl subprocess',
        outputFiles: JSON.stringify([
          '/sdcard/Music/Aphex Twin - Selected Ambient Works 85-92/01 - Xtal.flac',
          '/sdcard/Music/Aphex Twin - Selected Ambient Works 85-92/02 - Tha.flac',
        ]),
        stdoutLogs:
          '[lucidadl] Resolved album B09M7F4L2Q (13 tracks)\n[lucidadl] [1/13] Xtal.flac ... OK\n[lucidadl] [2/13] Tha.flac ... OK\n[lucidadl] [8/13] Heliosphan.flac ... 64%',
        stderrLogs: '',
        telegramChatId: '99481024',
      });

      await createDownloadJobRecord({
        jobUid: 'job_309f4d',
        userUid: defaultUserUid,
        entityType: 'track',
        asin: 'B07Q8W1Z9K',
        canonicalUrl: 'https://music.amazon.com/tracks/B07Q8W1Z9K',
        sourceUrl: 'https://music.amazon.com/tracks/B07Q8W1Z9K',
        title: 'Windowlicker',
        artist: 'Aphex Twin',
        album: 'Windowlicker EP',
        durationSeconds: 367,
        releaseDate: '1999-03-22',
        audioQuality: '320 kbps Opus',
        outputDir: '/sdcard/Music',
        requestedFormat: 'opus',
        status: 'failed',
        progress: null,
        message: 'lucidadl exited with code 2: Region token expired or stream manifest unavailable',
        outputFiles: JSON.stringify([]),
        stdoutLogs: '[lucidadl] Resolving track B07Q8W1Z9K...',
        stderrLogs:
          'ERROR:lucidadl.manifest:HTTP 403 Forbidden from api.music.amazon.com/v1/streams/B07Q8W1Z9K (Token expired or region mismatch)',
        errorSummary: 'Exit code 2: Upstream stream manifest returned HTTP 403 Forbidden.',
        telegramChatId: '99481024',
      });
    }

    const existingEvents = await listBotEvents();
    if (existingEvents.length === 0) {
      await createBotEventRecord({
        userUid: defaultUserUid,
        telegramUsername: '@kiky_operator',
        chatId: '99481024',
        command: '/dl',
        payload: '/dl https://music.amazon.com/tracks/B08X9K2M1P flac',
        responseText: 'Enqueued Track B08X9K2M1P (job_904a1b) -> /sdcard/Music [FLAC]',
        status: 'processed',
        latencyMs: 38,
      });
      await createBotEventRecord({
        userUid: defaultUserUid,
        telegramUsername: '@kiky_operator',
        chatId: '99481024',
        command: '/status',
        payload: '/status job_712c8e',
        responseText: 'Job job_712c8e [downloading 64%]: Selected Ambient Works 85-92 (Aphex Twin)',
        status: 'processed',
        latencyMs: 24,
      });
    }

    const existingLogs = await listErrorLogs();
    if (existingLogs.length === 0) {
      await createErrorLogRecord({
        module: 'lucidadl_cli',
        severity: 'ERROR',
        errorCode: 'LUCIDA_MANIFEST_403',
        message: 'Subprocess lucidadl exited with non-zero status (2) for ASIN B07Q8W1Z9K',
        stackTrace:
          'File "sonora_backend/app/services/downloader.py", line 88, in execute_lucidadl_job\n  proc = await asyncio.create_subprocess_exec(*cmd_args)\nlucidadl.exceptions.ManifestAuthError: Upstream returned HTTP 403 for ASIN B07Q8W1Z9K. Verify AMAZON_MUSIC_ACCESS_TOKEN in local .env.',
        jobUid: 'job_309f4d',
        resolved: false,
      });
      await createErrorLogRecord({
        module: 'metadata_provider',
        severity: 'WARNING',
        errorCode: 'PROVIDER_NOT_CONFIGURED',
        message: 'Catalog keyword search attempted while AMAZON_MUSIC_ACCESS_TOKEN is unset; falling back to direct ASIN/URL resolution.',
        stackTrace:
          'File "sonora_backend/app/services/metadata_provider.py", line 54, in search_catalog\n  raise MetadataProviderError("provider_not_configured", "Amazon Music Web API credentials are not configured")',
        jobUid: null,
        resolved: false,
      });
    }

    seeded = true;
  } catch (error) {
    console.error('Initial seed check warning:', error);
  }
}
