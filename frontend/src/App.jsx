import { useEffect, useMemo, useState, useRef } from 'react';
import './App.css';
import { useAuth } from './AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

async function fetchJSON(path, options = {}) {
  const token = sessionStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

function TokenRow({ token, onCancel, onComplete, onNoShow, isAdmin }) {
  return (
    <div className="token-row">
      <div>
        <div className="token-label">Token #{token.token_number}</div>
        <div className="token-meta">
          {token.user_name} · {token.status}
          {token.position ? ` · pos ${token.position}` : ''}
          {token.travel_time_minutes ? ` · ${token.travel_time_minutes} min away` : ''}
        </div>
      </div>
      <div className="token-actions">
        <span className="token-chip">{token.status}</span>
        {isAdmin && (
          <>
            <button className="ghost" onClick={() => onComplete(token.id)}>Complete</button>
            <button className="ghost" onClick={() => onNoShow(token.id)}>No-show</button>
          </>
        )}
        <button className="ghost danger" onClick={() => onCancel(token.id)}>Cancel</button>
      </div>
    </div>
  );
}

function LoginView({ onSuccess, onSwitch }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(email, password);
      onSuccess();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-container">
      <h2>Login</h2>
      {error && <div className="message">{error}</div>}
      <form onSubmit={handleSubmit}>
        <label className="field">
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button type="submit">Login</button>
      </form>
      <button className="auth-toggle" onClick={onSwitch}>Need an account? Register</button>
    </div>
  );
}

function RegisterView({ onSuccess, onSwitch }) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('customer');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await register(name, email, password, phone, role);
      onSuccess();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-container">
      <h2>Register</h2>
      {error && <div className="message">{error}</div>}
      <form onSubmit={handleSubmit}>
        <label className="field">
          <span>Name</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="field">
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <label className="field">
          <span>Phone (optional)</span>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label className="field">
          <span>Account Type</span>
          <select value={role} onChange={(e) => setRole(e.target.value)} style={{ padding: '12px', borderRadius: '12px', border: '1px solid var(--gray-300)' }}>
            <option value="customer">Customer</option>
            <option value="admin">Admin (Office Manager)</option>
          </select>
        </label>
        <button type="submit">Register</button>
      </form>
      <button className="auth-toggle" onClick={onSwitch}>Have an account? Login</button>
    </div>
  );
}

