const db = require('./src/db');
const { v4: uuidv4 } = require('uuid');

// Mock dependencies
const toIso = () => new Date().toISOString();

// Re-define statements locally for testing if needed, or import if exported. 
// Since they are inside server.js and not exported, I must reproduce them here to test the SQL.
// I will copy the SQL from server.js

const tokensStmt = {
    getById: db.prepare(`SELECT * FROM tokens WHERE id = ?`),
    getForOffice: db.prepare(`SELECT * FROM tokens WHERE office_id = ? ORDER BY created_at ASC`),
    insert: db.prepare(`
    INSERT INTO tokens (id, office_id, user_id, user_name, user_contact, status, token_number, created_at, lat, lng, travel_time_minutes, service_type)
    VALUES (@id, @office_id, @user_id, @user_name, @user_contact, 'WAIT', @token_number, @created_at, @lat, @lng, @travel_time_minutes, @service_type)
  `),
    // Copying updateStatus from server.js
    updateStatus: db.prepare(`
    UPDATE tokens SET 
      status = @status, 
      allocation_time = COALESCE(@allocation_time, allocation_time),
      service_start_time = COALESCE(@service_start_time, service_start_time),
      expected_completion_time = COALESCE(@expected_completion_time, expected_completion_time),
      last_updated_at = @now,
      called_at = COALESCE(@called_at, called_at),
      completed_at = COALESCE(@completed_at, completed_at),
      eta_minutes = @eta
    WHERE id = @id
  `),
    getMaxTokenNum: db.prepare(`SELECT COALESCE(MAX(token_number), 0) as maxNum FROM tokens WHERE office_id = ?`),
};

const officesStmt = {
    getById: db.prepare(`SELECT * FROM offices WHERE id = ?`),
    // ... others not needed for this test
};

async function testBooking() {
    console.log('--- Starting Booking Test ---');
    try {
        // 1. Get an existing office or create one
        let office = officesStmt.getById.get('test-office');
        if (!office) {
            console.log('Creating test office...');
            db.prepare(`INSERT INTO offices (id, name, service_type, created_at) VALUES ('test-office', 'Debug Clinic', 'General', ?)`).run(toIso());
            office = officesStmt.getById.get('test-office');
        }

        // 2. Prepare Token Data
        const token = {
            id: uuidv4(),
            office_id: office.id,
            user_id: null,
            user_name: 'Debug User',
            user_contact: '555-0199',
            token_number: (tokensStmt.getMaxTokenNum.get(office.id).maxNum || 0) + 1,
            created_at: toIso(),
            lat: null,
            lng: null,
            travel_time_minutes: 15,
            service_type: 'General'
        };

        console.log('Inserting Token:', token);

        // 3. Execute Insert
        db.transaction(() => {
            tokensStmt.insert.run(token);
        })();
        console.log('Insert Successful.');

        // 4. Test Recalculate Logic (Simplified version of server.js logic)
        console.log('Testing Recalculate (Update Status)...');

        // Simulate an update that happens in recalculateQueue
        const now = toIso();
        const updateParams = {
            id: token.id,
            status: 'ALLOCATED',
            allocation_time: now,
            service_start_time: null,
            expected_completion_time: null,
            called_at: null,
            completed_at: null,
            now: now,
            eta: 5
        };
        console.log('Update Params:', updateParams);

        tokensStmt.updateStatus.run(updateParams);
        console.log('Update Successful.');

    } catch (e) {
        console.error('FATAL ERROR:', e);
    }
}

testBooking();
