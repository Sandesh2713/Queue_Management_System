const db = require('./src/db');

console.log('Running migrations...');

try {
    db.exec("ALTER TABLE offices ADD COLUMN history_gaps TEXT DEFAULT '[]'");
    console.log('Added history_gaps');
} catch (e) { console.log('history_gaps already exists or error:', e.message); }

try {
    db.exec("ALTER TABLE offices ADD COLUMN last_call_time TEXT");
    console.log('Added last_call_time');
} catch (e) { console.log('last_call_time already exists or error:', e.message); }

try {
    db.exec("ALTER TABLE offices ADD COLUMN service_count INTEGER DEFAULT 0");
    console.log('Added service_count');
} catch (e) { console.log('service_count already exists or error:', e.message); }

try {
    db.exec("ALTER TABLE offices ADD COLUMN consecutive_slow_count INTEGER DEFAULT 0");
    console.log('Added consecutive_slow_count');
} catch (e) { console.log('consecutive_slow_count already exists or error:', e.message); }

try {
    db.exec("ALTER TABLE offices ADD COLUMN average_velocity REAL DEFAULT 5.0");
    console.log('Added average_velocity');
} catch (e) { console.log('average_velocity already exists or error:', e.message); }

try {
    db.exec("ALTER TABLE offices ADD COLUMN is_paused INTEGER DEFAULT 0");
    console.log('Added is_paused');
} catch (e) { console.log('is_paused already exists or error:', e.message); }

console.log('Migrations complete.');
