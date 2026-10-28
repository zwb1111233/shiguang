'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const MEDIA_DIR = path.join(UPLOAD_DIR, 'media');
const WALLPAPER_UPLOAD_DIR = path.join(UPLOAD_DIR, 'wallpapers');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(MEDIA_DIR, { recursive: true });
fs.mkdirSync(WALLPAPER_UPLOAD_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'shiguang.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  mood TEXT NOT NULL DEFAULT '',
  text TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  share_id TEXT UNIQUE
);
CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  file TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS history_cache (date TEXT PRIMARY KEY, json TEXT, fetched_at INTEGER);
CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);
CREATE INDEX IF NOT EXISTS idx_media_entry ON media(entry_id);
`);

function getSetting(key, fallback) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row && row.value !== null && row.value !== undefined ? row.value : fallback;
}

function setSetting(key, value) {
  db.prepare(
    'INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, value === undefined || value === null ? null : String(value));
}

function ensureSecret() {
  let s = getSetting('secret');
  if (!s) {
    s = crypto.randomBytes(24).toString('hex');
    setSetting('secret', s);
  }
  return s;
}

module.exports = { db, getSetting, setSetting, ensureSecret, ROOT, DATA_DIR, UPLOAD_DIR, MEDIA_DIR, WALLPAPER_UPLOAD_DIR };
