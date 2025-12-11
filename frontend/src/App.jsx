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

function TokenRow({ token, onCancel, onComplete, onNoShow, isAdmin, currentUser }) {
  const isOwner = currentUser?.id === token.user_id;
  const isTerminal = ['cancelled', 'completed', 'no-show'].includes(token.status);

  return (
    <div className="token-row">
      <div>
        <div className="token-label">Token #{token.token_number}</div>
        <div className="token-meta">
          {token.user_name} · {token.status}
          {token.position ? ` · pos ${token.position}` : ''}

        </div>
      </div>
      <div className="token-actions">
        <span className="token-chip">{token.status}</span>
        {!isTerminal && (
          <>
            {isAdmin && (
              <>
                <button className="ghost" onClick={() => onComplete(token.id)}>Complete</button>
                <button className="ghost" onClick={() => onNoShow(token.id)}>No-show</button>
              </>
            )}
            {(isAdmin || isOwner) && (
              <button className="ghost danger" onClick={() => onCancel(token.id)}>Cancel</button>
            )}
          </>
        )}
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

// MapPicker Component
function MapPicker({ onSelect }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    if (mapRef.current && !mapInstance.current && window.L) {
      mapInstance.current = window.L.map(mapRef.current).setView([20, 78], 4); // Default India view
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(mapInstance.current);

      mapInstance.current.on('click', (e) => {
        const { lat, lng } = e.latlng;
        if (markerRef.current) markerRef.current.remove();
        markerRef.current = window.L.marker([lat, lng]).addTo(mapInstance.current);
        onSelect({ lat, lng });
      });

      // Try to get current location
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          mapInstance.current.setView([latitude, longitude], 13);
        },
        () => { },
        { timeout: 5000 }
      );
    }

    // Cleanup
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [onSelect]);

  return <div ref={mapRef} style={{ height: '300px', width: '100%', borderRadius: '12px', marginTop: '16px' }} />;
}