function NotificationPanel({ userId, onClose }) {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    fetchJSON(`/api/notifications?userId=${userId}`).then((data) => {
      setNotifications(data.notifications || []);
    });
  }, [userId]);

  const markRead = async (id) => {
    await fetchJSON(`/api/notifications/${id}/read`, { method: 'POST' });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n))
    );
  };

  return (
    <div className="notification-panel">
      <div className="panel-header">
        <h4>Notifications</h4>
        <button className="ghost" onClick={onClose}>Close</button>
      </div>
      <div className="notification-list-container">
        {notifications.length === 0 && <div className="notification-empty">No notifications</div>}
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`notification-item ${n.is_read ? '' : 'unread'}`}
            onClick={() => markRead(n.id)}
          >
            <div className="notification-content">
              <div>{n.message}</div>
              {/* Simulated timestamp if missing */}
              <div className="notification-time">Just now</div>
            </div>
            {!n.is_read && <div className="notification-mark">✓</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function App() {
  const { user, logout, loading: authLoading } = useAuth();
  // Enforce login gate: if not logged in, default to 'login'
  const [view, setView] = useState(user ? (user.role === 'admin' ? 'admin' : 'customer') : 'login');
  const [offices, setOffices] = useState([]);
  const [selectedOfficeId, setSelectedOfficeId] = useState('');
  const [selectedOfficeData, setSelectedOfficeData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  // Form states
  const [newOffice, setNewOffice] = useState({ name: '', serviceType: '', dailyCapacity: 20, operatingHours: '09:00-17:00', avgServiceMinutes: 10, latitude: '', longitude: '' });
  const [bookingForm, setBookingForm] = useState({ customerName: '', customerContact: '', note: '' });
  const [availabilityInput, setAvailabilityInput] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const selectedOffice = useMemo(() => selectedOfficeData?.office || null, [selectedOfficeData]);

  // Poll for notifications if logged in
  useEffect(() => {
    if (!user) return;
    const check = () => {
      fetchJSON(`/api/notifications?userId=${user.id}`).then((data) => {
        const unread = (data.notifications || []).filter(n => !n.is_read).length;
        setNotificationCount(unread);
      }).catch(() => { });
    };
    check();
    const interval = setInterval(check, 10000); // 10s poll
    return () => clearInterval(interval);
  }, [user]);

  // Auto-fill booking form if logged in
  useEffect(() => {
    if (user) {
      setBookingForm((prev) => ({ ...prev, customerName: user.name, customerContact: user.email }));
      // If we were on login/register pages, switch to assigned role view
      if (view === 'login' || view === 'register') {
        setView(user.role === 'admin' ? 'admin' : 'customer');
      }
    } else {
      // If logged out, force login view
      setView('login');
    }
  }, [user]);

  useEffect(() => {
    loadOffices();
  }, []);

  useEffect(() => {
    if (selectedOfficeId) fetchOfficeDetail(selectedOfficeId);
  }, [selectedOfficeId]);

  const loadOffices = async () => {
    try {
      setLoading(true);
      const data = await fetchJSON('/api/offices');
      setOffices(data.offices);
      if (!selectedOfficeId && data.offices.length) setSelectedOfficeId(data.offices[0].id);
    } catch (err) { setMessage(err.message); } finally { setLoading(false); }
  };

  const fetchOfficeDetail = async (id) => {
    try {
      setLoading(true);
      const data = await fetchJSON(`/api/offices/${id}`);
      setSelectedOfficeData(data);
      setAvailabilityInput(data.office.available_today);
    } catch (err) { setMessage(err.message); } finally { setLoading(false); }
  };

  const handleBooking = async () => {
    if (!selectedOfficeId) return setMessage('Choose an office');
    if (!bookingForm.customerName) return setMessage('Name required');

    try {
      setIsBusy(true);
      let coords = {};
      // Request location
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        coords = { userLat: pos.coords.latitude, userLng: pos.coords.longitude };
      } catch (e) {
        console.warn('Geolocation failed', e);
        // Continue without location
      }

      await fetchJSON(`/api/offices/${selectedOfficeId}/book`, {
        method: 'POST',
        body: JSON.stringify({
          ...bookingForm,
          userId: user?.id,
          ...coords
        }),
      });
      setMessage('Booking successful!');
      setBookingForm({ customerName: user?.name || '', customerContact: user?.email || '', note: '' });
      await Promise.all([loadOffices(), fetchOfficeDetail(selectedOfficeId)]);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleCreateOffice = async () => {
    if (!adminKey) return setMessage('Admin key required');
    try {
      setIsBusy(true);
      await fetchJSON('/api/offices', {
        method: 'POST',
        headers: { 'x-admin-key': adminKey },
        body: JSON.stringify(newOffice),
      });
      setMessage('Office created');
      await loadOffices();
    } catch (err) { setMessage(err.message); } finally { setIsBusy(false); }
  };

  const handleAvailabilityUpdate = async () => {
    if (!adminKey) return setMessage('Admin key required');
    try {
      await fetchJSON(`/api/offices/${selectedOfficeId}/availability`, {
        method: 'PATCH',
        headers: { 'x-admin-key': adminKey },
        body: JSON.stringify({ availableToday: Number(availabilityInput) }),
      });
      setMessage('Availability updated');
      fetchOfficeDetail(selectedOfficeId);
    } catch (err) { setMessage(err.message); }
  };

  const callNext = async () => {
    if (!adminKey) return setMessage('Admin key required');
    try {
      const data = await fetchJSON(`/api/offices/${selectedOfficeId}/call-next`, {
        method: 'POST',
        headers: { 'x-admin-key': adminKey },
      });
      setMessage(`Called ${data.token.user_name}`);
      fetchOfficeDetail(selectedOfficeId);
    } catch (err) { setMessage(err.message); }
  };

  const updateToken = async (id, action) => {
    try {
      let headers = action !== 'cancel' ? { 'x-admin-key': adminKey } : {};
      await fetchJSON(`/api/tokens/${id}/${action}`, { method: 'POST', headers });
      setMessage(`Token ${action}d`);
      fetchOfficeDetail(selectedOfficeId);
    } catch (err) { setMessage(err.message); }
  };

  if (authLoading) return <div>Loading app...</div>;

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <div className="eyebrow">Queue Management System</div>
          <h1>Serve people faster</h1>
        </div>
        <div className="user-menu">
          {!user ? (
            <button onClick={() => setView('login')}>Login / Register</button>
          ) : (
            <>
              <span>Hi, {user.name}</span>
              <div className="bell-icon" onClick={() => setShowNotifications(!showNotifications)}>
                🔔
                {notificationCount > 0 && <span className="bell-count">{notificationCount}</span>}
              </div>
              <button className="ghost" onClick={logout}>Logout</button>
            </>
          )}
        </div>
      </header>

      {showNotifications && user && (
        <NotificationPanel userId={user.id} onClose={() => setShowNotifications(false)} />
      )}

      {message && <div className="message">{message}</div>}

      {view === 'login' || (!user && view !== 'register') ? (
        <LoginView onSuccess={() => { }} onSwitch={() => setView('register')} />
      ) : view === 'register' ? (
        <RegisterView onSuccess={() => { }} onSwitch={() => setView('login')} />
      ) : (
        <div className="layout">
          <aside className="panel">
            <div className="view-toggle" style={{ marginBottom: 20 }}>
              {/* Role-based: show only relevant view or both if dual-role (simplified to strict separation) */}
              <div className="eyebrow" style={{ marginBottom: 0 }}>Logged in as {user.role}</div>
            </div>

            <div className="panel-header">
              <h3>Offices</h3>
              <button className="ghost" onClick={loadOffices} disabled={loading}>Refresh</button>
            </div>
            {loading && <div className="muted">Loading...</div>}
            <div className="office-list">
              {offices.map((office) => (
                <button
                  key={office.id}
                  className={`office-card ${selectedOfficeId === office.id ? 'selected' : ''}`}
                  onClick={() => setSelectedOfficeId(office.id)}
                >
                  <div className="office-name">{office.name}</div>
                  <div className="office-service">{office.service_type}</div>
                  <div className="office-meta">
                    <span>Avail: {office.available_today}</span>
                    <span>Queue: {office.queueCount}</span>
                  </div>
                </button>
              ))}
            </div>

            {view === 'admin' && (
              <div className="panel-section">
                <h4>Create Office</h4>
                <div className="field-grid">
                  <label>Name<input value={newOffice.name} onChange={e => setNewOffice({ ...newOffice, name: e.target.value })} /></label>
                  <label>Service<input value={newOffice.serviceType} onChange={e => setNewOffice({ ...newOffice, serviceType: e.target.value })} /></label>
                  <label>Capacity<input type="number" value={newOffice.dailyCapacity} onChange={e => setNewOffice({ ...newOffice, dailyCapacity: Number(e.target.value) })} /></label>
                  <label>Lat<input value={newOffice.latitude} onChange={e => setNewOffice({ ...newOffice, latitude: e.target.value })} /></label>
                  <label>Lng<input value={newOffice.longitude} onChange={e => setNewOffice({ ...newOffice, longitude: e.target.value })} /></label>
                  <label>Key<input value={adminKey} onChange={e => setAdminKey(e.target.value)} /></label>
                </div>
                <button onClick={handleCreateOffice} disabled={isBusy}>Create</button>
              </div>
            )}
          </aside>

          <main className="panel">
            {!selectedOffice ? <div className="muted">Select office</div> : (
              <>
                <div className="panel-header">
                  <h3>{selectedOffice.name}</h3>
                  <div className="stat-group">
                    <Stat label="Wait" value={`${selectedOffice.queueCount * selectedOffice.avg_service_minutes}m`} />
                    <Stat label="Avail" value={selectedOffice.available_today} />
                  </div>
                </div>

                {view === 'customer' && (
                  <section className="panel-section">
                    <h4>Book Slot</h4>
                    <div className="field-grid">
                      <label>Name<input value={bookingForm.customerName} onChange={e => setBookingForm({ ...bookingForm, customerName: e.target.value })} /></label>
                      <label>Contact<input value={bookingForm.customerContact} onChange={e => setBookingForm({ ...bookingForm, customerContact: e.target.value })} /></label>
                    </div>
                    <button onClick={handleBooking} disabled={isBusy}>
                      {selectedOffice.available_today > 0 ? 'Book Now' : 'Join Queue'}
                    </button>
                  </section>
                )}

                {view === 'admin' && (
                  <section className="panel-section">
                    <h4>Admin Controls</h4>
                    <div className="field-grid">
                      <label>Availability<input type="number" value={availabilityInput} onChange={e => setAvailabilityInput(e.target.value)} /></label>
                      <label>Key<input value={adminKey} onChange={e => setAdminKey(e.target.value)} /></label>
                    </div>
                    <div className="button-row">
                      <button onClick={handleAvailabilityUpdate}>Update</button>
                      <button onClick={callNext}>Call Next</button>
                    </div>
                  </section>
                )}

                <section className="panel-section">
                  <h4>Queue Status</h4>
                  <div className="token-list">
                    {(selectedOfficeData?.tokens || []).map(t => (
                      <TokenRow key={t.id} token={t} onCancel={id => updateToken(id, 'cancel')} onComplete={id => updateToken(id, 'complete')} onNoShow={id => updateToken(id, 'no-show')} isAdmin={view === 'admin'} />
                    ))}
                  </div>
                </section>
              </>
            )}
          </main>
        </div>
      )}
    </div>
  );
}

export default App;
