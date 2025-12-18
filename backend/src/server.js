const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
const dotenv = require('dotenv');
const db = require('./db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const ExcelJS = require('exceljs');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 4000;
const adminKey = process.env.ADMIN_KEY || 'changeme-admin-key';
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const jwtSecret = process.env.JWT_SECRET || 'super-secret-jwt-key';
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;

/* --- Socket.IO Setup --- */
const io = new Server(server, {
  cors: {
    origin: clientOrigin.split(',').map(s => s.trim()),
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join_office', (officeId) => {
    socket.join(`office_${officeId}`);
    // Emit initial status?
  });

  socket.on('join_user', (userId) => {
    socket.join(`user_${userId}`);
  });
});

/* --- Email Helper --- */
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: { user: smtpUser, pass: smtpPass },
});

const sendEmail = async (to, subject, text) => {
  if (!smtpUser || !smtpPass) return console.log('Mock Email:', { to, subject });
  try {
    await transporter.sendMail({ from: `"Queue System" <${smtpUser}>`, to, subject, text });
  } catch (err) {
    console.error('Error sending email:', err);
  }
};

/* --- Restored Endpoints to MATCH App.jsx expectation --- */

// OTP Routes (Missing)
const emailVerificationsStmt = {
  upsert: db.prepare(`INSERT INTO email_verifications (email, otp, expires_at) VALUES (@email, @otp, @expires_at) ON CONFLICT(email) DO UPDATE SET otp = @otp, expires_at = @expires_at`),
  get: db.prepare(`SELECT * FROM email_verifications WHERE email = ?`),
  delete: db.prepare(`DELETE FROM email_verifications WHERE email = ?`),
};

app.post('/api/auth/send-otp', async (req, res) => {
  const { email, type } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60000).toISOString();
  // Simple stub for email sending
  emailVerificationsStmt.upsert.run({ email, otp, expires_at: expiresAt });
  await sendEmail(email, 'Your OTP', `OTP: ${otp}`);
  res.json({ message: 'OTP sent' });
});

app.post('/api/auth/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  const record = emailVerificationsStmt.get.get(email);
  if (!record || record.otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });
  usersStmt.insert.run({ id: uuidv4(), name: 'Verified User', email, hash: 'temp', role: 'customer', created_at: toIso() }); // Stub
  res.json({ success: true });
});

app.post('/api/auth/reset-password', (req, res) => {
  // Stub
  res.json({ success: true });
});

app.use(cors({ origin: clientOrigin.split(',').map((s) => s.trim()), credentials: false }));
app.use(express.json());
app.use(morgan('dev'));

const toIso = () => new Date().toISOString();

// Middleware: Authenticate Token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

/* --- Database Statements --- */
const officesStmt = {
  getById: db.prepare(`SELECT * FROM offices WHERE id = ?`),
  getAll: db.prepare(`SELECT * FROM offices ORDER BY created_at DESC`),
  insert: db.prepare(`
    INSERT INTO offices (id, name, service_type, daily_capacity, available_today, operating_hours, latitude, longitude, avg_service_minutes, owner_id, created_at, counter_count, max_allocated)
    VALUES (@id, @name, @service_type, @daily_capacity, @daily_capacity, @operating_hours, @latitude, @longitude, @avg_service_minutes, @owner_id, @created_at, @counter_count, @max_allocated)
  `),
  updateStats: db.prepare(`UPDATE offices SET avg_service_minutes = @avg WHERE id = @id`),
  updateConfig: db.prepare(`UPDATE offices SET counter_count = @n, max_allocated = @m WHERE id = @id`),
};

