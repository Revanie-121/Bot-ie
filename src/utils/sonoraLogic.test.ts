import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAndNormalizeAsinInput,
  buildCanonicalUrl,
  validateOutputDirectory,
  buildLucidadlArgs,
  parseTelegramCommand,
  signJwtToken,
  verifyJwtToken,
  computeQueueMetrics,
} from './sonoraLogic';

test('validateAndNormalizeAsinInput normalizes 10-char lowercase ASIN to uppercase canonical track URL', () => {
  const res = validateAndNormalizeAsinInput('b08x9k2m1p', 'track');
  assert.equal(res.valid, true);
  assert.equal(res.asin, 'B08X9K2M1P');
  assert.equal(res.entityType, 'track');
  assert.equal(res.canonicalUrl, 'https://music.amazon.com/tracks/B08X9K2M1P');
});

test('validateAndNormalizeAsinInput preserves source_url when extracting trackAsin from album URL', () => {
  const rawUrl = 'https://music.amazon.com/albums/B08ALBUM01?marketplaceId=ATVPDKIKX0DER&trackAsin=B08TRACK99';
  const res = validateAndNormalizeAsinInput(rawUrl, 'album');
  assert.equal(res.valid, true);
  assert.equal(res.asin, 'B08TRACK99');
  assert.equal(res.entityType, 'track');
  assert.equal(res.canonicalUrl, 'https://music.amazon.com/tracks/B08TRACK99');
  assert.equal(res.sourceUrl, rawUrl);
});

test('validateAndNormalizeAsinInput rejects non-HTTPS and untrusted hosts', () => {
  const httpRes = validateAndNormalizeAsinInput('http://music.amazon.com/tracks/B08X9K2M1P');
  assert.equal(httpRes.valid, false);

  const badHost = validateAndNormalizeAsinInput('https://evil.example.com/tracks/B08X9K2M1P');
  assert.equal(badHost.valid, false);
});

test('buildCanonicalUrl formats albums and tracks properly', () => {
  assert.equal(buildCanonicalUrl('b09abc1234', 'album'), 'https://music.amazon.com/albums/B09ABC1234');
  assert.equal(buildCanonicalUrl('b09abc1234', 'track'), 'https://music.amazon.com/tracks/B09ABC1234');
});

test('validateOutputDirectory blocks path traversal and unauthorized paths', () => {
  const validDir = validateOutputDirectory('/sdcard/Music/Sonora');
  assert.equal(validDir.valid, true);
  assert.equal(validDir.normalizedPath, '/sdcard/Music/Sonora');

  const traversalDir = validateOutputDirectory('/sdcard/Music/../../etc/passwd');
  assert.equal(traversalDir.valid, false);

  const unauthorizedDir = validateOutputDirectory('/etc/shadow');
  assert.equal(unauthorizedDir.valid, false);
});

test('buildLucidadlArgs creates safe array arguments without shell concatenation', () => {
  const cmd = buildLucidadlArgs({
    executablePath: '/usr/local/bin/lucidadl',
    entityType: 'album',
    sourceUrl: 'https://music.amazon.com/albums/B09ABC1234',
    outputDir: '/sdcard/Music',
    requestedFormat: 'flac',
  });
  assert.equal(cmd.executable, '/usr/local/bin/lucidadl');
  assert.deepEqual(cmd.args, [
    'album',
    'https://music.amazon.com/albums/B09ABC1234',
    '--output',
    '/sdcard/Music',
    '--format',
    'flac',
    '--no-tui',
  ]);
});

test('parseTelegramCommand handles /dl, /search, and direct URLs accurately', () => {
  const dlCmd = parseTelegramCommand('/dl https://music.amazon.com/tracks/B08X9K2M1P opus');
  assert.equal(dlCmd.valid, true);
  assert.equal(dlCmd.action, 'download');
  assert.equal(dlCmd.requestedFormat, 'opus');

  const searchCmd = parseTelegramCommand('/search Boards of Canada Music Has the Right to Children');
  assert.equal(searchCmd.valid, true);
  assert.equal(searchCmd.action, 'search');
  assert.equal(searchCmd.query, 'Boards of Canada Music Has the Right to Children');

  const directUrl = parseTelegramCommand('https://music.amazon.com/albums/B09ABC1234');
  assert.equal(directUrl.valid, true);
  assert.equal(directUrl.action, 'download');
});

test('signJwtToken and verifyJwtToken round-trip and reject tampered tokens', () => {
  const secret = 'test-super-secret-jwt-key-2026';
  const token = signJwtToken(
    { sub: 'usr_01', email: 'operator@sonora.local', role: 'admin', telegramChatId: '9948102' },
    secret,
    3600
  );
  const verified = verifyJwtToken(token, secret);
  assert.equal(verified.valid, true);
  assert.equal(verified.payload?.sub, 'usr_01');
  assert.equal(verified.payload?.email, 'operator@sonora.local');

  const wrongSecret = verifyJwtToken(token, 'wrong-secret');
  assert.equal(wrongSecret.valid, false);
});

test('computeQueueMetrics calculates active, completed, and successRate correctly', () => {
  const metrics = computeQueueMetrics([
    { status: 'completed', requestedFormat: 'flac', entityType: 'track' },
    { status: 'completed', requestedFormat: 'flac', entityType: 'album' },
    { status: 'downloading', requestedFormat: 'mp3', entityType: 'track' },
    { status: 'failed', requestedFormat: 'opus', entityType: 'track' },
  ]);
  assert.equal(metrics.total, 4);
  assert.equal(metrics.active, 1);
  assert.equal(metrics.completed, 2);
  assert.equal(metrics.failed, 1);
  assert.equal(metrics.successRate, 67);
});
