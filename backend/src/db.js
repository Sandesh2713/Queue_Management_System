const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'queue.db');

fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

// Initialize tables for offices, tokens, and users (lightweight user store for contact details).
db.exec(`
CREATE TABLE IF NOT EXISTS offices (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  service_type TEXT NOT NULL,
  daily_capacity INTEGER NOT NULL DEFAULT 0,
  available_today INTEGER NOT NULL DEFAULT 0,
  operating_hours TEXT DEFAULT '',
  latitude REAL,
  longitude REAL,
  avg_service_minutes INTEGER DEFAULT 10,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tokens (
  id TEXT PRIMARY KEY,
  office_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_contact TEXT,
  status TEXT NOT NULL,
  position INTEGER,
  token_number INTEGER,
  eta_minutes INTEGER,
  note TEXT,
  created_at TEXT NOT NULL,
  called_at TEXT,
  completed_at TEXT,
  FOREIGN KEY (office_id) REFERENCES offices(id)
);

CREATE TABLE IF NOT EXISTS queue_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id TEXT NOT NULL,
  event TEXT NOT NULL,
  meta TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (token_id) REFERENCES tokens(id)
);
`);

module.exports = db;

