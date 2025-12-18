const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'queue_system.db');
const db = new Database(dbPath);

console.log('Migrating database for Pause Reasons...');

try {
    // 1. Add columns to offices table
    // sqlite doesn't support IF NOT EXISTS for columns, so we try/catch
    try {
        db.prepare('ALTER TABLE offices ADD COLUMN pause_reason TEXT').run();
        console.log('Added pause_reason column.');
    } catch (e) {
        if (!e.message.includes('duplicate column')) console.log('pause_reason column might already exist.');
    }

    try {
        db.prepare('ALTER TABLE offices ADD COLUMN pause_message TEXT').run();
        console.log('Added pause_message column.');
    } catch (e) {
        if (!e.message.includes('duplicate column')) console.log('pause_message column might already exist.');
    }

    try {
        db.prepare('ALTER TABLE offices ADD COLUMN pause_start_time TEXT').run();
        console.log('Added pause_start_time column.');
    } catch (e) {
        if (!e.message.includes('duplicate column')) console.log('pause_start_time column might already exist.');
    }

    // 2. Create history table
    db.prepare(`
    CREATE TABLE IF NOT EXISTS office_pause_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      office_id TEXT,
      pause_reason TEXT,
      pause_start_time TEXT,
      pause_end_time TEXT,
      duration_minutes INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
    console.log('Created office_pause_history table.');

    console.log('Migration complete.');
} catch (err) {
    console.error('Migration failed:', err);
}
