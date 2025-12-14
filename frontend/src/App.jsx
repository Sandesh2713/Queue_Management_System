import { useEffect, useMemo, useState, useRef } from 'react';
import './App.css';
import { useAuth } from './AuthContext';

function CreateOfficeWizard({ onSubmit, onBack }) {
  const [form, setForm] = useState({ name: '', serviceType: '', dailyCapacity: 100, operatingHours: '09:00-17:00', avgServiceMinutes: 10, latitude: '', longitude: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onSubmit(form);
    setLoading(false);
  };

  return (
    <div className="auth-container" style={{ maxWidth: '600px' }}>
      <h2>Setup your Office</h2>
      <p style={{ marginBottom: '20px', color: 'var(--gray-500)' }}>Tell us about your organization to get started.</p>
      <form onSubmit={handleSubmit}>
        <div className="field-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <label className="field">
            <span>Office Name</span>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label className="field">
            <span>Service Types (comma separated)</span>
            <input value={form.serviceType} onChange={e => setForm({ ...form, serviceType: e.target.value })} required placeholder="e.g. Sales, Repair, Returns" />
          </label>
        </div>
        <div className="field-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <label className="field">
            <span>Daily Capacity</span>
            <input type="number" value={form.dailyCapacity} onChange={e => setForm({ ...form, dailyCapacity: e.target.value })} required />
          </label>
          <label className="field">
            <span>Avg Service Time (mins)</span>
            <input type="number" value={form.avgServiceMinutes} onChange={e => setForm({ ...form, avgServiceMinutes: e.target.value })} required />
          </label>
        </div>
        <label className="field">
          <span>Operating Hours</span>
          <input value={form.operatingHours} onChange={e => setForm({ ...form, operatingHours: e.target.value })} placeholder="09:00-17:00" />
        </label>
        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
          {/* <button type="button" className="ghost" onClick={onBack}>Back</button>  -- usually no back from here if flow is forced */}
          <button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create Office'}</button>
        </div>
      </form>
    </div>
  );
}

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


function LoginView({ onSuccess, onSwitch, onBack, role }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // If role is passed, enforce it.
  const roleProp = role; // 'admin' or 'customer' or undefined
  const [isAdmin, setIsAdmin] = useState(role === 'admin');
  const [adminKey, setAdminKey] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(email, password, isAdmin ? adminKey : undefined);
      onSuccess();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-container login-redesign">
      {/* Kept back button but it might need to vary based on design preference. Keeping for UX. */}
      {/* <button type="button" className="back-btn" onClick={(e) => { e.preventDefault(); onBack(); }}>← Back</button> */}

      <h2 style={{ fontSize: '28px', marginBottom: '-12px', lineHeight: '1' }}>Welcome Back</h2>
      <div style={{ textAlign: 'center', color: 'var(--gray-500)', marginBottom: '32px' }}>Let's get started</div>

      {error && <div className="message">{error}</div>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="field">
          {/* Design often hides labels or puts them inside. Keeping labels for accessibility but could hide them if placeholders are preferred. */}
          {/* Adding placeholders to match typical clean login forms */}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="Email"
            className="rounded-input"
          />
        </div>
        <div className="field">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Password"
            className="rounded-input"
          />
        </div>

        {/* Forgot Password Link */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <span
            style={{ color: '#22c55e', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
            onClick={() => onSwitch('forgot-password')}
          >
            Forgot Password?
          </span>
        </div>

        {/* Admin Toggle - Hidden if role is explicitly customer */}
        {!roleProp && (
          <div style={{ margin: '4px 0', fontSize: '13px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--gray-500)' }}>
              <input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} />
              Login as Admin
            </label>
          </div>
        )}

        {isAdmin && (
          <div className="field">
            <input
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              required
              placeholder="Admin Key"
              className="rounded-input"
            />
          </div>
        )}

        <button type="submit" className="login-btn">Login</button>
      </form>

      <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px', color: 'var(--gray-500)' }}>
        Don't have an account? <span onClick={onSwitch} style={{ color: '#22c55e', fontWeight: '700', cursor: 'pointer' }}>Sign up.</span>
      </div>
    </div>
  );
}

function RegisterView({ onSuccess, onSwitch, defaultRole = 'customer', onBack }) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState(defaultRole);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(name, email, password, phone, role);
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container login-redesign">
      {/* <button type="button" className="back-btn" onClick={(e) => { e.preventDefault(); onBack(); }}>← Back</button> */}

      <h2 style={{ fontSize: '28px', marginBottom: '-12px', lineHeight: '1' }}>Create Account</h2>
      <div style={{ textAlign: 'center', color: 'var(--gray-500)', marginBottom: '32px' }}>Join us today</div>

      {error && <div className="message">{error}</div>}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="field">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Full Name"
            className="rounded-input"
          />
        </div>
        <div className="field">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="Email Address"
            className="rounded-input"
          />
        </div>
        <div className="field">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Password"
            className="rounded-input"
          />
        </div>
        <div className="field">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone (Optional)"
            className="rounded-input"
          />
        </div>

        <div className="field">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-input"
            style={{ width: '100%', appearance: 'none', background: '#f8fafc url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23007CB2%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E") no-repeat right 16px center', backgroundSize: '12px' }}
          >
            <option value="customer">I am a Customer</option>
            <option value="admin">I am an Office Manager</option>
          </select>
        </div>

        <button type="submit" className="login-btn" disabled={loading}>
          {loading ? 'Creating Account...' : 'Sign Up'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px', color: 'var(--gray-500)' }}>
        Have an account? <span onClick={onSwitch} style={{ color: '#22c55e', fontWeight: '700', cursor: 'pointer' }}>Login</span>
      </div>
    </div>
  );
}

function VerifyEmailView({ email, onSuccess, onBack }) {
  const { verifyOtp, sendOtp } = useAuth();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const mounted = useRef(false);

  // Auto-send OTP on mount
  useEffect(() => {
    if (!mounted.current && email) {
      mounted.current = true;
      // Trigger OTP send on fresh load of this view
      sendOtp(email).catch(err => setError('Failed to send OTP: ' + err.message));
    }
  }, [email, sendOtp]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await verifyOtp(email, otp);
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setMsg('');
    setError('');
    try {
      await sendOtp(email);
      setMsg('OTP resent successfully!');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-container">
      <button type="button" className="back-btn" onClick={(e) => { e.preventDefault(); onBack(); }}>← Back</button>
      <h2>Verify Email</h2>
      <p style={{ marginBottom: '20px', color: 'var(--gray-500)' }}>
        We sent a code to <strong>{email}</strong>.
      </p>
      {error && <div className="message" style={{ background: '#ffebee', color: '#c62828' }}>{error}</div>}
      {msg && <div className="message" style={{ background: '#e8f5e9', color: '#2e7d32' }}>{msg}</div>}

      <form onSubmit={handleSubmit}>
        <label className="field">
          <span>Enter 6-digit Code</span>
          <input
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="123456"
            maxLength={6}
            style={{ letterSpacing: '4px', fontSize: '24px', textAlign: 'center' }}
            required
          />
        </label>
        <button type="submit" disabled={loading}>{loading ? 'Verifying...' : 'Verify'}</button>
      </form>

      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <button className="ghost small" onClick={handleResend}>Resend Code</button>
      </div>
    </div>
  );
}

// Forgot Password Component
function ForgotPasswordView({ onBack, onVerify }) {
  const { sendOtp } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      await sendOtp(email, 'reset');
      onVerify(email); // Switch to verification view
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container login-redesign">
      <button type="button" className="back-btn" onClick={(e) => { e.preventDefault(); onBack(); }}>← Back</button>
      <h2 style={{ fontSize: '28px', marginBottom: '8px' }}>Reset Password</h2>
      <div style={{ textAlign: 'center', color: 'var(--gray-500)', marginBottom: '32px' }}>Enter email to receive code</div>

      {error && <div className="message" style={{ background: '#ffebee', color: '#c62828' }}>{error}</div>}
      {message && <div className="message" style={{ background: '#e8f5e9', color: '#2e7d32' }}>{message}</div>}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="field">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="Email Address"
            className="rounded-input"
          />
        </div>
        <button type="submit" className="login-btn" disabled={loading}>
          {loading ? 'Sending...' : 'Send Code'}
        </button>
      </form>
    </div>
  );
}

// Reset Password Component
function ResetPasswordView({ email, onBack, onSuccess }) {
  const { resetPassword } = useAuth();
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await resetPassword(email, otp, newPassword);
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container login-redesign">
      <button type="button" className="back-btn" onClick={(e) => { e.preventDefault(); onBack(); }}>← Back</button>
      <h2 style={{ fontSize: '28px', marginBottom: '8px' }}>New Password</h2>
      <div style={{ textAlign: 'center', color: 'var(--gray-500)', marginBottom: '32px' }}>Enter code and new password</div>

      {error && <div className="message" style={{ background: '#ffebee', color: '#c62828' }}>{error}</div>}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="field">
          <input
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="6-digit Code"
            maxLength={6}
            className="rounded-input"
            required
            style={{ textAlign: 'center', letterSpacing: '2px' }}
          />
        </div>
        <div className="field">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            placeholder="New Password"
            className="rounded-input"
          />
        </div>
        <button type="submit" className="login-btn" disabled={loading}>
          {loading ? 'Updating...' : 'Set Password'}
        </button>
      </form>
    </div>
  );
}
// Landing View Component
function LandingView({ onLogin, onRegisterAdmin, onRegisterCustomer }) {
  return (
    <div className="landing-container">
      <header className="landing-header">
        <nav className="nav-links">
          <a href="#">About Us</a>
          <a href="#">Contact</a>
          <a href="#">FAQs</a>
        </nav>
        <div className="brand-center">
          <span style={{ fontWeight: 800 }}>Get Ezi</span> 🌱
        </div>
        <div className="landing-auth">
          <button className="login-outline-btn" onClick={() => onLogin()}>Log in</button>
        </div>
      </header>

      <div className="landing-content">
        <div className="landing-card">

          <h2>For <i>Companies</i></h2>
          <p>Your people, your business, your growth - beautifully managed.</p>
          <button onClick={() => onLogin('admin')}>Login</button>
          <div className="signup-prompt">
            Don't have an account? <br />
            <span onClick={onRegisterAdmin} className="link">Sign up.</span>
          </div>
        </div>

        <div className="landing-card">
          <h3>For <i>Customers</i></h3>
          <p>Join us and experience smoother services, every step of the way.</p>
          <button onClick={() => onLogin('customer')}>Login</button>
          <div className="signup-prompt">
            Don't have an account? <br />
            <span onClick={onRegisterCustomer} className="link">Sign up.</span>
          </div>
        </div>
      </div>
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
              {office?.service_type
                ? office.service_type.split(',').map(s => s.trim()).filter(Boolean).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))
                : <option value="General Inquiry">General Inquiry</option>
              }
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
const ProfileMenu = ({ user, onNavigate, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="profile-menu" ref={menuRef} style={{ position: 'relative' }}>
      <button className="ghost" onClick={() => setIsOpen(!isOpen)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px', border: 'none', background: 'transparent' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--gray-100)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </div>
      </button>
      {isOpen && (
        <div className="dropdown" style={{ position: 'absolute', top: '120%', right: 0, background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', borderRadius: '12px', padding: '8px', zIndex: 100, minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '4px', border: '1px solid var(--gray-200)' }}>
          <button className="ghost" onClick={() => { setIsOpen(false); onNavigate('profile'); }} style={{ justifyContent: 'flex-start', textAlign: 'left' }}>Use Profile</button>
          <button className="ghost" onClick={() => { setIsOpen(false); onNavigate('settings'); }} style={{ justifyContent: 'flex-start', textAlign: 'left' }}>Settings</button>
          <div style={{ height: '1px', background: 'var(--gray-200)', margin: '4px 0' }} />
          <button className="ghost" onClick={onLogout} style={{ justifyContent: 'flex-start', textAlign: 'left', color: 'var(--state-error)' }}>Logout</button>
        </div>
      )}
    </div>
  );
};

const ProfileView = ({ user, onBack }) => {
  return (
    <div className="panel" style={{ maxWidth: '600px', margin: '40px auto' }}>
      <div className="panel-header">
        <h3>Profile Details</h3>
        <button className="ghost" onClick={onBack}>Back</button>
      </div>
      <div className="field-grid" style={{ gridTemplateColumns: '1fr', gap: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', paddingBottom: '20px', borderBottom: '1px solid var(--gray-200)' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 'bold' }}>
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '4px' }}>{user.name}</div>
            <div className="token-chip" style={{ display: 'inline-block' }}>{user.role}</div>
          </div>
        </div>
        <div style={{ display: 'grid', gap: '16px' }}>
          <div className="info-row">
            <label style={{ fontSize: '13px', color: 'var(--gray-500)', display: 'block', marginBottom: '4px' }}>Email Address</label>
            <div style={{ fontSize: '16px' }}>{user.email}</div>
          </div>
          <div className="info-row">
            <label style={{ fontSize: '13px', color: 'var(--gray-500)', display: 'block', marginBottom: '4px' }}>Phone Number</label>
            <div style={{ fontSize: '16px' }}>{user.phone || 'Not provided'}</div>
          </div>
          <div className="info-row">
            <label style={{ fontSize: '13px', color: 'var(--gray-500)', display: 'block', marginBottom: '4px' }}>Member Since</label>
            <div style={{ fontSize: '16px' }}>{new Date(user.created_at).toLocaleDateString()}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SettingsView = ({ onBack }) => {
  return (
    <div className="panel" style={{ maxWidth: '600px', margin: '40px auto' }}>
      <div className="panel-header">
        <h3>Settings</h3>
        <button className="ghost" onClick={onBack}>Back</button>
      </div>
      <div className="panel-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: '500', fontSize: '16px' }}>Dark Mode</div>
            <div className="muted" style={{ fontSize: '14px' }}>Adjust interface theme</div>
          </div>
          {/* Placeholder Toggle */}
          <div style={{ width: '40px', height: '24px', background: 'var(--gray-300)', borderRadius: '12px', position: 'relative', cursor: 'pointer' }}>
            <div style={{ width: '20px', height: '20px', background: '#fff', borderRadius: '50%', position: 'absolute', top: '2px', left: '2px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
};

function App() {
  const { user, logout, loading: authLoading } = useAuth();

  // Initialize view from history state or default
  const [view, setViewState] = useState(user ? (user.role === 'admin' ? 'admin' : 'customer') : 'landing');

  // Wrapper to sync history
  const setView = (newView, addToHistory = true) => {
    setViewState(newView);
    if (addToHistory) {
      window.history.pushState({ view: newView }, '', window.location.pathname);
    }
  };

  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = (event) => {
      if (event.state && event.state.view) {
        setViewState(event.state.view);
      } else {
        // Default fallback if no state (e.g. initial load)
        setViewState(user ? (user.role === 'admin' ? 'admin' : 'customer') : 'landing');
      }
    };
    window.addEventListener('popstate', handlePopState);

    // Set initial state
    window.history.replaceState({ view: view }, '', window.location.pathname);

    return () => window.removeEventListener('popstate', handlePopState);
  }, [user]); // Re-bind if user changes substantially, though mainly stable

  const [registerRole, setRegisterRole] = useState('customer');
  const [loginRole, setLoginRole] = useState(''); // 'admin' | 'customer' | ''
  const [tempEmail, setTempEmail] = useState(''); // For password reset flow
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
      if (view === 'login' || view === 'register' || view === 'landing') {
        if (user.is_verified === 0) {
          setView('verify-email', false);
        } else {
          setView(user.role === 'admin' ? 'admin' : 'customer', false);
        }
      } else if (view !== 'verify-email' && user.is_verified === 0) {
        setView('verify-email', false);
      }
    } else {
      // If logged out, force landing view (unless already on login/register)
      if (view !== 'login' && view !== 'register') setView('landing');
    }
    // Reload offices whenever user state changes to ensure correct role-based fetching (Isolation Fix)
    loadOffices();
  }, [user]);

  // useEffect(() => { loadOffices(); }, []); // Removed: Handled by user effect to ensure auth context

  useEffect(() => {
    if (selectedOfficeId) fetchOfficeDetail(selectedOfficeId);
  }, [selectedOfficeId]);

  const [historyTokens, setHistoryTokens] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await fetchJSON('/api/history');
      setHistoryTokens(data.history);
      setShowHistory(true);
    } catch (err) { setMessage(err.message); } finally { setLoading(false); }
  };

  const loadOffices = async () => {
    try {
      setLoading(true);
      const endpoint = (user?.role === 'admin') ? '/api/offices?owner=me' : '/api/offices';
      const data = await fetchJSON(endpoint);
      setOffices(data.offices);
      // Auto-select first office for Admin to show dashboard immediately
      if (user?.role === 'admin' && data.offices.length > 0) {
        setSelectedOfficeId(data.offices[0].id);
      } else if (!selectedOfficeId && data.offices.length > 0 && user?.role !== 'admin') {
        // for customers, maybe don't auto select or keep existing logic
        setSelectedOfficeId(data.offices[0].id);
      }

      // If admin has no offices and is in admin view, maybe we should prompt wizard?
      // Controlled via manual flow for now.
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

  const handleCreateOffice = async (officeData) => {
    try {
      setIsBusy(true);
      await fetchJSON('/api/offices', {
        method: 'POST',
        body: JSON.stringify(officeData),
      });
      setMessage('Office created');
      await loadOffices();
      setView('admin'); // Go to dashboard
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

  if (view === 'landing' && !user) {
    return (
      <>
        {message && <div className="message">{message}</div>}
        <LandingView
          onLogin={(role) => {
            setLoginRole(role);
            setView('login');
          }}
          onRegisterAdmin={() => { setRegisterRole('admin'); setView('register'); }}
          onRegisterCustomer={() => { setRegisterRole('customer'); setView('register'); }}
        />
      </>
    );
  }

  const showHeader = !['login', 'register', 'verify-email', 'forgot-password', 'reset-password'].includes(view);

  return (
    <div className="app">
      {showHeader && (
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
                <div className="bell-icon" onClick={() => setShowNotifications(!showNotifications)}>
                  🔔
                  {notificationCount > 0 && <span className="bell-count">{notificationCount}</span>}
                </div>
                <ProfileMenu user={user} onNavigate={setView} onLogout={logout} />
              </>
            )}
          </div>
        </header>
      )}

      {showNotifications && user && (
        <NotificationPanel userId={user.id} onClose={() => setShowNotifications(false)} />
      )}

      {message && <div className="message">{message}</div>}

      {view === 'landing' && !user ? (
        <LandingView
          onLogin={(role) => {
            setLoginRole(role);
            setView('login');
          }}
          onRegisterAdmin={() => { setRegisterRole('admin'); setView('register'); }}
          onRegisterCustomer={() => { setRegisterRole('customer'); setView('register'); }}
        />
      ) : view === 'login' || (!user && view !== 'register' && view !== 'forgot-password' && view !== 'reset-password') ? (
        <LoginView
          role={loginRole}
          onSuccess={() => { }}
          onSwitch={(target) => {
            if (target === 'forgot-password') setView('forgot-password');
            else setView('register');
          }}
          onBack={() => setView('landing')}
        />
      ) : view === 'forgot-password' ? (
        <ForgotPasswordView
          onBack={() => setView('login')}
          onVerify={(email) => {
            setTempEmail(email);
            setView('reset-password');
          }}
        />
      ) : view === 'reset-password' ? (
        <ResetPasswordView
          email={tempEmail}
          onBack={() => setView('forgot-password')}
          onSuccess={() => {
            setMessage('Password updated! Please login.');
            setView('login');
          }}
        />
      ) : view === 'create-office' ? (
        <CreateOfficeWizard onSubmit={handleCreateOffice} onBack={() => setView('admin')} />
      ) : view === 'register' ? (
        <RegisterView
          onSuccess={() => {
            setView('verify-email');
          }}
          onSwitch={() => setView('login')}
          defaultRole={registerRole}
          onBack={() => setView('landing')}
        />
      ) : view === 'verify-email' && user ? (
        <VerifyEmailView
          email={user.email}
          onSuccess={() => {
            // Refresh or manually set
            setMessage('Verified! Welcome.');
            setView(user.role === 'admin' ? 'admin' : 'customer');
          }}
          onBack={() => {
            logout();
            setView('landing');
          }}
        />
      ) : view === 'profile' ? (
        <ProfileView user={user} onBack={() => setView(user.role === 'admin' ? 'admin' : 'customer')} />
      ) : view === 'settings' ? (
        <SettingsView onBack={() => setView(user.role === 'admin' ? 'admin' : 'customer')} />
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
              {/* Only show office list for Customers, or if Admin has multiple (optional, but requested to hide 'left section' details) */}
              {user?.role !== 'admin' && offices.map((office) => (
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
              {user?.role === 'admin' && offices.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--gray-500)' }}>
                  You haven't created an office yet.
                  <button className="small primary" onClick={() => setView('create-office')} style={{ marginTop: '10px' }}>Create Office</button>
                </div>
              )}
              {user?.role === 'admin' && offices.map((office) => (
                // Admin sees only their own offices, simplified view or just auto-selected. 
                // Request says "don't show it", implies singular focus.
                // We will show a simple list if they have multiple, but likely just one.
                <div key={office.id} className={`office-card selected`} style={{ cursor: 'default' }}>
                  <div className="office-name">{office.name} (Your Office)</div>
                  <div className="office-meta">
                    <span>Queue: {office.queueCount}</span>
                  </div>
                </div>
              ))}
            </div>

            {view === 'admin' && (
              <>
                {/* REMOVED Create Office Form from Sidebar */}
                {/* Only History remains */}
                <div className="panel-section">
                  <h4>History</h4>
                  <button onClick={loadHistory} className="ghost">View Token History</button>
                </div>
              </>
            )}
          </aside>

          <main className="panel">
            {showHistory && view === 'admin' ? (
              <div className="history-view">
                <div className="panel-header">
                  <h3>Token History</h3>
                  <button className="ghost" onClick={() => setShowHistory(false)}>Close</button>
                </div>
                <div className="token-list">
                  {historyTokens.length === 0 && <div className="muted" style={{ padding: 20 }}>No archived tokens found.</div>}
                  {historyTokens.map(t => (
                    <div key={t.id} className="token-row" style={{ opacity: 0.8 }}>
                      <div>
                        <div className="token-label">#{t.token_number} - {t.user_name}</div>
                        <div className="token-meta">
                          {new Date(t.created_at).toLocaleDateString()} · {t.service_type} · {t.status}
                        </div>
                      </div>
                      <div className="token-actions">
                        <span className="token-chip">{new Date(t.archived_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : !selectedOffice ? <div className="muted">Select office</div> : (
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

