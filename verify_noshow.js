// Native fetch used
const API = 'http://localhost:4000';

async function run() {
    try {
        // 1. Login Admin
        const loginRes = await fetch(`${API}/api/auth/login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin2@test.com', password: 'password' })
        });
        const loginData = await loginRes.json();
        if (!loginData.token) throw new Error('Login failed: ' + JSON.stringify(loginData));
        const token = loginData.token;
        console.log('Logged in Admin. Token len:', token.length);

        // 2. Get Office
        const officeRes = await fetch(`${API}/api/offices?owner=me`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const officeData = await officeRes.json();
        const office = officeData.offices[0];
        if (!office) throw new Error('No office found for admin');
        console.log('Office found:', office.name, office.id);

        // 3. Book User A
        const bookARes = await fetch(`${API}/api/offices/${office.id}/book`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customerName: 'UserA', customerContact: '111', serviceType: 'Test' })
        });
        const bookA = await bookARes.json();
        console.log('Booked UserA:', bookA.token.status);

        // 4. Book User B
        const bookBRes = await fetch(`${API}/api/offices/${office.id}/book`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customerName: 'UserB', customerContact: '222', serviceType: 'Test' })
        });
        const bookB = await bookBRes.json();
        console.log('Booked UserB:', bookB.token.status);

        // 5. Call Next (Should be A)
        const callRes = await fetch(`${API}/api/offices/${office.id}/call-next`, {
            method: 'POST', headers: { 'x-admin-key': 'changeme-admin-key', Authorization: `Bearer ${token}` }
        });
        const callData = await callRes.json();
        console.log('Call Response:', JSON.stringify(callData));
        console.log('Called Next:', callData.token.user_name);
        if (callData.token.user_name !== 'UserA') console.error('WARNING: Expected UserA');

        // 6. No Show (User A -> Defer)
        console.log('Calling No-Show on:', callData.token.id);
        const noShowRes = await fetch(`${API}/api/tokens/${callData.token.id}/no-show`, {
            method: 'POST', headers: { 'x-admin-key': 'changeme-admin-key', Authorization: `Bearer ${token}` }
        });
        const noShowData = await noShowRes.json();
        console.log('No Show Result Message:', noShowData.message);

        // 7. Verify Statuses
        const checkARes = await fetch(`${API}/api/tokens/${callData.token.id}`);
        const checkA = await checkARes.json();
        console.log('UserA Status:', checkA.token.status, 'Pos:', checkA.token.position); // Expected: queued, Pos X

        // Check User B (If logic worked, B should be Called)
        // We can't easily get token ID for B unless we saved it, which we did in bookB
        const checkBRes = await fetch(`${API}/api/tokens/${bookB.token.id}`);
        const checkB = await checkBRes.json();
        console.log('UserB Status:', checkB.token.status); // Expected: called

    } catch (e) {
        console.error(e);
    }
}

run();