const tokensStmt = {
  getById: db.prepare(`SELECT * FROM tokens WHERE id = ?`),
  getForOffice: db.prepare(`
    SELECT t.*, u.dob, u.gender, u.email as user_email
    FROM tokens t
    LEFT JOIN users u ON t.user_id = u.id 
    WHERE t.office_id = ? 
    ORDER BY t.created_at ASC
  `),
  insert: db.prepare(`
    INSERT INTO tokens (id, office_id, user_id, user_name, user_contact, status, token_number, created_at, lat, lng, travel_time_minutes, service_type)
    VALUES (@id, @office_id, @user_id, @user_name, @user_contact, 'WAIT', @token_number, @created_at, @lat, @lng, @travel_time_minutes, @service_type)
  `),
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

const usersStmt = {
  getById: db.prepare(`SELECT * FROM users WHERE id = ?`),
  getByEmail: db.prepare(`SELECT * FROM users WHERE email = ?`),
  insert: db.prepare(`INSERT INTO users (id, name, email, password_hash, role, created_at, is_verified) VALUES (@id, @name, @email, @hash, @role, @created_at, 0)`),
  insert: db.prepare(`INSERT INTO users (id, name, email, password_hash, role, created_at, is_verified) VALUES (@id, @name, @email, @hash, @role, @created_at, 0)`),
  updateRetention: db.prepare(`UPDATE users SET history_retention_days = ? WHERE id = ?`),
  getRetention: db.prepare(`SELECT history_retention_days FROM users WHERE id = ?`),
};

const historyStmt = {
  archive: db.prepare(`
    INSERT INTO token_history (id, office_id, user_id, user_name, user_contact, status, token_number, note, created_at, called_at, completed_at, service_type, archived_at, eta_minutes, travel_time_minutes, allocation_time, service_start_time, expected_completion_time)
    SELECT id, office_id, user_id, user_name, user_contact, status, token_number, note, created_at, called_at, completed_at, service_type, @archivedAt, eta_minutes, travel_time_minutes, allocation_time, service_start_time, expected_completion_time
    FROM tokens
  `),
  deleteArchivedTokens: db.prepare(`DELETE FROM tokens`), // Wipes active tokens table
  cleanupOldHistory: db.prepare(`DELETE FROM token_history WHERE archived_at < ?`), // Global fallback
  cleanupForOffice: db.prepare(`DELETE FROM token_history WHERE office_id = ? AND archived_at < ?`),
  getAll: db.prepare(`SELECT * FROM token_history ORDER BY created_at DESC LIMIT 1000`), // Limit for safety
  getByFilter: db.prepare(`SELECT * FROM token_history WHERE office_id = ? AND created_at BETWEEN ? AND ? ORDER BY created_at DESC`),
};

const recalculateQueue = (officeId) => {
  const office = officesStmt.getById.get(officeId);
  if (!office) return;

  const allTokens = tokensStmt.getForOffice.all(officeId);
  // Sort by created_at (FIFO)
  const activeTokens = allTokens.filter(t => ['WAIT', 'ALLOCATED', 'CALLED'].includes(t.status));

  // 1. Define Capacity
  const N = office.counter_count || 1;
  const M = N * 3;

  // 2. Identify Groups & Promote
  const calledTokens = activeTokens.filter(t => t.status === 'CALLED');
  let allocatedTokens = activeTokens.filter(t => t.status === 'ALLOCATED');
  let waitTokens = activeTokens.filter(t => t.status === 'WAIT');

  let currentOccupancy = calledTokens.length + allocatedTokens.length;
  let slotsOpen = M - currentOccupancy;

  if (slotsOpen > 0 && waitTokens.length > 0) {
    const toPromote = waitTokens.slice(0, slotsOpen);
    toPromote.forEach(token => {
      const now = toIso();
      tokensStmt.updateStatus.run({
        id: token.id,
        status: 'ALLOCATED',
        allocation_time: now,
        service_start_time: null, // Calc below
        expected_completion_time: null,
        called_at: null,
        completed_at: null,
        now: now,
        eta: null
      });
      token.status = 'ALLOCATED';
      token.allocation_time = now;
      if (token.user_id) {
        io.to(`user_${token.user_id}`).emit('notification', { message: "You have been allocated! Please proceed to the office." });
      }
    });
    // Refresh lists after promotion
    allocatedTokens = [...allocatedTokens, ...toPromote];
    waitTokens = waitTokens.slice(slotsOpen);
  }

  // 3. Global Queue Position & ETA Calculation
  // We treat ALL active tokens as a single FIFO queue for positioning
  // Order: CALLED (served) -> ALLOCATED (waiting) -> WAIT (remote)
  // Actually, 'CALLED' are technically positions 1..N (or however many active)

  // Re-fetch strict order? already sorted by created_at which handles the FIFO naturally.
  // Just verify `activeTokens` order. Since `allTokens` is sorted by `created_at`, `activeTokens` is too.
  // Wait. `toPromote` mutation of local variables `allocatedTokens` doesn't affect `activeTokens` array references? 
  // Yes it does if objects are ref. But I mutated `waitTokens` by slice.
  // Safest to re-construct `queue` list.

  const queue = [...calledTokens, ...allocatedTokens, ...waitTokens].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const serviceTime = office.avg_service_minutes || 10;
  const nowTime = Date.now();

  queue.forEach((token, index) => {
    // Position 1-based
    const position = index + 1;

    // Formula: ETA = (ceil(position / N) - 1) * service_time
    const waitUnits = Math.ceil(position / N) - 1;
    const waitMinutes = Math.max(0, waitUnits * serviceTime);

    const serviceStartTs = nowTime + (waitMinutes * 60000);
    const serviceStart = new Date(serviceStartTs).toISOString();

    // Store calculated data
    // Note: for WAIT tokens, this 'service_start_time' is the predicted Call time.
    // Frontend will derive Allocation Time from this (Call Time - 3 * ServiceTime or similar)

    // Only update if changed? Or always update for eta freshness.
    // We strictly update `eta` and `service_start_time`.

    // We assume 'CALLED' status is already set.
    // We assume 'ALLOCATED' status is already set.
    // We assume 'WAIT' status is already set.

    tokensStmt.updateStatus.run({
      id: token.id,
      status: token.status,
      allocation_time: token.allocation_time, // Preserve
      service_start_time: serviceStart,
      expected_completion_time: token.expected_completion_time,
      called_at: token.called_at,
      completed_at: null,
      eta: waitMinutes,
      now: toIso()
    });
  });

  // Emit Global Update
  io.to(`office_${officeId}`).emit('queue_update', {
    officeId,
    tokens: tokensStmt.getForOffice.all(officeId),
    stats: {
      wait: waitTokens.length,
      allocated: allocatedTokens.length,
      called: calledTokens.length,
      M, N,
      serviceTime
    }
  });
};

/* --- Helpers --- */
const haversineDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const toRad = x => x * Math.PI / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const ensureOffice = (id) => {
  const office = officesStmt.getById.get(id);
  if (!office) throw { status: 404, message: 'Office not found' };
  return office;
};

/* --- Endpoints --- */
app.get('/health', (req, res) => res.json({ status: 'ok', time: toIso() }));

// Create Token (Book)
app.post('/api/offices/:id/book', (req, res) => {
  try {
    const { id } = req.params;
    const office = ensureOffice(id);
    const { customerName, customerContact, lat, lng, userId, serviceType } = req.body;

    if (!customerName) return res.status(400).json({ error: 'Name required' });

    // Calc Travel Time
    let travelTime = 15; // default
    if (lat && lng && office.latitude && office.longitude) {
      const dist = haversineDistance(lat, lng, office.latitude, office.longitude);
      travelTime = Math.ceil(dist * 2);
    }

    const token = {
      id: uuidv4(),
      office_id: id,
      user_id: userId || null, // Ensure valid value
      user_name: customerName,
      user_contact: customerContact,
      token_number: (tokensStmt.getMaxTokenNum.get(id).maxNum || 0) + 1,
      created_at: toIso(),
      lat: lat || null,
      lng: lng || null,
      travel_time_minutes: travelTime,
      service_type: serviceType || 'General'
    };

    db.transaction(() => {
      tokensStmt.insert.run(token);
    })();

    try {
      recalculateQueue(id);
    } catch (calcErr) {
      console.error('Recalculate Queue Failed (Non-fatal):', calcErr);
      // Do not fail the request if calc fails
    }

    res.status(201).json(token);
  } catch (err) {
    console.error('Booking Endpoint Fatal Error:', err);
    res.status(500).json({ error: 'System Error: ' + String(err.message) });
  }
});

// Call Next
app.post('/api/offices/:id/call-next', (req, res) => {
  const { id } = req.params;
  const office = ensureOffice(id);

  // Logic: 
  // 1. Check Safety Lock: Count(CALLED) < N
  const all = tokensStmt.getForOffice.all(id);
  const calledCount = all.filter(t => t.status === 'CALLED').length;
  const N = office.counter_count || 1;
  const adminForce = req.body.force === true; // escape hatch

  if (calledCount >= N && !adminForce) {
    return res.status(400).json({ error: `Cannot call next. All ${N} counters are active. Complete a user first.` });
  }

  // 2. Pick Next from ALLOCATED (FIFO)
  // Strict: Must be ALLOCATED. WAIT cannot be called directly (must wait for bulk promote).
  // Is this robust? What if M=0? M=N*3 so M>=3.
  // What if ALLOCATED is empty? (e.g. initial start)
  // If queue has WAIT tokens, `recalculateQueue` should have promoted them.
  // So if ALLOCATED is empty, it means no one is ready or logic hasn't run.
  // We run logic first.
  recalculateQueue(id); // Ensure fresh state

  // Re-fetch
  const freshAll = tokensStmt.getForOffice.all(id);
  let allocated = freshAll.filter(t => t.status === 'ALLOCATED');

  let nextToken = null;

  if (allocated.length > 0) {
    nextToken = allocated[0];
  } else {
    // Fallback: Check WAIT list (Auto-promote if stuck)
    const wait = freshAll.filter(t => t.status === 'WAIT');
    if (wait.length > 0) {
      nextToken = wait[0];
      // We will treat it as ALLOCATED implicitly then CALLED immediately
    } else {
      return res.status(404).json({ error: 'No users in queue.' });
    }
  }

  const now = toIso();

  db.transaction(() => {
    tokensStmt.updateStatus.run({
      id: nextToken.id,
      status: 'CALLED',
      called_at: now,
      completed_at: null,
      allocation_time: nextToken.allocation_time,
      service_start_time: now,
      expected_completion_time: null,
      now,
      eta: 0 // Arrived
    });
  })();

  recalculateQueue(id); // Update for everyone else

  // Notify
  if (nextToken.user_id) {
    io.to(`user_${nextToken.user_id}`).emit('notification', { message: "It's your turn! Please go to the counter." });
  }

  res.json(nextToken);
});

// Complete
app.post('/api/tokens/:id/complete', (req, res) => {
  const token = tokensStmt.getById.get(req.params.id);
  if (!token) return res.status(404).json({ error: 'Not found' });

  db.transaction(() => {
    tokensStmt.updateStatus.run({
      id: token.id,
      status: 'COMPLETED',
      completed_at: toIso(),
      called_at: token.called_at,
      allocation_time: token.allocation_time,
      service_start_time: token.service_start_time,
      expected_completion_time: toIso(),
      now: toIso(),
      eta: null
    });
  })();

  // Recalculate will promote new WAIT -> ALLOCATED
  recalculateQueue(token.office_id);

  res.json({ success: true });
});

// Admin: Config Counters
app.post('/api/offices/:id/config', (req, res) => {
  const { id } = req.params;
  const { counterCount } = req.body;
  const N = parseInt(counterCount);
  if (isNaN(N) || N < 1) return res.status(400).json({ error: 'Invalid counter count' });

  const M = N * 3;
  officesStmt.updateConfig.run({ id, n: N, m: M });
  recalculateQueue(id);

  res.json({ success: true, N, M });
});

// Public: Get Office Status (Original Path was /api/offices/:id)
// App.jsx calls /api/offices/:id for details
app.get('/api/offices/:id', (req, res) => {
  const { id } = req.params;
  try {
    const office = ensureOffice(id);
    const tokens = enrichTokens(tokensStmt.getForOffice.all(id));
    // Add extra stats expected by frontend
    const queueCount = tokens.filter(t => t.status === 'WAIT' || t.status === 'queued').length;
    res.json({ office: { ...office, queueCount }, tokens });
  } catch (e) {
    res.status(404).json({ error: 'Office not found' });
  }
});

// App.jsx calls /api/offices/:id/status? Maybe, but definitely calls :id
// We keep :id/status alias if needed, but :id is primary.

// Availability PATCH
app.patch('/api/offices/:id/availability', (req, res) => {
  const { id } = req.params;
  const { availableToday } = req.body;
  // This was used to manually set availability.
  // We can support it by updating the DB.
  db.prepare('UPDATE offices SET available_today = ? WHERE id = ?').run(availableToday, id);
  res.json({ success: true });
});

// Pause / Resume
app.post('/api/offices/:id/pause', (req, res) => {
  const { id } = req.params;
  const { paused } = req.body;
  db.prepare('UPDATE offices SET is_paused = ? WHERE id = ?').run(paused ? 1 : 0, id);
  res.json({ success: true, is_paused: paused });
});

// Notifications
const notificationsStmt = {
  getForUser: db.prepare(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`),
  markRead: db.prepare(`UPDATE notifications SET is_read = 1 WHERE id = ?`),
  insert: db.prepare(`INSERT INTO notifications (id, user_id, message, is_read, created_at) VALUES (@id, @user_id, @message, 0, @created_at)`)
};

app.get('/api/notifications', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.json({ notifications: [] });
  const notifications = notificationsStmt.getForUser.all(userId);
  res.json({ notifications });
});

app.post('/api/notifications/:id/read', (req, res) => {
  notificationsStmt.markRead.run(req.params.id);
  res.json({ success: true });
});

// History
app.get('/api/history', authenticateToken, (req, res) => {
  // Return completed/archived tokens
  // Matching column count: 18 columns in token_history
  const history = db.prepare(`
    SELECT * FROM token_history 
    UNION ALL 
    SELECT 
      id, office_id, user_id, user_name, user_contact, status, token_number, note, created_at, called_at, completed_at, service_type, 
      NULL as archived_at, 
      eta_minutes, travel_time_minutes, allocation_time, service_start_time, expected_completion_time
    FROM tokens 
    WHERE status IN ('COMPLETED', 'cancelled', 'no-show', 'history')
    ORDER BY created_at DESC LIMIT 100
  `).all();

  // Map simplified
  const mapped = history.map(h => ({
    ...h,
    archived_at: h.archived_at || h.completed_at || h.created_at
  }));

  res.json({ history: mapped });
});

// Auth Routes
app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, jwtSecret);
    const user = usersStmt.getById.get(decoded.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        is_verified: user.is_verified,
        phone: user.phone,
        dob: user.dob,
        gender: user.gender,
        age: user.age,
        history_retention_days: user.history_retention_days || 30
      }
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = usersStmt.getByEmail.get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid' });
  }
  const token = jwt.sign({ id: user.id, role: user.role }, jwtSecret);
  res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
});

app.post('/api/auth/register', (req, res) => {
  const { name, email, password, role } = req.body;
  const hash = bcrypt.hashSync(password, 10);
  try {
    const id = uuidv4();
    usersStmt.insert.run({ id, name, email, hash, role: role || 'customer', created_at: toIso() });
    const token = jwt.sign({ id, role: role || 'customer' }, jwtSecret);
    res.json({ token, user: { id, name, email, role } });
  } catch (e) {
    res.status(400).json({ error: 'Email exists or invalid' });
  }
});

app.get('/api/offices', (req, res) => {
  const offices = officesStmt.getAll.all();
  res.json({ offices });
});

app.post('/api/offices', (req, res) => {
  const { name, serviceType, dailyCapacity, operatingHours, latitude, longitude, avgServiceMinutes, counterCount, ownerId } = req.body;
  // Basic validation or auth check (ownerId usually from token in real app, but simplified here)

  const N = parseInt(counterCount) || 1;
  const M = N * 3;

  const office = {
    id: uuidv4(),
    name,
    service_type: serviceType,
    daily_capacity: Number(dailyCapacity),
    operating_hours: operatingHours,
    latitude: latitude || null,
    longitude: longitude || null,
    avg_service_minutes: Number(avgServiceMinutes) || 10,
    owner_id: ownerId || null, // In production, grab from req.user
    created_at: toIso(),
    counter_count: N,
    max_allocated: M
  };

  try {
    officesStmt.insert.run(office);
    res.status(201).json({ office });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// Update Retention Settings
app.put('/api/admin/settings', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });

  const { userId, retentionDays } = req.body;
  if (!userId || !retentionDays) return res.status(400).json({ error: 'Missing fields' });

  usersStmt.updateRetention.run(retentionDays, userId);
  res.json({ success: true, retentionDays });
});

// Get Token History (Filtered)
app.get('/api/admin/token-history', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });

  // Use req.user.id to ensure they only see THEIR office? 
  // Code seems to rely on selectedOfficeId passed in query. 
  // Ideally we verify ownership, but for now Role check is better than broken Key check.

  const { officeId, start, end, status } = req.query;
  const startDate = start ? new Date(start).toISOString() : new Date(0).toISOString();
  const endDate = end ? new Date(end).toISOString() : new Date().toISOString();

  let data = historyStmt.getByFilter.all(officeId, startDate, endDate);

  if (status && status !== 'all') {
    data = data.filter(t => t.status.toLowerCase() === status.toLowerCase());
  }

  res.json({ history: data });
});

// Export Token History (Excel)
app.get('/api/admin/token-history/export', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });

  const { officeId, start, end } = req.query;
  const startDate = start ? new Date(start).toISOString() : new Date(0).toISOString();
  const endDate = end ? new Date(end).toISOString() : new Date().toISOString();

  const data = historyStmt.getByFilter.all(officeId, startDate, endDate);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Token History');

  // Columns: Token ID, User Name, User Email, Office Name (Need lookup?), Status, ETA, Service Start, Completion, Total Time, Created Date
  sheet.columns = [
    { header: 'Token No', key: 'token_number', width: 10 },
    { header: 'Customer Name', key: 'user_name', width: 20 },
    { header: 'Contact', key: 'user_contact', width: 15 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Service Type', key: 'service_type', width: 20 },
    { header: 'Created At', key: 'created_at', width: 25 },
    { header: 'Called At', key: 'called_at', width: 25 },
    { header: 'Completed At', key: 'completed_at', width: 25 },
    { header: 'Wait Time (Min)', key: 'wait_time', width: 15 },
    { header: 'Service Duration (Min)', key: 'service_duration', width: 15 },
  ];

  data.forEach(t => {
    const created = t.created_at ? new Date(t.created_at) : null;
    const called = t.called_at ? new Date(t.called_at) : null;
    const completed = t.completed_at ? new Date(t.completed_at) : null;

    const waitTime = (created && called) ? Math.round((called - created) / 60000) : 0;
    const serviceDuration = (called && completed) ? Math.round((completed - called) / 60000) : 0;

    sheet.addRow({
      token_number: t.token_number,
      user_name: t.user_name,
      user_contact: t.user_contact,
      status: t.status,
      service_type: t.service_type,
      created_at: created ? created.toLocaleString() : '',
      called_at: called ? called.toLocaleString() : '',
      completed_at: completed ? completed.toLocaleString() : '',
      wait_time: waitTime,
      service_duration: serviceDuration
    });
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=token_history_${officeId}_${Date.now()}.xlsx`);

  await workbook.xlsx.write(res);
  res.end();
});

