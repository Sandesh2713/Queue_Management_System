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

const path = require('path');
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const port = process.env.PORT || 4000;
const adminKey = process.env.ADMIN_KEY || 'changeme-admin-key';
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const jwtSecret = process.env.JWT_SECRET || 'super-secret-jwt-key';
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;

console.log('SMTP Config Loaded:', smtpUser ? 'Yes' : 'No');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: smtpUser,
    pass: smtpPass,
  },
});

const sendEmail = async (to, subject, text) => {
  if (!smtpUser || !smtpPass) {
    console.log('Mock Email:', { to, subject, text });
    return;
  }
  try {
    await transporter.sendMail({
      from: `"Queue System" <${smtpUser}>`,
      to,
      subject,
      text,
    });
    console.log('Email sent to', to);
  } catch (err) {
    console.error('Error sending email:', err);
  }
};

app.use(cors({ origin: clientOrigin.split(',').map((s) => s.trim()), credentials: false }));
app.use(express.json());
app.use(morgan('dev'));

const toIso = () => new Date().toISOString();

const officesStmt = {
  insert: db.prepare(`
    INSERT INTO offices (id, name, service_type, daily_capacity, available_today, operating_hours, latitude, longitude, avg_service_minutes, owner_id, created_at, history_gaps, last_call_time, service_count, consecutive_slow_count, average_velocity, is_paused)
    VALUES (@id, @name, @service_type, @daily_capacity, @available_today, @operating_hours, @latitude, @longitude, @avg_service_minutes, @owner_id, @created_at, '[]', NULL, 0, 0, 5.0, 0)
  `),
  updateAvailability: db.prepare(`UPDATE offices SET available_today = @available_today WHERE id = @id`),
  updateSettings: db.prepare(`
    UPDATE offices SET
      name = COALESCE(@name, name),
      service_type = COALESCE(@service_type, service_type),
      daily_capacity = COALESCE(@daily_capacity, daily_capacity),
      available_today = COALESCE(@available_today, available_today),
      operating_hours = COALESCE(@operating_hours, operating_hours),
      latitude = COALESCE(@latitude, latitude),
      longitude = COALESCE(@longitude, longitude),
      avg_service_minutes = COALESCE(@avg_service_minutes, avg_service_minutes)
    WHERE id = @id
  `),
  updateAlgoState: db.prepare(`
    UPDATE offices SET
      history_gaps = @history_gaps,
      last_call_time = @last_call_time,
      service_count = @service_count,
      consecutive_slow_count = @consecutive_slow_count,
      average_velocity = @average_velocity
    WHERE id = @id
  `),
  togglePause: db.prepare(`UPDATE offices SET is_paused = @is_paused WHERE id = @id`),
  getAll: db.prepare(`SELECT * FROM offices ORDER BY created_at DESC`),
  getById: db.prepare(`SELECT * FROM offices WHERE id = ?`),
};

const tokensStmt = {
  insert: db.prepare(`
    INSERT INTO tokens (id, office_id, user_name, user_contact, status, position, token_number, eta_minutes, note, created_at, user_id, lat, lng, travel_time_minutes, service_type)
    VALUES (@id, @office_id, @user_name, @user_contact, @status, @position, @token_number, @eta_minutes, @note, @created_at, @user_id, @lat, @lng, @travel_time_minutes, @service_type)
  `),
  getForOffice: db.prepare(`
    SELECT * FROM tokens
    WHERE office_id = ?
    ORDER BY
      CASE WHEN status = 'called' THEN 0 ELSE 1 END,
      created_at ASC
  `),
  getQueuedMaxPosition: db.prepare(`
    SELECT COALESCE(MAX(position), 0) as maxPos FROM tokens
    WHERE office_id = ? AND status = 'queued'
  `),
  getNextBooked: db.prepare(`
    SELECT * FROM tokens
    WHERE office_id = ? AND status = 'booked'
    ORDER BY created_at ASC
    LIMIT 1
  `),
  getNextQueued: db.prepare(`
    SELECT * FROM tokens
    WHERE office_id = ? AND status = 'queued'
    ORDER BY position ASC
    LIMIT 1
  `),
  updateStatus: db.prepare(`
    UPDATE tokens
    SET status = @status,
        called_at = COALESCE(@called_at, called_at),
        completed_at = COALESCE(@completed_at, completed_at),
        note = COALESCE(@note, note),
        eta_minutes = COALESCE(@eta_minutes, eta_minutes),
        position = COALESCE(@position, position)
    WHERE id = @id
  `),
  getById: db.prepare(`SELECT * FROM tokens WHERE id = ?`),
  getTokenNumberMax: db.prepare(`
    SELECT COALESCE(MAX(token_number), 0) as maxNum FROM tokens WHERE office_id = ?
  `),
};

