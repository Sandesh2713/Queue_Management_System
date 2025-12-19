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
  owner_id TEXT,
  created_at TEXT NOT NULL,
  history_gaps TEXT DEFAULT '[]',
  last_call_time TEXT,
  service_count INTEGER DEFAULT 0,
  consecutive_slow_count INTEGER DEFAULT 0,
  average_velocity REAL DEFAULT 5.0,
  is_paused INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  phone TEXT,
  role TEXT DEFAULT 'customer',
  dob TEXT,
  gender TEXT,
  age INTEGER,
  is_verified INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tokens (
  id TEXT PRIMARY KEY,
  office_id TEXT NOT NULL,
  user_id TEXT,
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
  lat REAL,
  lng REAL,
  travel_time_minutes INTEGER,
  service_type TEXT,
  customer_address TEXT,
  FOREIGN KEY (office_id) REFERENCES offices(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
`);

try {
  db.exec("ALTER TABLE tokens ADD COLUMN customer_address TEXT");
} catch (e) { /* Column likely exists */ }

db.exec(`
CREATE TABLE IF NOT EXISTS queue_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id TEXT NOT NULL,
  event TEXT NOT NULL,
  meta TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (token_id) REFERENCES tokens(id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS token_history (
  id TEXT PRIMARY KEY,
  office_id TEXT NOT NULL,
  user_id TEXT,
  user_name TEXT NOT NULL,
  user_contact TEXT,
  status TEXT NOT NULL,
  token_number INTEGER,
  note TEXT,
  created_at TEXT NOT NULL,
  called_at TEXT,
  completed_at TEXT,
  service_type TEXT,
  archived_at TEXT NOT NULL,
  FOREIGN KEY (office_id) REFERENCES offices(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS email_verifications (
  email TEXT PRIMARY KEY,
  otp TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
`);

// Migrations for existing tables
try { db.exec(`ALTER TABLE tokens ADD COLUMN user_id TEXT REFERENCES users(id)`); } catch (e) { }
try { db.exec(`ALTER TABLE tokens ADD COLUMN lat REAL`); } catch (e) { }
try { db.exec(`ALTER TABLE tokens ADD COLUMN lng REAL`); } catch (e) { }
try { db.exec(`ALTER TABLE tokens ADD COLUMN travel_time_minutes INTEGER`); } catch (e) { }
try { db.exec(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'customer'`); } catch (e) { }
try { db.exec(`ALTER TABLE tokens ADD COLUMN service_type TEXT`); } catch (e) { }
try { db.exec(`ALTER TABLE offices ADD COLUMN owner_id TEXT`); } catch (e) { }
try { db.exec(`ALTER TABLE users ADD COLUMN is_verified INTEGER DEFAULT 0`); } catch (e) { }
try { db.exec(`ALTER TABLE users ADD COLUMN admin_key TEXT`); } catch (e) { }

// History Archival & Retention
try { db.exec(`ALTER TABLE users ADD COLUMN history_retention_days INTEGER DEFAULT 30`); } catch (e) { }
try { db.exec(`ALTER TABLE token_history ADD COLUMN eta_minutes INTEGER`); } catch (e) { }
try { db.exec(`ALTER TABLE token_history ADD COLUMN travel_time_minutes INTEGER`); } catch (e) { }
try { db.exec(`ALTER TABLE token_history ADD COLUMN allocation_time TEXT`); } catch (e) { }
try { db.exec(`ALTER TABLE token_history ADD COLUMN service_start_time TEXT`); } catch (e) { }
try { db.exec(`ALTER TABLE token_history ADD COLUMN expected_completion_time TEXT`); } catch (e) { }

// New Columns for Queue Logic Rebuild
try { db.exec(`ALTER TABLE offices ADD COLUMN counter_count INTEGER DEFAULT 1`); } catch (e) { }
try { db.exec(`ALTER TABLE offices ADD COLUMN max_allocated INTEGER DEFAULT 3`); } catch (e) { }
try { db.exec(`ALTER TABLE tokens ADD COLUMN allocation_time TEXT`); } catch (e) { }
try { db.exec(`ALTER TABLE tokens ADD COLUMN service_start_time TEXT`); } catch (e) { }
try { db.exec(`ALTER TABLE tokens ADD COLUMN expected_completion_time TEXT`); } catch (e) { }
try { db.exec(`ALTER TABLE tokens ADD COLUMN last_updated_at TEXT`); } catch (e) { }

module.exports = db;