/* --- Cron Jobs --- */

// Daily Archival (Midnight)
cron.schedule('0 0 * * *', () => {
  console.log('Running Daily Archival...');
  try {
    const now = toIso();
    const info = historyStmt.archive.run({ archivedAt: now });
    historyStmt.deleteArchivedTokens.run();
    console.log(`Archived ${info.changes} tokens.`);
    io.emit('queue_update', { all: true }); // Resync all clients
  } catch (err) {
    console.error('Archival Failed:', err);
  }
});

// Daily Cleanup (1:00 AM) - Respects Retention
cron.schedule('0 1 * * *', () => {
  console.log('Running History Cleanup...');
  try {
    const offices = officesStmt.getAll.all();
    for (const office of offices) {
      if (!office.owner_id) continue;

      const owner = usersStmt.getById.get(office.owner_id);
      const retentionDays = owner?.history_retention_days || 30;

      const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000)).toISOString();

      const res = historyStmt.cleanupForOffice.run(office.id, cutoffDate);
      if (res.changes > 0) {
        console.log(`Cleaned ${res.changes} old tokens for Office ${office.name} (Retention: ${retentionDays}d)`);
      }
    }
  } catch (err) {
    console.error('Cleanup Failed:', err);
  }
});

// 404/Error
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

server.listen(port, () => {
  console.log(`Queue System Active on ${port}`);
});