const usersStmt = {
  insert: db.prepare(`
    INSERT INTO users (id, name, email, password_hash, phone, role, created_at, admin_key, dob, gender, age)
    VALUES (@id, @name, @email, @password_hash, @phone, @role, @created_at, @admin_key, @dob, @gender, @age)
  `),
  getByEmail: db.prepare(`SELECT * FROM users WHERE email = ?`),
  getById: db.prepare(`SELECT * FROM users WHERE id = ?`),
  updateVerified: db.prepare(`UPDATE users SET is_verified = 1 WHERE id = ?`),
};

const emailVerificationsStmt = {
  upsert: db.prepare(`
    INSERT INTO email_verifications (email, otp, expires_at)
    VALUES (@email, @otp, @expires_at)
    ON CONFLICT(email) DO UPDATE SET
      otp = @otp,
      expires_at = @expires_at
  `),
  get: db.prepare(`SELECT * FROM email_verifications WHERE email = ?`),
  delete: db.prepare(`DELETE FROM email_verifications WHERE email = ?`),
};

const notificationsStmt = {
  insert: db.prepare(`
    INSERT INTO notifications (id, user_id, message, is_read, created_at)
    VALUES (@id, @user_id, @message, 0, @created_at)
  `),
  getForUser: db.prepare(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC`),
  markRead: db.prepare(`UPDATE notifications SET is_read = 1 WHERE id = ?`),
};

const eventsStmt = {
  insert: db.prepare(`
    INSERT INTO queue_events (token_id, event, meta, created_at)
    VALUES (@token_id, @event, @meta, @created_at)
  `),
  getForToken: db.prepare(`
    SELECT * FROM queue_events WHERE token_id = ? ORDER BY created_at ASC
  `),
};

const historyStmt = {
  insert: db.prepare(`
    INSERT INTO token_history (id, office_id, user_id, user_name, user_contact, status, token_number, note, created_at, called_at, completed_at, service_type, archived_at)
    VALUES (@id, @office_id, @user_id, @user_name, @user_contact, @status, @token_number, @note, @created_at, @called_at, @completed_at, @service_type, @archived_at)
  `),
  getAll: db.prepare(`SELECT * FROM token_history ORDER BY archived_at DESC, created_at DESC LIMIT 500`),
};

// Cron Job: Run at 12:00 AM every day
cron.schedule('0 0 * * *', () => {
  console.log('Running daily token cleanup...');
  try {
    const txn = db.transaction(() => {
      // 1. Get all tokens to archive (all active tokens from previous day or just all tokens?)
      // The requirement says "history of token should be deleted... from queue slot and store it".
      // We will move ALL tokens to history to clear the board for the new day.
      const allTokens = db.prepare('SELECT * FROM tokens').all();

      if (allTokens.length > 0) {
        const now = toIso();
        for (const t of allTokens) {
          historyStmt.insert.run({
            id: t.id,
            office_id: t.office_id,
            user_id: t.user_id,
            user_name: t.user_name,
            user_contact: t.user_contact,
            status: t.status,
            token_number: t.token_number,
            note: t.note,
            created_at: t.created_at,
            called_at: t.called_at,
            completed_at: t.completed_at,
            service_type: t.service_type,
            archived_at: now
          });
        }

        // 2. Clear tokens table
        db.prepare('DELETE FROM tokens').run();

        // 3. Reset office availability and queue counts?
        // If tokens are gone, queue is empty.
        // Availability should reset to daily_capacity? Or stay as is?
        // Usually, a new day means full capacity resets.
        db.prepare('UPDATE offices SET available_today = daily_capacity').run();
      }
    });
    txn();
    console.log('Daily token cleanup completed.');
  } catch (err) {
    console.error('Daily token cleanup failed:', err);
  }
});

const ensureOffice = (id) => {
  const office = officesStmt.getById.get(id);
  if (!office) {
    const error = new Error('Office not found');
    error.status = 404;
    throw error;
  }
  return office;
};

const requireAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, jwtSecret);
    const user = usersStmt.getById.get(decoded.id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const recordEvent = (tokenId, event, meta = {}) => {
  eventsStmt.insert.run({
    token_id: tokenId,
    event,
    meta: JSON.stringify(meta),
    created_at: toIso(),
  });
};

const createNotification = (userId, message) => {
  try {
    notificationsStmt.insert.run({
      id: uuidv4(),
      user_id: userId,
      message,
      created_at: toIso(),
    });
  } catch (err) {
    console.error('Failed to create notification', err);
  }
};

const haversineDistance = (lat1, lon1, lat2, lon2) => {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: toIso() });
});

/* Email Verification Routes */
app.post('/api/auth/send-otp', async (req, res) => {
  const { email, type = 'verification' } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  // Generate 6 digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 mins

  let subject, body;

  if (type === 'reset') {
    subject = 'One-Time Password for Password Change Verification';
    body = `Dear User,

A request has been received to change the password for your account associated with the GetEzi.

Please use the following One-Time Password (OTP) to proceed with the password change:

OTP: ${otp}

This OTP is valid for 5 minutes and must be used only once.

For security reasons, please do not share this code with anyone.

If you did not initiate this request, please ignore this email and ensure your account credentials remain secure.

Regards,
GetEzi☘️ Team
Streamlining public service experiences`;
  } else {
    // Default: Verification
    subject = 'One-Time Password for Verification';
    body = `Dear User,

Please use the following One-Time Password (OTP) to verify your request:

OTP: ${otp}

This OTP is valid for 5 minutes and should not be shared with anyone.

If this request was not initiated by you, please disregard this email.

Regards,
GetEzi☘️ Team
Streamlining public service experiences`;
  }

  try {
    emailVerificationsStmt.upsert.run({ email, otp, expires_at: expiresAt });
    await sendEmail(email, subject, body);
    res.json({ message: 'OTP sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

app.post('/api/auth/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'Email and OTP required' });

  const record = emailVerificationsStmt.get.get(email);
  if (!record) return res.status(400).json({ error: 'No OTP found for this email' });

  if (new Date() > new Date(record.expires_at)) {
    return res.status(400).json({ error: 'OTP expired' });
  }

  if (record.otp !== otp) {
    return res.status(400).json({ error: 'Invalid OTP' });
  }

  // Verify user if exists
  const user = usersStmt.getByEmail.get(email);
  if (user) {
    usersStmt.updateVerified.run(user.id);
  }

  // Cleanup
  emailVerificationsStmt.delete.run(email);

  res.json({ success: true, message: 'Email verified successfully' });
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) return res.status(400).json({ error: 'Email, OTP, and new password required' });

  try {
    const record = emailVerificationsStmt.get.get(email);
    if (!record) return res.status(400).json({ error: 'No OTP found for this email' });

    if (new Date() > new Date(record.expires_at)) {
      return res.status(400).json({ error: 'OTP expired' });
    }

    if (record.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password
    const user = usersStmt.getByEmail.get(email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashedPassword, user.id);

    // Cleanup
    emailVerificationsStmt.delete.run(email);

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    console.error('Reset Password Error:', err.message, err.stack); // Log full details
    res.status(500).json({ error: 'Failed to reset password: ' + err.message });
  }
});

app.post('/api/offices', requireAdmin, (req, res) => {
  const { name, serviceType, dailyCapacity, operatingHours, latitude, longitude, avgServiceMinutes = 10 } = req.body;

  // Check if admin already has an office
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM offices WHERE owner_id = ?');
  const existing = countStmt.get(req.user.id);

  if (existing.count > 0) {
    return res.status(400).json({ error: 'Limit reached: You can only create one office.' });
  }

  if (!name || !serviceType || dailyCapacity === undefined) {
    return res.status(400).json({ error: 'name, serviceType, and dailyCapacity are required' });
  }

  const office = {
    id: uuidv4(),
    name,
    service_type: serviceType,
    daily_capacity: Number(dailyCapacity),
    available_today: Number(dailyCapacity),
    operating_hours: operatingHours || '',
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    avg_service_minutes: Number(avgServiceMinutes) || 10,
    owner_id: req.user.id,
    created_at: toIso(),
  };

  officesStmt.insert.run(office);
  res.status(201).json({ office });
});

/* Auth Routes */
app.post('/api/auth/register', (req, res) => {
  const { name, email, password, phone, role, adminKey, dob, gender } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }
  if (role && !['customer', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  if (role === 'admin' && !phone) {
    return res.status(400).json({ error: 'Phone number is required for Office Managers' });
  }
  const existing = usersStmt.getByEmail.get(email);
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }
  const hashedPassword = bcrypt.hashSync(password, 10);
  const calculateAge = (birthDateString) => {
    if (!birthDateString) return null;
    const today = new Date();
    const birthDate = new Date(birthDateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const user = {
    id: uuidv4(),
    name,
    email,
    password_hash: hashedPassword,
    phone: phone || '',
    role: role || 'customer',
    dob: dob || null,
    gender: gender || null,
    age: calculateAge(dob),
    is_verified: 0,
    created_at: toIso(),
    admin_key: (role === 'admin' && adminKey) ? adminKey : null,
  };
  usersStmt.insert.run(user);
  const token = jwt.sign({ id: user.id }, jwtSecret, { expiresIn: '30d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, is_verified: 0 } });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password, adminKey: providedKey } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  const user = usersStmt.getByEmail.get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Enforce Admin Key for Admin Login
  if (user.role === 'admin') {
    // Check user-specific key if exists, else fallback to global key
    const requiredKey = user.admin_key || adminKey;
    if (providedKey !== requiredKey) {
      return res.status(403).json({ error: 'Invalid Admin Key' });
    }
  }

  const token = jwt.sign({ id: user.id, role: user.role }, jwtSecret, { expiresIn: '24h' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, is_verified: user.is_verified } });
});

app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, jwtSecret);
    const user = usersStmt.getById.get(decoded.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, is_verified: user.is_verified } });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

app.get('/api/history', requireAdmin, (req, res) => {
  try {
    const history = historyStmt.getAll.all();
    res.json({ history });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

/* Notification Routes */
app.get('/api/notifications', (req, res) => {
  const userId = req.query.userId; // Simple query param for PoC (or use auth middleware)
  if (!userId) return res.json({ notifications: [] });
  const notifications = notificationsStmt.getForUser.all(userId);
  res.json({ notifications });
});

app.post('/api/notifications/:id/read', (req, res) => {
  notificationsStmt.markRead.run(req.params.id);
  res.json({ success: true });
});

app.get('/api/offices', (req, res) => {
  let stmt = officesStmt.getAll;
  let params = [];

  // Basic filter for owner if requested (requires token usually, but we'll do lightweight check or assume public for now unless specific param)
  if (req.query.owner === 'me') {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, jwtSecret);
        // Dynamic query for owner
        const specificStmt = db.prepare(`SELECT * FROM offices WHERE owner_id = ? ORDER BY created_at DESC`);
        const offices = specificStmt.all(decoded.id).map((office) => {
          const queueCount = db
            .prepare(`SELECT COUNT(*) as total FROM tokens WHERE office_id = ? AND status IN ('queued')`)
            .get(office.id).total;
          const inProgressCount = db
            .prepare(`SELECT COUNT(*) as total FROM tokens WHERE office_id = ? AND status IN ('booked','called')`)
            .get(office.id).total;
          return { ...office, queueCount, inProgressCount };
        });
        return res.json({ offices });
      } catch (e) { /* ignore invalid token, return all */ }
    }
  }

  const offices = officesStmt.getAll.all().map((office) => {
    const queueCount = db
      .prepare(`SELECT COUNT(*) as total FROM tokens WHERE office_id = ? AND status IN ('queued')`)
      .get(office.id).total;
    const inProgressCount = db
      .prepare(`SELECT COUNT(*) as total FROM tokens WHERE office_id = ? AND status IN ('booked','called')`)
      .get(office.id).total;
    return { ...office, queueCount, inProgressCount };
  });
  res.json({ offices });
});

app.get('/api/offices/:id', (req, res) => {
  const office = ensureOffice(req.params.id);
  const tokens = tokensStmt.getForOffice.all(office.id);
  const queueCount = tokens.filter(t => t.status === 'queued').length;
  const inProgressCount = tokens.filter(t => ['booked', 'called'].includes(t.status)).length;
  res.json({ office: { ...office, queueCount, inProgressCount }, tokens });
});

app.patch('/api/offices/:id/availability', requireAdmin, (req, res) => {
  const office = ensureOffice(req.params.id);
  const { availableToday } = req.body;
  if (availableToday === undefined) {
    return res.status(400).json({ error: 'availableToday is required' });
  }
  const value = Math.max(0, Number(availableToday));
  officesStmt.updateAvailability.run({ id: office.id, available_today: value });
  res.json({ id: office.id, available_today: value });
});

app.patch('/api/offices/:id/settings', requireAdmin, (req, res) => {
  const office = ensureOffice(req.params.id);
  const payload = {
    id: office.id,
    name: req.body.name,
    service_type: req.body.serviceType,
    daily_capacity: req.body.dailyCapacity !== undefined ? Number(req.body.dailyCapacity) : undefined,
    available_today: req.body.availableToday !== undefined ? Number(req.body.availableToday) : undefined,
    operating_hours: req.body.operatingHours,
    latitude: req.body.latitude,
    longitude: req.body.longitude,
    avg_service_minutes: req.body.avgServiceMinutes !== undefined ? Number(req.body.avgServiceMinutes) : undefined,
  };
  officesStmt.updateSettings.run(payload);
  const updated = officesStmt.getById.get(office.id);
  res.json({ office: updated });
});

app.post('/api/offices/:id/book', (req, res) => {
  const office = ensureOffice(req.params.id);
  const { customerName, customerContact, serviceType, note, userId, userLat, userLng } = req.body;
  if (!customerName) {
    return res.status(400).json({ error: 'customerName is required' });
  }

  const tokenNumber = tokensStmt.getTokenNumberMax.get(office.id).maxNum + 1;
  const travelTimeMinutes = haversineDistance(Number(userLat), Number(userLng), office.latitude, office.longitude)
    ? Math.ceil(haversineDistance(Number(userLat), Number(userLng), office.latitude, office.longitude)) // 1 min per km (approx 60km/h)
    : null;

  const baseToken = {
    id: uuidv4(),
    office_id: office.id,
    user_name: customerName,
    user_contact: customerContact || '',
    note: note || '',
    token_number: tokenNumber,
    created_at: toIso(),
    user_id: userId || null,
    lat: userLat || null,
    lng: userLng || null,
    travel_time_minutes: travelTimeMinutes,
    service_type: serviceType || 'General',
  };

  if (office.available_today > 0) {
    const token = {
      ...baseToken,
      status: 'booked',
      position: null,
      eta_minutes: travelTimeMinutes || 0, // Arrival time is travel time
    };
    const newAvailable = office.available_today - 1;
    const txn = db.transaction(() => {
      tokensStmt.insert.run(token);
      officesStmt.updateAvailability.run({ id: office.id, available_today: newAvailable });
      recordEvent(token.id, 'booked', { immediate: true });
    });
    txn();
    return res.status(201).json({ token, message: 'Slot booked immediately' });
  }

  const position = tokensStmt.getQueuedMaxPosition.get(office.id).maxPos + 1;
  const queueWait = Math.max(position, 1) * (office.average_velocity || office.avg_service_minutes || 10);
  const totalEta = queueWait + (travelTimeMinutes || 0);

  const token = {
    ...baseToken,
    status: 'queued',
    position,
    eta_minutes: totalEta,
  };
  const txn = db.transaction(() => {
    tokensStmt.insert.run(token);
    recordEvent(token.id, 'queued', { position, eta_minutes: queueWait });
  });
  txn();
  return res.status(201).json({ token, message: 'Added to virtual queue' });
});

app.get('/api/offices/:id/queue', (req, res) => {
  const office = ensureOffice(req.params.id);
  const tokens = tokensStmt.getForOffice.all(office.id);
  res.json({ office, tokens });
});

app.post('/api/offices/:id/call-next', requireAdmin, (req, res) => {
  const office = ensureOffice(req.params.id);

  if (office.is_paused) {
    return res.status(400).json({ error: 'Queue is paused. Resume to call next.' });
  }

  const nextBooked = tokensStmt.getNextBooked.get(office.id);
  const nextQueued = tokensStmt.getNextQueued.get(office.id);
  let chosen = nextBooked || nextQueued;

  if (!chosen) {
    return res.status(404).json({ error: 'No tokens to call' });
  }

  // --- MASTER ALGORITHM PHASE A (Velocity Calculation) ---
  const now = new Date();
  const lastCall = office.last_call_time ? new Date(office.last_call_time) : null;
  const currentGapMinutes = lastCall ? (now - lastCall) / 1000 / 60 : 0; // minutes

  let newServiceCount = (office.service_count || 0) + 1;
  let newSlowCount = office.consecutive_slow_count || 0;
  let historyGaps = [];
  try { historyGaps = JSON.parse(office.history_gaps || '[]'); } catch (e) { }
  let newVelocity = office.average_velocity || 5.0;
  let shouldUpdateVelocity = false;

  // --- MASTER ALGORITHM PHASE B (Logic Filter) ---
  if (lastCall) {
    if (newServiceCount <= 5) {
      // Step 1: Cold Start -> ACCEPT immediately
      shouldUpdateVelocity = true;
    } else if (currentGapMinutes * 60 < 10) { // Gap < 10 seconds
      // Step 2: Mistake Filter -> IGNORE
      shouldUpdateVelocity = false;
    } else if (currentGapMinutes > 20) {
      // Step 3: Slowdown Check
      newSlowCount++;
      if (newSlowCount >= 3) {
        // Recognized as permanent slowdown -> ACCEPT
        shouldUpdateVelocity = true;
      } else {
        // Assume Lunch/Break -> IGNORE gap, but track slow count
        shouldUpdateVelocity = false;
      }
    } else {
      // Normal Case -> ACCEPT
      shouldUpdateVelocity = true;
      newSlowCount = 0; // Reset consecutive slow count
    }
  } else {
    // First call ever (or after reset)
    shouldUpdateVelocity = true; // Initialize
  }

  // --- MASTER ALGORITHM PHASE C (Update Variables) ---
  if (shouldUpdateVelocity && currentGapMinutes > 0) {
    historyGaps.push(currentGapMinutes);
    if (historyGaps.length > 5) historyGaps.shift(); // Keep last 5

    // Recalculate Average Velocity
    const sum = historyGaps.reduce((a, b) => a + b, 0);
    newVelocity = sum / historyGaps.length;

    // Safety clamp (optional): Don't let velocity drop too low or high? 
    // For now, raw calculation as per algorithm.
  }

  // --- MASTER ALGORITHM PHASE D (Allocation & DB Updates) ---
  const activateToken = (t) => {
    if (t.status === 'queued') {
      if (office.available_today <= 0) {
        // Master Algo Note: If capacity restricted, we decrement.
        // If not restricted (virtual queue unlimited), this check might be strict.
        // Assuming original logic:
        // throw new Error('No seats freed yet to call queued users'); 
        // We'll relax this or keep it. Let's keep it but handle "Backlog" logic implicitly.
        // If Backlog exists, they enter Main Queue (pos 20 -> 19...).
        // But 'available_today' tracks physical seats/capacity.

        // Fix: If fully booked, we can't call walk-in unless a seat opens?
        // Actually, calling a walk-in consumes a seat. 
        // If available_today is 0, it means all seats are taken (by whom? booked appointments).
        // If we call a queued person, we need a seat. 
        // Usually, 'Complete' liberates a seat. 'Call' fills it.
        // So we strictly shouldn't call if 0. 
        // BUT logic says: "Move top user from Backlog to Main Queue".
        // Let's assume 'Call' happens when a seat IS free (implied by Admin action).

        // For now, decrement if > 0.
      }
      if (office.available_today > 0) {
        officesStmt.updateAvailability.run({ id: office.id, available_today: office.available_today - 1 });
      }
    }

    tokensStmt.updateStatus.run({
      id: t.id,
      status: 'called',
      called_at: toIso(),
      position: null,
      completed_at: undefined,
      note: undefined,
      eta_minutes: undefined,
    });

    // Shift Queue Positions
    // Everyone in 'queued' status drops by 1 position (e.g. 2->1, 21->20).
    // This automatically moves Backlog (21+) into Main (<=20).
    db.prepare(`UPDATE tokens SET position = position - 1 WHERE office_id = ? AND status = 'queued' AND position > 0`).run(office.id);

    // Update Office Algo State
    officesStmt.updateAlgoState.run({
      id: office.id,
      history_gaps: JSON.stringify(historyGaps),
      last_call_time: toIso(),
      service_count: newServiceCount,
      consecutive_slow_count: newSlowCount,
      average_velocity: newVelocity
    });

    recordEvent(t.id, 'called', { via: t.status, velocity: newVelocity });

    // Notify UPCOMING tokens (Proximity Alert)
    // New Formula: Wait Time = Pos * AvgVelocity.
    // Alert if (WaitTime - TravelTime) <= 20 mins.
    const queuedTokens = db.prepare(`
      SELECT * FROM tokens WHERE office_id = ? AND status = 'queued' ORDER BY position ASC LIMIT 10
    `).all(office.id);

    queuedTokens.forEach((qt) => {
      const waitTime = qt.position * newVelocity;
      const travel = qt.travel_time_minutes || 15;
      const buffer = waitTime - travel;

      if (buffer <= 20 && qt.user_id) {
        const check = db.prepare(`SELECT 1 FROM notifications WHERE user_id = ? AND message LIKE 'Your turn%'`).get(qt.user_id);
        if (!check) {
          createNotification(qt.user_id, `Your turn at ${office.name} is approaching! ETA: ${Math.round(waitTime)} mins.`);
        }
      }
    });

    if (t.user_id) {
      createNotification(t.user_id, `You have been called at ${office.name}. Please proceed to the desk.`);
    }
  };

  try {
    const txn = db.transaction(() => activateToken(chosen));
    txn();
  } catch (err) {
    return res.status(409).json({ error: err.message });
  }

  chosen = tokensStmt.getById.get(chosen.id);
  res.json({ token: chosen, message: 'Customer called', velocity: newVelocity });
});

app.post('/api/tokens/:id/cancel', (req, res) => {
  const token = tokensStmt.getById.get(req.params.id);
  if (!token) {
    return res.status(404).json({ error: 'Token not found' });
  }

  const office = ensureOffice(token.office_id);
  let availability = office.available_today;
  if (['booked', 'called'].includes(token.status)) {
    availability += 1;
  }

  const txn = db.transaction(() => {
    officesStmt.updateAvailability.run({ id: office.id, available_today: availability });
    tokensStmt.updateStatus.run({
      id: token.id,
      status: 'cancelled',
      called_at: null,
      completed_at: null,
      note: null,
      eta_minutes: null,
      position: null
    });
    // Shift queue up if they were queued?
    if (token.status === 'queued') {
      db.prepare(`UPDATE tokens SET position = position - 1 WHERE office_id = ? AND status = 'queued' AND position > ?`).run(office.id, token.position);
    }

    recordEvent(token.id, 'cancelled');
  });
  txn();

  res.json({ id: token.id, status: 'cancelled', available_today: availability });
});

/* MASTER ALGORITHM: PAUSE */
app.post('/api/offices/:id/pause', requireAdmin, (req, res) => {
  const office = ensureOffice(req.params.id);
  const { paused } = req.body; // true/false
  officesStmt.togglePause.run({ id: office.id, is_paused: paused ? 1 : 0 });
  res.json({ success: true, is_paused: paused ? 1 : 0 });
});

/* MASTER ALGORITHM: NO-SHOW (Holding) */
app.post('/api/tokens/:id/no-show', requireAdmin, (req, res) => {
  const token = tokensStmt.getById.get(req.params.id);
  if (!token) return res.status(404).json({ error: 'Token not found' });
  const office = ensureOffice(token.office_id);

  const txn = db.transaction(() => {
    // If they were 'called' (which they likely were if doctor is marking no-show), we free up the seat?
    // Usually 'No Show' means we called them, they didn't come.
    // So we treat it like 'Complete' for availability purposes (seat is now free for next),
    // but we move them to 'holding'.

    // Status update
    tokensStmt.updateStatus.run({
      id: token.id,
      status: 'holding',
      called_at: token.called_at, // Keep called time or clear? Clear probably better or keep for history.
      completed_at: null,
      note: 'Moved to holding (No-Show)',
      eta_minutes: null,
      position: null
    });

    recordEvent(token.id, 'no-show');
  });
  txn();

  res.json({ success: true });
});

/* MASTER ALGORITHM: RE-QUEUE (Penalty) */
app.post('/api/tokens/:id/re-queue', requireAdmin, (req, res) => {
  const token = tokensStmt.getById.get(req.params.id);
  if (!token) return res.status(404).json({ error: 'Token not found' });
  const office = ensureOffice(token.office_id);

  const txn = db.transaction(() => {
    // 1. Shift everyone at position >= 3 DOWN by 1
    db.prepare(`UPDATE tokens SET position = position + 1 WHERE office_id = ? AND status = 'queued' AND position >= 3`).run(office.id);

    // 2. Insert at Position 3
    // Use raw query for partial update to avoid wiping other fields if updateStatus is strict
    // but updateStatus helper is fine.
    tokensStmt.updateStatus.run({
      id: token.id,
      status: 'queued',
      updated_at: toIso(),
      position: 3,
      called_at: null,
      completed_at: null,
      eta_minutes: 3 * office.average_velocity, // Approx
      note: 'Re-queued from holding'
    });

    recordEvent(token.id, 're-queued', { position: 3 });
  });
  txn();

  res.json({ success: true, position: 3 });
});

app.post('/api/tokens/:id/complete', requireAdmin, (req, res) => {
  const token = tokensStmt.getById.get(req.params.id);
  if (!token) {
    return res.status(404).json({ error: 'Token not found' });
  }
  const office = ensureOffice(token.office_id);
  let availability = office.available_today;
  if (['booked', 'called'].includes(token.status)) {
    availability += 1;
  }
  const txn = db.transaction(() => {
    officesStmt.updateAvailability.run({ id: office.id, available_today: availability });
    tokensStmt.updateStatus.run({
      id: token.id,
      status: 'completed',
      completed_at: toIso(),
      called_at: null,
      note: null,
      eta_minutes: null,
      position: null
    });
    recordEvent(token.id, 'completed');
  });
  txn();
  res.json({ id: token.id, status: 'completed', available_today: availability });
});

app.post('/api/tokens/:id/no-show', requireAdmin, (req, res) => {
  const token = tokensStmt.getById.get(req.params.id);
  if (!token) {
    return res.status(404).json({ error: 'Token not found' });
  }
  const office = ensureOffice(token.office_id);

  // Strategy: "Defer". Swap current (Called) with Next (Booked/Queued).
  // If no Next, just move Current to Queue Head and free desk.

  const nextBooked = tokensStmt.getNextBooked.get(office.id);
  const nextQueued = tokensStmt.getNextQueued.get(office.id);
  let candidate = nextBooked || nextQueued;

  const txn = db.transaction(() => {
    let newStatusToken = { ...token, status: 'queued', called_at: null, completed_at: null, note: token.note || null };
    let newAvailability = office.available_today;

    if (candidate) {
      // If candidate was in queue, we can swap positions nicely to minimize disruption
      if (candidate.status === 'queued') {
        // Swap: Token takes Candidate's position. Candidate leaves queue.
        newStatusToken.position = candidate.position;
      } else {
        // Candidate was Booked (no position).
        // Shift all queued items + 1
        db.prepare("UPDATE tokens SET position = position + 1 WHERE office_id = ? AND status = 'queued'").run(office.id);
        newStatusToken.position = 1;
      }

      // Update Candidate to Called
      tokensStmt.updateStatus.run({
        id: candidate.id,
        status: 'called',
        called_at: toIso(),
        position: null,
        completed_at: undefined,
        note: candidate.note || undefined,
        eta_minutes: undefined
      });

      if (candidate.user_id) {
        createNotification(candidate.user_id, `You have been called at ${office.name}. please proceed to the desk.`);
      }
    } else {
      // No one waiting.
      // Just move Token to Queue.
      // Shift just in case
      db.prepare("UPDATE tokens SET position = position + 1 WHERE office_id = ? AND status = 'queued'").run(office.id);
      newStatusToken.position = 1;

      // Desk becomes free
      if (['booked', 'called'].includes(token.status)) {
        newAvailability += 1;
        officesStmt.updateAvailability.run({ id: office.id, available_today: newAvailability });
      }
    }

    // Update Token to Queued
    tokensStmt.updateStatus.run({
      id: token.id,
      status: 'queued',
      called_at: null,
      position: newStatusToken.position,
      completed_at: undefined,
      note: newStatusToken.note || undefined,
      eta_minutes: undefined
    });

    recordEvent(token.id, 'deferred', { swappedWith: candidate?.id });
    if (candidate) recordEvent(candidate.id, 'called', { via: 'defer_swap' });
  });

  txn();

  // Refetch to return clean state
  const updatedToken = tokensStmt.getById.get(token.id);
  res.json({ token: updatedToken, message: candidate ? `Deferred. Called ${candidate.user_name}` : 'Deferred to queue.' });
});

app.get('/api/tokens/:id', (req, res) => {
  const token = tokensStmt.getById.get(req.params.id);
  if (!token) {
    return res.status(404).json({ error: 'Token not found' });
  }
  const events = eventsStmt.getForToken.all(token.id);
  res.json({ token, events });
});

// Fallback 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

app.listen(port, () => {
  console.log(`Queue Management API running on http://localhost:${port}`);
  console.log(`Admin key required in header x-admin-key`);
});

