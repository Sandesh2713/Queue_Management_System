import { useEffect, useMemo, useState } from 'react';
import './App.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

async function fetchJSON(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }
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
          {token.position ? ` · position ${token.position}` : ''}
        </div>
      </div>
      <div className="token-actions">
        <span className="token-chip">{token.status}</span>
        {isAdmin && (
          <>
            <button className="ghost" onClick={() => onComplete(token.id)}>
              Complete
            </button>
            <button className="ghost" onClick={() => onNoShow(token.id)}>
              No-show
            </button>
          </>
        )}
        <button className="ghost danger" onClick={() => onCancel(token.id)}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function App() {
  const [view, setView] = useState('customer');
  const [offices, setOffices] = useState([]);
  const [selectedOfficeId, setSelectedOfficeId] = useState('');
  const [selectedOfficeData, setSelectedOfficeData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [newOffice, setNewOffice] = useState({
    name: '',
    serviceType: '',
    dailyCapacity: 20,
    operatingHours: '09:00-17:00',
    avgServiceMinutes: 10,
    latitude: '',
    longitude: '',
  });
  const [bookingForm, setBookingForm] = useState({
    customerName: '',
    customerContact: '',
    note: '',
  });
  const [availabilityInput, setAvailabilityInput] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const selectedOffice = useMemo(() => {
    if (!selectedOfficeData) return null;
    return selectedOfficeData.office;
  }, [selectedOfficeData]);

  useEffect(() => {
    loadOffices();
  }, []);

  useEffect(() => {
    if (selectedOfficeId) {
      fetchOfficeDetail(selectedOfficeId);
    }
  }, [selectedOfficeId]);

  const loadOffices = async () => {
    try {
      setLoading(true);
      const data = await fetchJSON('/api/offices');
      setOffices(data.offices);
      if (!selectedOfficeId && data.offices.length) {
        setSelectedOfficeId(data.offices[0].id);
      }
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchOfficeDetail = async (id) => {
    try {
      setLoading(true);
      const data = await fetchJSON(`/api/offices/${id}`);
      setSelectedOfficeData(data);
      setAvailabilityInput(data.office.available_today);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOffice = async () => {
    if (!adminKey) return setMessage('Admin key required');
    if (!newOffice.name || !newOffice.serviceType) {
      return setMessage('Name and service type are required');
    }
    try {
      setIsBusy(true);
      await fetchJSON('/api/offices', {
        method: 'POST',
        headers: { 'x-admin-key': adminKey },
        body: JSON.stringify(newOffice),
      });
      setMessage('Office created');
      setNewOffice({
        name: '',
        serviceType: '',
        dailyCapacity: 20,
        operatingHours: '09:00-17:00',
        avgServiceMinutes: 10,
        latitude: '',
        longitude: '',
      });
      await loadOffices();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleBooking = async () => {
    if (!selectedOfficeId) return setMessage('Choose an office');
    if (!bookingForm.customerName) return setMessage('Customer name required');
    try {
      setIsBusy(true);
      const data = await fetchJSON(`/api/offices/${selectedOfficeId}/book`, {
        method: 'POST',
        body: JSON.stringify(bookingForm),
      });
      setMessage(data.message || 'Booked');
      setBookingForm({ customerName: '', customerContact: '', note: '' });
      await Promise.all([loadOffices(), fetchOfficeDetail(selectedOfficeId)]);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleAvailabilityUpdate = async () => {
    if (!adminKey) return setMessage('Admin key required');
    try {
      setIsBusy(true);
      await fetchJSON(`/api/offices/${selectedOfficeId}/availability`, {
        method: 'PATCH',
        headers: { 'x-admin-key': adminKey },
        body: JSON.stringify({ availableToday: Number(availabilityInput) }),
      });
      setMessage('Availability updated');
      await Promise.all([loadOffices(), fetchOfficeDetail(selectedOfficeId)]);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setIsBusy(false);
    }
  };

  const callNext = async () => {
    if (!adminKey) return setMessage('Admin key required');
    try {
      setIsBusy(true);
      const data = await fetchJSON(`/api/offices/${selectedOfficeId}/call-next`, {
        method: 'POST',
        headers: { 'x-admin-key': adminKey },
      });
      setMessage(`Called ${data.token.user_name}`);
      await Promise.all([loadOffices(), fetchOfficeDetail(selectedOfficeId)]);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setIsBusy(false);
    }
  };

  const updateToken = async (id, action) => {
    try {
      setIsBusy(true);
      let path = '';
      let headers = {};
      switch (action) {
        case 'cancel':
          path = `/api/tokens/${id}/cancel`;
          break;
        case 'complete':
          path = `/api/tokens/${id}/complete`;
          headers = { 'x-admin-key': adminKey };
          break;
        case 'no-show':
          path = `/api/tokens/${id}/no-show`;
          headers = { 'x-admin-key': adminKey };
          break;
        default:
          throw new Error('Unknown action');
      }
      await fetchJSON(path, { method: 'POST', headers });
      setMessage(`Token ${action}d`);
      await Promise.all([loadOffices(), fetchOfficeDetail(selectedOfficeId)]);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setIsBusy(false);
    }
  };

  const officeTokens = selectedOfficeData?.tokens || [];

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <div className="eyebrow">Queue Management System</div>
          <h1>Serve people faster, with less crowding</h1>
          <p className="lede">
            Customers can see availability, book instantly, or join a virtual queue. Offices manage
            live capacity and call the next visitor with a click.
          </p>
        </div>
        <div className="view-toggle">
          <button className={view === 'customer' ? 'active' : ''} onClick={() => setView('customer')}>
            Customer
          </button>
          <button className={view === 'admin' ? 'active' : ''} onClick={() => setView('admin')}>
            Admin
          </button>
        </div>
      </header>

      {message && <div className="message">{message}</div>}

      <div className="layout">
        <aside className="panel">
          <div className="panel-header">
            <h3>Offices</h3>
            <button className="ghost" onClick={loadOffices} disabled={loading}>
              Refresh
            </button>
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
                  <span>Active: {office.inProgressCount}</span>
                </div>
              </button>
            ))}
            {!offices.length && <div className="muted">No offices yet</div>}
          </div>

          {view === 'admin' && (
            <div className="panel-section">
              <h4>Create office</h4>
              <label className="field">
                <span>Name</span>
                <input
                  value={newOffice.name}
                  onChange={(e) => setNewOffice({ ...newOffice, name: e.target.value })}
                  placeholder="e.g., Central Hospital"
                />
              </label>
              <label className="field">
                <span>Service type</span>
                <input
                  value={newOffice.serviceType}
                  onChange={(e) => setNewOffice({ ...newOffice, serviceType: e.target.value })}
                  placeholder="Passport desk"
                />
              </label>
              <div className="field-grid">
                <label className="field">
                  <span>Daily capacity</span>
                  <input
                    type="number"
                    value={newOffice.dailyCapacity}
                    onChange={(e) => setNewOffice({ ...newOffice, dailyCapacity: Number(e.target.value) })}
                  />
                </label>
                <label className="field">
                  <span>Avg minutes / visitor</span>
                  <input
                    type="number"
                    value={newOffice.avgServiceMinutes}
                    onChange={(e) =>
                      setNewOffice({ ...newOffice, avgServiceMinutes: Number(e.target.value) })
                    }
                  />
                </label>
              </div>
              <label className="field">
                <span>Operating hours</span>
                <input
                  value={newOffice.operatingHours}
                  onChange={(e) => setNewOffice({ ...newOffice, operatingHours: e.target.value })}
                  placeholder="09:00-17:00"
                />
              </label>
              <div className="field-grid">
                <label className="field">
                  <span>Lat</span>
                  <input
                    value={newOffice.latitude}
                    onChange={(e) => setNewOffice({ ...newOffice, latitude: e.target.value })}
                    placeholder="optional"
                  />
                </label>
                <label className="field">
                  <span>Lng</span>
                  <input
                    value={newOffice.longitude}
                    onChange={(e) => setNewOffice({ ...newOffice, longitude: e.target.value })}
                    placeholder="optional"
                  />
                </label>
              </div>
              <label className="field">
                <span>Admin key</span>
                <input value={adminKey} onChange={(e) => setAdminKey(e.target.value)} placeholder="x-admin-key" />
              </label>
              <button onClick={handleCreateOffice} disabled={isBusy}>
                Create office
              </button>
            </div>
          )}
        </aside>

        <main className="panel">
          {!selectedOffice ? (
            <div className="muted">Select an office to view details.</div>
          ) : (
            <>
              <div className="panel-header">
                <div>
                  <div className="eyebrow">Office</div>
                  <h3>{selectedOffice.name}</h3>
                  <div className="muted">{selectedOffice.service_type}</div>
                </div>
                <div className="stat-group">
                  <Stat label="Available today" value={selectedOffice.available_today} />
                  <Stat label="Capacity" value={selectedOffice.daily_capacity} />
                  <Stat label="Avg minutes" value={selectedOffice.avg_service_minutes} />
                </div>
              </div>

              {view === 'customer' && (
                <section className="panel-section">
                  <h4>Book or join queue</h4>
                  <div className="field-grid">
                    <label className="field">
                      <span>Your name</span>
                      <input
                        value={bookingForm.customerName}
                        onChange={(e) => setBookingForm({ ...bookingForm, customerName: e.target.value })}
                        placeholder="Jane Doe"
                      />
                    </label>
                    <label className="field">
                      <span>Contact (SMS/email)</span>
                      <input
                        value={bookingForm.customerContact}
                        onChange={(e) => setBookingForm({ ...bookingForm, customerContact: e.target.value })}
                        placeholder="email or phone"
                      />
                    </label>
                  </div>
                  <label className="field">
                    <span>Note (optional)</span>
                    <input
                      value={bookingForm.note}
                      onChange={(e) => setBookingForm({ ...bookingForm, note: e.target.value })}
                      placeholder="Special needs, accessibility, etc."
                    />
                  </label>
                  <button onClick={handleBooking} disabled={isBusy}>
                    {selectedOffice.available_today > 0 ? 'Book now' : 'Join virtual queue'}
                  </button>
                </section>
              )}

              {view === 'admin' && (
                <section className="panel-section">
                  <h4>Live controls</h4>
                  <div className="field-grid">
                    <label className="field">
                      <span>Available today</span>
                      <input
                        type="number"
                        value={availabilityInput}
                        onChange={(e) => setAvailabilityInput(e.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>Admin key</span>
                      <input value={adminKey} onChange={(e) => setAdminKey(e.target.value)} placeholder="x-admin-key" />
                    </label>
                  </div>
                  <div className="button-row">
                    <button onClick={handleAvailabilityUpdate} disabled={isBusy}>
                      Update availability
                    </button>
                    <button onClick={callNext} disabled={isBusy}>
                      Call next
                    </button>
                  </div>
                </section>
              )}

              <section className="panel-section">
                <h4>Queue</h4>
                <div className="token-list">
                  {officeTokens.length === 0 && <div className="muted">No tokens yet.</div>}
                  {officeTokens.map((token) => (
                    <TokenRow
                      key={token.id}
                      token={token}
                      onCancel={(id) => updateToken(id, 'cancel')}
                      onComplete={(id) => updateToken(id, 'complete')}
                      onNoShow={(id) => updateToken(id, 'no-show')}
                      isAdmin={view === 'admin'}
                    />
                  ))}
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
