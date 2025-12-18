const db = require('./src/db');

console.log('Migrating Presence Columns...');

try {
    // Add columns to tokens table
    try {
        db.prepare("ALTER TABLE tokens ADD COLUMN presence_status TEXT DEFAULT 'NOT_ARRIVED'").run();
        console.log('Added presence_status column.');
    } catch (e) {
        if (!e.message.includes('duplicate column')) console.error(e.message);
    }

    try {
        db.prepare("ALTER TABLE tokens ADD COLUMN arrival_confirmed_at TEXT").run();
        console.log('Added arrival_confirmed_at column.');
    } catch (e) {
        if (!e.message.includes('duplicate column')) console.error(e.message);
    }

    try {
        db.prepare("ALTER TABLE tokens ADD COLUMN eligibility_time TEXT").run();
        console.log('Added eligibility_time column.');
    } catch (e) {
        if (!e.message.includes('duplicate column')) console.error(e.message);
    }

    console.log('Presence Migration Complete.');
} catch (err) {
    console.error('Migration Failed:', err);
}
