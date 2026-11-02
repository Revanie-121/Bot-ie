import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  telegramChatId: text('telegram_chat_id'),
  role: text('role').notNull().default('operator'),
  preferredFormat: text('preferred_format').notNull().default('flac'),
  outputDir: text('output_dir').notNull().default('/sdcard/Music'),
  concurrencyLimit: integer('concurrency_limit').notNull().default(2),
  createdAt: timestamp('created_at').defaultNow(),
});

export const downloadJobs = pgTable('download_jobs', {
  id: serial('id').primaryKey(),
  jobUid: text('job_uid').notNull().unique(),
  userUid: text('user_uid').notNull(),
  entityType: text('entity_type').notNull(), // 'track' | 'album'
  asin: text('asin').notNull(),
  canonicalUrl: text('canonical_url').notNull(),
  sourceUrl: text('source_url').notNull(),
  title: text('title').notNull(),
  artist: text('artist').notNull(),
  album: text('album').notNull(),
  artworkUrl: text('artwork_url'),
  durationSeconds: integer('duration_seconds'),
  releaseDate: text('release_date'),
  audioQuality: text('audio_quality'),
  outputDir: text('output_dir').notNull().default('/sdcard/Music'),
  requestedFormat: text('requested_format').notNull().default('flac'),
  status: text('status').notNull().default('queued'),
  progress: integer('progress'),
  message: text('message').notNull().default('Queued for lucidadl worker'),
  outputFiles: text('output_files').notNull().default('[]'),
  stdoutLogs: text('stdout_logs').notNull().default(''),
  stderrLogs: text('stderr_logs').notNull().default(''),
  errorSummary: text('error_summary'),
  telegramChatId: text('telegram_chat_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const botEvents = pgTable('bot_events', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  telegramUsername: text('telegram_username').notNull(),
  chatId: text('chat_id').notNull(),
  command: text('command').notNull(),
  payload: text('payload').notNull(),
  responseText: text('response_text').notNull(),
  status: text('status').notNull().default('processed'),
  latencyMs: integer('latency_ms').notNull().default(42),
  createdAt: timestamp('created_at').defaultNow(),
});

export const errorLogs = pgTable('error_logs', {
  id: serial('id').primaryKey(),
  module: text('module').notNull(),
  severity: text('severity').notNull().default('ERROR'),
  errorCode: text('error_code').notNull(),
  message: text('message').notNull(),
  stackTrace: text('stack_trace').notNull(),
  jobUid: text('job_uid'),
  resolved: boolean('resolved').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  jobs: many(downloadJobs),
}));

export const downloadJobsRelations = relations(downloadJobs, ({ one }) => ({
  user: one(users, {
    fields: [downloadJobs.userUid],
    references: [users.uid],
  }),
}));
