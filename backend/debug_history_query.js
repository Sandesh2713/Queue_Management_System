const db = require('./src/db');

try {
    console.log('--- Checking Schema ---');
    const schema = db.prepare("PRAGMA table_info(token_history)").all();
    console.log('Columns:', schema.map(c => c.name).join(', '));

    console.log('\n--- Testing Query ---');
    // Simulate the call used in server.js
    const stmt = db.prepare(`SELECT * FROM token_history WHERE office_id = ? AND created_at BETWEEN ? AND ? ORDER BY created_at DESC`);

    // Test params similar to what might be passed
    const officeId = 'test-office-id';
    const start = new Date(0).toISOString();
    const end = new Date().toISOString();

    console.log('Params:', { officeId, start, end });

    const res = stmt.all(officeId, start, end);
    console.log('Query successful. Rows found:', res.length);

    // Test with 'undefined' just in case
    try {
        console.log('\n--- Testing with undefined officeId ---');
        stmt.all(undefined, start, end);
    } catch (e) {
        console.log('Expected error with undefined:', e.message);
    }

} catch (error) {
    console.error('FATAL ERROR:', error);
}
