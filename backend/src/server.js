const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
const dotenv = require('dotenv');
const db = require('./db');

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;
const adminKey = process.env.ADMIN_KEY || 'changeme-admin-key';
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: clientOrigin.split(',').map((s) => s.trim()), credentials: false }));
app.use(express.json());
app.use(morgan('dev'));

const toIso = () => new Date().toISOString();

const officesStmt = {
  insert: db.prepare(`
    INSERT INTO offices (id, name, service_type, daily_capacity, available_today, operating_hours, latitude, longitude, avg_service_minutes, created_at)
    VALUES (@id, @name, @service_type, @daily_capacity, @available_today, @operating_hours, @latitude, @longitude, @avg_service_minutes, @created_at)
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
  getAll: db.prepare(`SELECT * FROM offices ORDER BY created_at DESC`),
  getById: db.prepare(`SELECT * FROM offices WHERE id = ?`),
};

const tokensStmt = {
  insert: db.prepare(`
    INSERT INTO tokens (id, office_id, user_name, user_contact, status, position, token_number, eta_minutes, note, created_at)
    VALUES (@id, @office_id, @user_name, @user_contact, @status, @position, @token_number, @eta_minutes, @note, @created_at)
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

const eventsStmt = {
  insert: db.prepare(`
    INSERT INTO queue_events (token_id, event, meta, created_at)
    VALUES (@token_id, @event, @meta, @created_at)
  `),
  getForToken: db.prepare(`
    SELECT * FROM queue_events WHERE token_id = ? ORDER BY created_at ASC
  `),
};

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
  if (req.headers['x-admin-key'] !== adminKey) {
    return res.status(401).json({ error: 'Invalid admin key' });
  }
  return next();
};

const recordEvent = (tokenId, event, meta = {}) => {
  eventsStmt.insert.run({
    token_id: tokenId,
    event,
    meta: JSON.stringify(meta),
    created_at: toIso(),
  });
};

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: toIso() });
});

app.post('/api/offices', requireAdmin, (req, res) => {
  const { name, serviceType, dailyCapacity, operatingHours, latitude, longitude, avgServiceMinutes = 10 } = req.body;
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
    created_at: toIso(),
  };

  officesStmt.insert.run(office);
  res.status(201).json({ office });
});

app.get('/api/offices', (req, res) => {
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
  res.json({ office, tokens });
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
  const { customerName, customerContact, note } = req.body;
  if (!customerName) {
    return res.status(400).json({ error: 'customerName is required' });
  }

  const tokenNumber = tokensStmt.getTokenNumberMax.get(office.id).maxNum + 1;

  if (office.available_today > 0) {
    const token = {
      id: uuidv4(),
      office_id: office.id,
      user_name: customerName,
      user_contact: customerContact || '',
      status: 'booked',
      position: null,
      token_number: tokenNumber,
      eta_minutes: 0,
      note: note || '',
      created_at: toIso(),
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
  const eta = Math.max(position, 1) * (office.avg_service_minutes || 10);
  const token = {
    id: uuidv4(),
    office_id: office.id,
    user_name: customerName,
    user_contact: customerContact || '',
    status: 'queued',
    position,
    token_number: tokenNumber,
    eta_minutes: eta,
    note: note || '',
    created_at: toIso(),
  };
  const txn = db.transaction(() => {
    tokensStmt.insert.run(token);
    recordEvent(token.id, 'queued', { position, eta_minutes: eta });
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
  const nextBooked = tokensStmt.getNextBooked.get(office.id);
  const nextQueued = tokensStmt.getNextQueued.get(office.id);
  let chosen = nextBooked || nextQueued;

  if (!chosen) {
    return res.status(404).json({ error: 'No tokens to call' });
  }

  if (chosen.status === 'queued') {
    if (office.available_today <= 0) {
      return res.status(409).json({ error: 'No seats freed yet to call queued users' });
    }
    const newAvailable = office.available_today - 1;
    const txn = db.transaction(() => {
      officesStmt.updateAvailability.run({ id: office.id, available_today: newAvailable });
      tokensStmt.updateStatus.run({
        id: chosen.id,
        status: 'called',
        called_at: toIso(),
        position: null,
      });
      recordEvent(chosen.id, 'called', { via: 'queue' });
    });
    txn();
  } else {
    tokensStmt.updateStatus.run({
      id: chosen.id,
      status: 'called',
      called_at: toIso(),
    });
    recordEvent(chosen.id, 'called', { via: 'booked' });
  }

  chosen = tokensStmt.getById.get(chosen.id);
  res.json({ token: chosen, message: 'Customer called' });
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
    tokensStmt.updateStatus.run({ id: token.id, status: 'cancelled' });
    recordEvent(token.id, 'cancelled');
  });
  txn();

  res.json({ id: token.id, status: 'cancelled', available_today: availability });
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
    tokensStmt.updateStatus.run({ id: token.id, status: 'completed', completed_at: toIso() });
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
  let availability = office.available_today;
  if (['booked', 'called'].includes(token.status)) {
    availability += 1;
  }
  const txn = db.transaction(() => {
    officesStmt.updateAvailability.run({ id: office.id, available_today: availability });
    tokensStmt.updateStatus.run({ id: token.id, status: 'no-show', completed_at: toIso() });
    recordEvent(token.id, 'no-show');
  });
  txn();
  res.json({ id: token.id, status: 'no-show', available_today: availability });
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