// Booking Modal Component
function BookingModal({ isOpen, onClose, onSubmit, office, user }) {
  if (!isOpen) return null;
  const [form, setForm] = useState({
    customerName: user?.name || '',
    customerEmail: '', // Explicitly empty as requested
    customerContact: '',
    serviceType: '',
    userLat: null,
    userLng: null
  });
  const [locationStatus, setLocationStatus] = useState('');

  const handleSubmit = () => {
    onSubmit(form);
    onClose();
  };

  const detectLocation = () => {
    setLocationStatus('Detecting...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm(prev => ({ ...prev, userLat: pos.coords.latitude, userLng: pos.coords.longitude }));
        setLocationStatus('detected');
      },
      () => setLocationStatus('failed'),
      { timeout: 5000 }
    );
  };

  return (
    <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
      <div className="modal-content" style={{ background: '#fff', padding: '24px', borderRadius: '24px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ marginBottom: '20px' }}>Book Appointment</h3>

        <div className="field-grid" style={{ gridTemplateColumns: '1fr', gap: '16px' }}>
          <label className="field">
            <span>Name</span>
            <input value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <label className="field">
              <span>Email</span>
              <input type="email" value={form.customerEmail} onChange={e => setForm({ ...form, customerEmail: e.target.value })} required />
            </label>
            <label className="field">
              <span>Phone (Optional)</span>
              <input type="tel" value={form.customerContact} onChange={e => setForm({ ...form, customerContact: e.target.value })} />
            </label>
          </div>
          <label className="field">
            <span>Service Type</span>
            <select value={form.serviceType} onChange={e => setForm({ ...form, serviceType: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--gray-300)', background: '#fff' }}>
              <option value="">Select Service...</option>
              <option value="General Inquiry">General Inquiry</option>
              <option value="Billing">Billing</option>
              <option value="Technical Support">Technical Support</option>
              <option value="New Connection">New Connection</option>
            </select>
          </label>

          <div style={{ border: '1px solid var(--gray-200)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontWeight: '500', fontSize: '14px' }}>Location for ETA</span>
              <button type="button" className="ghost" onClick={detectLocation} style={{ fontSize: '12px', padding: '4px 8px' }}>
                📍 Detect Current
              </button>
            </div>
            {locationStatus === 'detected' && <div style={{ fontSize: '12px', color: 'green', marginBottom: '8px' }}>✓ Location acquired</div>}
            {locationStatus === 'failed' && <div style={{ fontSize: '12px', color: 'red', marginBottom: '8px' }}>⚠ Detection failed, please pick on map</div>}

            <div style={{ fontSize: '12px', color: 'var(--gray-500)', marginBottom: '8px' }}>Or select on map:</div>
            <MapPicker onSelect={({ lat, lng }) => {
              setForm(f => ({ ...f, userLat: lat, userLng: lng }));
              setLocationStatus('detected');
            }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          <button className="ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button onClick={handleSubmit} disabled={!form.customerName || !form.serviceType || (!form.userLat && !form.userLng)} style={{ flex: 1 }}>
            Confirm Booking
          </button>
        </div>
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

  // Auto-dismiss message after 15 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(''), 15000);
      return () => clearTimeout(timer);
    }
  }, [message]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  // Form states
  const [newOffice, setNewOffice] = useState({ name: '', serviceType: '', dailyCapacity: 100, operatingHours: '09:00-17:00', avgServiceMinutes: 10, latitude: '', longitude: '' });
  const [bookingForm, setBookingForm] = useState({ customerName: user?.name || '', customerContact: user?.email || '', serviceType: 'General Inquiry', note: '' });
  const [availabilityInput, setAvailabilityInput] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [tokenFilter, setTokenFilter] = useState('active'); // 'active' | 'history'

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
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  const handleBookingSubmit = async (formData) => {
    if (!selectedOfficeId) return setMessage('Choose an office');
    if (!formData.customerName) return setMessage('Name required');

    try {
      setIsBusy(true);
      await fetchJSON(`/api/offices/${selectedOfficeId}/book`, {
        method: 'POST',
        body: JSON.stringify({
          customerName: formData.customerName,
          customerContact: formData.customerContact, // Phone
          serviceType: formData.serviceType,
          userId: user?.id,
          userLat: formData.userLat,
          userLng: formData.userLng,
          note: formData.note // Optional
        }),
      });
      setMessage('Booking successful!');
      setIsBookingModalOpen(false); // Close modal on success
      setBookingForm({ customerName: user?.name || '', customerContact: user?.email || '', note: '' }); // Reset form
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

      const verbs = {
        'cancel': 'cancelled',
        'complete': 'completed',
        'no-show': 'marked as no-show'
      };

      setMessage(`Token ${verbs[action] || action}`);
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
                    {view === 'admin' ? (
                      <Stat label="Current Token" value={
                        (selectedOfficeData?.tokens || [])
                          .filter(t => t.status === 'called')
                          .sort((a, b) => (new Date(b.called_at || 0) - new Date(a.called_at || 0)))[0]?.token_number || '--'
                      } />
                    ) : (
                      <Stat label="Wait" value={
                        (selectedOffice.queueCount * selectedOffice.avg_service_minutes) > 0
                          ? `${selectedOffice.queueCount * selectedOffice.avg_service_minutes}m`
                          : 'Access Allowed'
                      } />
                    )}
                    <Stat label="Avail" value={selectedOffice.available_today} />
                  </div>
                </div>

                {view === 'customer' && (
                  <section className="panel-section">
                    <h4>Book Slot</h4>
                    <p style={{ fontSize: '14px', color: 'var(--gray-500)' }}>
                      {selectedOffice.available_today > 0 ? 'Slots available immediately.' : `Current wait: approx ${selectedOffice.queueCount * selectedOffice.avg_service_minutes} mins.`}
                    </p>
                    <button onClick={() => setIsBookingModalOpen(true)}>Book Now</button>
                  </section>
                )}

                <BookingModal
                  isOpen={isBookingModalOpen}
                  onClose={() => setIsBookingModalOpen(false)}
                  onSubmit={handleBookingSubmit}
                  office={selectedOffice}
                  user={user}
                />

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
                  {view === 'customer' && (
                    <div className="tabs" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                      <button
                        className={tokenFilter === 'active' ? 'primary small' : 'ghost small'}
                        style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid var(--gray-300)', background: tokenFilter === 'active' ? 'var(--primary)' : 'transparent', color: tokenFilter === 'active' ? '#fff' : 'inherit' }}
                        onClick={() => setTokenFilter('active')}
                      >
                        Active
                      </button>
                      <button
                        className={tokenFilter === 'history' ? 'primary small' : 'ghost small'}
                        style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid var(--gray-300)', background: tokenFilter === 'history' ? 'var(--primary)' : 'transparent', color: tokenFilter === 'history' ? '#fff' : 'inherit' }}
                        onClick={() => setTokenFilter('history')}
                      >
                        History
                      </button>
                    </div>
                  )}
                  <div className="token-list">
                    {(selectedOfficeData?.tokens || [])
                      .filter(t => {
                        if (view === 'admin') return true;
                        const isMine = t.user_id === user?.id;
                        if (!isMine) return false;
                        if (tokenFilter === 'active') return ['booked', 'queued', 'called'].includes(t.status);
                        return ['completed', 'cancelled', 'no-show'].includes(t.status);
                      })
                      .map(t => (
                        <TokenRow key={t.id} token={t} onCancel={id => updateToken(id, 'cancel')} onComplete={id => updateToken(id, 'complete')} onNoShow={id => updateToken(id, 'no-show')} isAdmin={view === 'admin'} currentUser={user} />
                      ))}
                    {view === 'customer' && (selectedOfficeData?.tokens || []).filter(t => {
                      const isMine = t.user_id === user?.id;
                      if (!isMine) return false;
                      if (tokenFilter === 'active') return ['booked', 'queued', 'called'].includes(t.status);
                      return ['completed', 'cancelled', 'no-show'].includes(t.status);
                    }).length === 0 && (
                        <div className="muted" style={{ textAlign: 'center', padding: '20px' }}>
                          {tokenFilter === 'active' ? 'You are not in the queue. Book a slot!' : 'No past tokens found.'}
                        </div>
                      )}
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
