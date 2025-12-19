import { useEffect, useMemo, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import './App.css';
import { useAuth } from './AuthContext';

function CreateOfficeWizard({ onSubmit, onBack }) {
  const [form, setForm] = useState({ name: '', serviceType: '', dailyCapacity: 100, operatingHours: '09:00-17:00', avgServiceMinutes: 10, counterCount: 1 });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onSubmit(form);
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <div className="card" style={{ width: '100%', maxWidth: '600px' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Setup your Office</h2>
        <p style={{ marginBottom: '24px', color: 'var(--text-muted)' }}>Tell us about your organization to get started.</p>
        <form onSubmit={handleSubmit}>
          <div className="grid-2">
            <label className="input-group">
              <span className="input-label">Office Name</span>
              <input className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="e.g. City Central Clinic" />
            </label>
            <label className="input-group">
              <span className="input-label">Services Offered</span>
              <input className="input-field" value={form.serviceType} onChange={e => setForm({ ...form, serviceType: e.target.value })} required placeholder="e.g. Consultation, X-Ray" />
            </label>
          </div>
          <div className="grid-2">
            <label className="input-group">
              <span className="input-label">Avg Service Time (mins)</span>
              <input className="input-field" type="number" value={form.avgServiceMinutes} onChange={e => setForm({ ...form, avgServiceMinutes: e.target.value })} required />
            </label>
            <label className="input-group">
              <span className="input-label">Operating Hours</span>
              <input className="input-field" value={form.operatingHours} onChange={e => setForm({ ...form, operatingHours: e.target.value })} placeholder="09:00-17:00" required />
            </label>
          </div>

          <label className="input-group">
            <span className="input-label">Daily Capacity (Est.)</span>
            <input className="input-field" type="number" value={form.dailyCapacity} onChange={e => setForm({ ...form, dailyCapacity: e.target.value })} required />
          </label>

          <label className="input-group">
            <span className="input-label">Number of Counters (N)</span>
            <input className="input-field" type="number" value={form.counterCount} onChange={e => setForm({ ...form, counterCount: e.target.value })} required min="1" max="10" />
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>M = N * 3 (Max Allocations)</div>
          </label>

          <div style={{ marginTop: '32px' }}>
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Creating...' : 'Create Office'}
            </button>
          </div>
        </form>
      </div>
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
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
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

// --- 1. Customer Token Row (Instructions & Guidance) ---
function CustomerTokenRow({ token, onCancel, onArrive, isOwner, office }) {
  const isArrived = token.presence_status === 'ARRIVED';
  const isTerminal = ['cancelled', 'completed', 'no-show'].includes(token.status);
  const N = office?.counter_count || 1;
  const serviceMinutes = office?.avg_service_minutes || 10;

  let statusMsg = token.status;
  let subMsg = '';

  const fmtTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // STRICT Customer Logic
  if (office?.is_paused && ['WAIT', 'ALLOCATED'].includes(token.status)) {
    statusMsg = 'Paused';
    subMsg = office.pause_message || `Service paused: ${office.pause_reason}`;
  } else if (token.status === 'CALLED') {
    statusMsg = 'At Counter';
    subMsg = 'Proceed to the counter.';
  } else if (token.status === 'ALLOCATED') {
    if (isArrived) {
      statusMsg = 'You are checked in';
      subMsg = 'Please wait, your turn will be called shortly.';
    } else {
      statusMsg = 'Arrival Confirmation Needed';
      subMsg = 'You are allowed to enter the office. Please confirm arrival.';
    }
  } else if (token.status === 'WAIT') {
    if (token.time_state === 'PAST' || !token.service_start_time) {
      statusMsg = 'Be Ready';
      subMsg = (
        <div style={{ color: 'var(--primary)', fontWeight: 600 }}>Please be ready, your turn is approaching.</div>
      );
    } else {
      statusMsg = 'Wait at Location';
      const callTimeMs = new Date(token.service_start_time).getTime();
      const minsToCall = Math.ceil((callTimeMs - Date.now()) / 60000);
      const callRel = minsToCall > 0 ? `In ${minsToCall} mins` : 'Very soon';

      const allocOffset = 3 * serviceMinutes * 60000;
      const travelOffset = (token.travel_time_minutes || 15) * 60000;
      let allocTimeMs = callTimeMs - allocOffset;
      if (allocTimeMs < Date.now()) allocTimeMs = Date.now();
      const travelStartMs = allocTimeMs - travelOffset;
      const travelStr = fmtTime(new Date(travelStartMs));

      subMsg = (
        <div style={{ lineHeight: '1.4' }}>
          <div>Called in: <strong>{callRel}</strong></div>
          <div style={{ color: '#d93025' }}>Start traveling by <strong>{travelStr}</strong></div>
        </div>
      );
    }
  } else if (token.status === 'COMPLETED') {
    statusMsg = 'Completed';
    subMsg = 'Thank you for visiting';
  } else {
    subMsg = '-';
  }

  return (
    <div className={`token-row ${token.status}`} style={{
      background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)',
      borderRadius: 'var(--radius-lg)', padding: '20px', marginBottom: '16px',
      boxShadow: 'var(--shadow-sm)', border: '1px solid var(--gray-100)',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary-600)' }}>Token #{token.token_number}</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{token.user_name}</div>
          <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge-neutral">{statusMsg}</span>
          </div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '6px' }}>{subMsg}</div>
        </div>
      </div>
      <div className="token-actions" style={{ display: 'flex', gap: '12px' }}>
        {token.status === 'ALLOCATED' && !isArrived && isOwner && (
          <button className="btn btn-primary" onClick={() => onArrive(token.id)}>
            I've Arrived
          </button>
        )}
        {!isTerminal && isOwner && (
          <button className="btn btn-danger" style={{ background: 'transparent', color: '#ef4444', border: '1px solid #fee2e2' }} onClick={() => onCancel(token.id)}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

// --- 2. Admin Token Row (Raw System Data) ---
function AdminTokenRow({ token, onComplete, onNoShow, onCancel, onReQueue, onSelect }) {
  const isArrived = token.presence_status === 'ARRIVED';
  const isTerminal = ['cancelled', 'completed', 'no-show'].includes(token.status);
  const isHolding = token.status === 'holding';

  // Status Badge Logic
  const getStatusColor = (s) => {
    switch (s) {
      case 'CALLED': return '#dcfce7'; // green-100
      case 'ALLOCATED': return '#fef9c3'; // yellow-100
      case 'WAIT': return '#e0f2fe'; // sky-100
      default: return '#f3f4f6'; // gray-100
    }
  };

  return (
    <div onClick={() => onSelect(token)} style={{
      background: 'white', borderRadius: 'var(--radius-md)', padding: '16px', marginBottom: '12px',
      boxShadow: 'var(--shadow-sm)', border: '1px solid var(--gray-200)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      cursor: 'pointer', transition: 'all 0.2s', position: 'relative', overflow: 'hidden'
    }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
    >
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary-600)' }}>#{token.token_number}</span>
          <span style={{ fontSize: '1rem', fontWeight: 600 }}>{token.user_name}</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <span className="badge" style={{ backgroundColor: getStatusColor(token.status), color: '#374151' }}>
            {token.status}
          </span>
          <span className="badge" style={{ backgroundColor: isArrived ? '#dcfce7' : '#fee2e2', color: isArrived ? '#166534' : '#991b1b' }}>
            {isArrived ? 'Arrived' : 'Not Arrived'}
          </span>
        </div>
      </div>

      <div className="token-actions" onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '8px' }}>
        {!isTerminal && !isHolding && (
          <>
            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => onComplete(token.id)}>Done</button>
            <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => onNoShow(token.id)}>No-show</button>
            <button className="btn btn-ghost" style={{ color: 'var(--danger)', padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => onCancel(token.id)}>✕</button>
          </>
        )}
        {isHolding && <button className="btn btn-secondary" onClick={() => onReQueue(token.id)}>ReQ</button>}
      </div>
    </div>
  );
}

// --- 3. Token Details Modal (Admin Only) ---
function TokenDetailsModal({ token, onClose, onAction }) {
  if (!token) return null;
  const isArrived = token.presence_status === 'ARRIVED';

  const InfoRow = ({ label, val }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px solid #f3f4f6', paddingBottom: '4px' }}>
      <span style={{ color: '#6b7280', fontSize: '13px' }}>{label}</span>
      <span style={{ fontWeight: 500, fontSize: '13px' }}>{val || '-'}</span>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3>Token #{token.token_number}</h3>
          <button className="ghost" onClick={onClose}>✕</button>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: '#9ca3af', marginBottom: '8px' }}>Customer</h4>
          <InfoRow label="Name" val={token.user_name} />
          <InfoRow label="Email" val={token.user_email} />
          <InfoRow label="Phone" val={token.user_phone} />
          <InfoRow label="Gender" val={token.user_gender} />
          <InfoRow label="DOB" val={token.user_dob ? new Date(token.user_dob).toLocaleDateString() : ''} />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: '#9ca3af', marginBottom: '8px' }}>System Data</h4>
          <InfoRow label="Status" val={token.status} />
          <InfoRow label="Presence" val={token.presence_status} />
          <InfoRow label="Created At" val={token.created_at ? new Date(token.created_at).toLocaleString() : ''} />
          <InfoRow label="Allocation Time" val={token.eligibility_time ? new Date(token.eligibility_time).toLocaleString() : ''} />
          <InfoRow label="Service Start" val={token.service_start_time ? new Date(token.service_start_time).toLocaleString() : ''} />
          <InfoRow label="Arrival Confirmed" val={token.arrival_confirmed_at ? new Date(token.arrival_confirmed_at).toLocaleString() : 'Pending'} />
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '24px' }}>
          <button className="primary-btn" onClick={() => { onAction(token.id, 'complete'); onClose(); }}>Complete</button>
          <button className="secondary-btn" onClick={() => { onAction(token.id, 'no-show'); onClose(); }}>No-Show</button>
          <button className="ghost danger" onClick={() => { onAction(token.id, 'cancel'); onClose(); }}>Cancel</button>
        </div>
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
            style={{ color: '#0ea5e9', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
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
        Don't have an account? <span onClick={onSwitch} style={{ color: '#0ea5e9', fontWeight: '700', cursor: 'pointer' }}>Sign up.</span>
      </div>
    </div>
  );
}

function RegisterView({ onSuccess, onSwitch, defaultRole = 'customer', onBack }) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [role, setRole] = useState(defaultRole);
  const [adminKey, setAdminKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [exampleKey, setExampleKey] = useState('office-2024');

  useEffect(() => {
    setRole(defaultRole);
  }, [defaultRole]);

  useEffect(() => {
    if (role === 'admin') {
      const examples = ['my-secret-key', 'admin-pass-123', 'office-blr-01', 'key-xyz-99', 'secure-entry'];
      let i = 0;
      // Sync with CSS animation (2.5s total duration)
      const interval = setInterval(() => {
        i = (i + 1) % examples.length;
        setExampleKey(examples[i]);
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [role]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(name, email, password, phone, role, role === 'admin' ? adminKey : undefined, dob, gender);
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
          />
        </div>
        <div className="field">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="Email Address"
          />
        </div>
        <div className="field">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Password"
          />
        </div>
        <div className="field">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={role === 'admin' ? "Phone (Required)" : "Phone (Optional)"}
            required={role === 'admin'}
          />
        </div>



        <div className="field-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <label className="field">
            <span>Date of Birth</span>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Gender</span>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              required
              className="rounded-input"
              style={{ height: '48px' }} // Match input height roughly
            >
              <option value="" disabled>Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </label>
        </div>

        {role === 'admin' && (
          <div className="field">
            <input
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              required
              placeholder="Create Admin Key"
            />
            <div style={{ fontSize: '11px', color: 'var(--gray-500)', marginTop: '4px', paddingLeft: '4px' }}>
              You will need this key to login and perform admin actions. <br />
              <span style={{ color: 'var(--gray-400)', fontStyle: 'italic' }}>Example: <span className="fade-text">{exampleKey}</span></span>
            </div>
          </div>
        )}

        <button type="submit" className="login-btn" disabled={loading}>
          {loading ? 'Creating Account...' : 'Sign Up'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px', color: 'var(--gray-500)' }}>
        Have an account? <span onClick={onSwitch} style={{ color: '#0ea5e9', fontWeight: '700', cursor: 'pointer' }}>Login</span>
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
function AboutDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [openIndex, setOpenIndex] = useState(null);

  const sections = [
    {
      title: "What We Do?",
      desc: "We provide a smart, web-based Queue Management System to reduce crowding and long waiting times in offices and service centers."
    },
    {
      title: "Why We Do?",
      desc: "Our platform helps organizations manage visitors efficiently with real-time seat and slot updates."
    },
    {
      title: "Our Aim.",
      desc: "We aim to make public service visits smoother, faster, and more organized for everyone."
    }
  ];

  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => { setIsOpen(false); setOpenIndex(null); }}
    >
      <a href="#about" style={{ cursor: 'pointer', display: 'block', padding: '10px 0' }}>About Us</a>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '0',
          width: '350px',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          padding: '20px',
          zIndex: 1000,
          border: '1px solid rgba(0,0,0,0.05)',
          animation: 'fade-in 0.2s ease-out'
        }}>
          {sections.map((item, idx) => (
            <div key={idx} style={{
              marginBottom: idx === sections.length - 1 ? 0 : '12px',
              paddingBottom: idx === sections.length - 1 ? 0 : '12px',
              borderBottom: idx === sections.length - 1 ? 'none' : '1px solid rgba(0,0,0,0.06)'
            }}>
              <div
                onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
                style={{
                  fontWeight: '700',
                  fontSize: '14px',
                  color: '#1a1a1a',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '4px 0'
                }}
              >
                {item.title}
                <span style={{ transition: 'transform 0.2s', transform: openIndex === idx ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                </span>
              </div>

              {openIndex === idx && (
                <div style={{
                  fontSize: '13px',
                  color: 'var(--gray-500)',
                  marginTop: '4px',
                  lineHeight: '1.4',
                  paddingLeft: '4px',
                  borderLeft: '2px solid #e1e4e8',
                  animation: 'fade-in 0.2s ease-out',
                  opacity: 0.8
                }}>
                  {item.desc}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ContactDropdown() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <a href="#contact" style={{ cursor: 'pointer', display: 'block', padding: '10px 0' }}>Contact</a>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '0',
          transform: 'none',
          width: '350px',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          padding: '24px', // Slightly more padding for text
          zIndex: 1000,
          border: '1px solid rgba(0,0,0,0.05)',
          animation: 'fade-in 0.2s ease-out',
          textAlign: 'left'
        }}>
          <div style={{
            fontWeight: '700',
            fontSize: '14px',
            color: '#1a1a1a',
            marginBottom: '20px',
            lineHeight: '1.5'
          }}>
            Have questions or need support? We’re here to help you with quick and reliable assistance.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '14px', color: 'var(--gray-600)', display: 'flex', alignItems: 'center' }}>
              <span style={{ marginRight: '12px', display: 'flex', alignItems: 'center', color: '#1a1a1a' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
              </span>
              getezi.service@gmail.com
            </div>
            <div style={{ fontSize: '14px', color: 'var(--gray-600)', display: 'flex', alignItems: 'center' }}>
              <span style={{ marginRight: '12px', display: 'flex', alignItems: 'center', color: '#1a1a1a' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
              </span>
              +91 6305213334
            </div>
            <div style={{ fontSize: '14px', color: 'var(--gray-600)', display: 'flex', alignItems: 'center' }}>
              <span style={{ marginRight: '12px', display: 'flex', alignItems: 'center', color: '#25D366' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"></path></svg>
              </span>
              +91 6354826498
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FAQsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [openIndex, setOpenIndex] = useState(null);

  const sections = [
    {
      title: "How does the system work?",
      desc: "Users can book tokens online or join a virtual queue by checking real-time availability."
    },
    {
      title: "Who can use this platform?",
      desc: "Government offices, hospitals, and service organizations can register and manage queues."
    },
    {
      title: "Do users get notifications?",
      desc: "Yes, automated reminders are sent when their turn is approaching."
    }
  ];

  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => { setIsOpen(false); setOpenIndex(null); }}
    >
      <a href="#faqs" style={{ cursor: 'pointer', display: 'block', padding: '10px 0' }}>FAQs</a>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '0',
          width: '350px',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          padding: '20px',
          zIndex: 1000,
          border: '1px solid rgba(0,0,0,0.05)',
          animation: 'fade-in 0.2s ease-out'
        }}>
          {sections.map((item, idx) => (
            <div key={idx} style={{
              marginBottom: idx === sections.length - 1 ? 0 : '12px',
              paddingBottom: idx === sections.length - 1 ? 0 : '12px',
              borderBottom: idx === sections.length - 1 ? 'none' : '1px solid rgba(0,0,0,0.06)'
            }}>
              <div
                onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
                style={{
                  fontWeight: '700',
                  fontSize: '14px',
                  color: '#1a1a1a',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '4px 0'
                }}
              >
                {item.title}
                <span style={{ transition: 'transform 0.2s', transform: openIndex === idx ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                </span>
              </div>

              {openIndex === idx && (
                <div style={{
                  fontSize: '13px',
                  color: 'var(--gray-500)',
                  marginTop: '4px',
                  lineHeight: '1.4',
                  paddingLeft: '4px',
                  borderLeft: '2px solid #e1e4e8',
                  animation: 'fade-in 0.2s ease-out',
                  opacity: 0.8
                }}>
                  {item.desc}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Landing View Component
function LandingView({ onLogin, onRegisterAdmin, onRegisterCustomer }) {
  return (
    <div className="landing-container">
      <header className="landing-header">
        <div className="nav-links">
          <AboutDropdown />
          <ContactDropdown />
          <FAQsDropdown />
        </div>

        <div className="brand-center">
          <span style={{ fontWeight: 800 }}>GetEzi</span>
          <span style={{ fontSize: '12px', verticalAlign: 'top', marginLeft: '2px', transform: 'scale(2)', position: 'relative', left: '10px', top: '-3px' }}>🌱</span>
        </div>

        <div className="landing-nav">
          <button className="login-outline-btn" onClick={() => onLogin()}>Log in</button>
        </div>
      </header>

      <div className="landing-content">
        <div className="landing-card">
          <div className="card-text-group">
            <h2>For <i>Companies</i></h2>
            <p>Your people, your business, your growth - beautifully managed.</p>
          </div>
          <button className="login-black-btn" onClick={() => onLogin('admin')}>Login</button>
          <div className="signup-prompt">
            Don't have an account? <span onClick={onRegisterAdmin} className="link">Sign up.</span>
          </div>
        </div>

        <div className="landing-card">
          <div className="card-text-group">
            <h2>For <i>Customers</i></h2>
            <p>Join us and experience smoother services, every step of the way.</p>
          </div>
          <button className="login-black-btn" onClick={() => onLogin('customer')}>Login</button>
          <div className="signup-prompt">
            Don't have an account? <span onClick={onRegisterCustomer} className="link">Sign up.</span>
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

// Modern Location Picker
function LocationPicker({ onSelect, onDetect, status }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    if (mapRef.current && !mapInstance.current && window.L) {
      mapInstance.current = window.L.map(mapRef.current, { zoomControl: false }).setView([20, 78], 4);
      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap & CartoDB'
      }).addTo(mapInstance.current);

      // Add Zoom Control at bottom right for cleaner look
      window.L.control.zoom({ position: 'bottomright' }).addTo(mapInstance.current);

      mapInstance.current.on('click', (e) => {
        const { lat, lng } = e.latlng;
        if (markerRef.current) markerRef.current.remove();
        markerRef.current = window.L.marker([lat, lng]).addTo(mapInstance.current);
        onSelect({ lat, lng });
      });

      // Try initial detect
      if (status === 'detecting') {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;
            mapInstance.current.setView([latitude, longitude], 14);
            if (markerRef.current) markerRef.current.remove();
            markerRef.current = window.L.marker([latitude, longitude]).addTo(mapInstance.current);
            onSelect({ lat: latitude, lng: longitude });
          },
          () => { },
          { timeout: 5000 }
        );
      }
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [onSelect]);

  return (
    <div style={{ position: 'relative', height: '320px', width: '100%', borderRadius: '16px', overflow: 'hidden', boxShadow: 'var(--shadow-md)', border: '1px solid var(--gray-200)' }}>
      <div ref={mapRef} style={{ height: '100%', width: '100%', zIndex: 0 }} />

      {/* Floating Controls */}
      <div style={{ position: 'absolute', top: '16px', left: '16px', right: '16px', zIndex: 400, display: 'flex', gap: '8px' }}>
        <div style={{ flex: 1, background: 'white', padding: '12px 16px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📍</span>
          {status === 'detected' ? 'Location Pinned' : 'Tap on map to pin location'}
        </div>
        <button
          onClick={onDetect}
          className="hover-lift"
          style={{
            background: 'white', border: 'none', borderRadius: '12px', width: '48px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', cursor: 'pointer', fontSize: '1.2rem'
          }}
          title="Detect My Location"
        >
          🎯
        </button>
      </div>
    </div>
  );
}

// 3-Step Booking Wizard
function BookingModal({ isOpen, onClose, onSubmit, office, user }) {
  if (!isOpen) return null;

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    customerName: user?.name || '',
    customerEmail: '',
    customerContact: '',
    serviceType: '',
    userLat: null,
    userLng: null
  });
  const [locationStatus, setLocationStatus] = useState('');

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const handleSubmit = () => {
    onSubmit(form);
    onClose();
    setStep(1); // Reset
  };

  const handleDetect = () => {
    setLocationStatus('detecting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm(prev => ({ ...prev, userLat: pos.coords.latitude, userLng: pos.coords.longitude }));
        setLocationStatus('detected');
      },
      () => setLocationStatus('failed'),
      { timeout: 5000 }
    );
  };

  const services = office?.service_type
    ? office.service_type.split(',').map(s => s.trim()).filter(Boolean)
    : ['General Inquiry', 'Support', 'Consultation'];

  return (
    <div className="modal-overlay">
      <div className="modal-content animate-slide-up" style={{ padding: '0', overflow: 'hidden', maxWidth: '550px' }}>
        {/* Header with Progress */}
        <div style={{ padding: '24px', background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-200)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.2rem' }}>Book Appointment</h3>
            <button className="btn btn-ghost small" onClick={onClose}>Close</button>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[1, 2, 3].map(s => (
              <div key={s} style={{
                height: '4px', flex: 1, borderRadius: '2px',
                background: s <= step ? 'var(--primary-500)' : 'var(--gray-300)',
                transition: 'background 0.3s ease'
              }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>
            <span>Details</span>
            <span>Service</span>
            <span>Location</span>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '32px' }}>
          {step === 1 && (
            <div className="animate-fade-in">
              <h4 style={{ marginBottom: '20px' }}>Your Details</h4>
              <div className="grid-1" style={{ gap: '16px' }}>
                <div className="input-group">
                  <label className="input-label">Full Name</label>
                  <input className="input-field" value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} autoFocus />
                </div>
                <div className="input-group">
                  <label className="input-label">Email Address</label>
                  <input className="input-field" type="email" value={form.customerEmail} onChange={e => setForm({ ...form, customerEmail: e.target.value })} />
                </div>
                <div className="input-group">
                  <label className="input-label">Phone (Optional)</label>
                  <input className="input-field" type="tel" value={form.customerContact} onChange={e => setForm({ ...form, customerContact: e.target.value })} />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-fade-in">
              <h4 style={{ marginBottom: '20px' }}>Select Service</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {services.map(service => (
                  <button
                    key={service}
                    className="hover-lift"
                    onClick={() => setForm({ ...form, serviceType: service })}
                    style={{
                      padding: '16px', borderRadius: '12px', border: form.serviceType === service ? '2px solid var(--primary-500)' : '1px solid var(--gray-200)',
                      background: form.serviceType === service ? 'var(--primary-50)' : 'white',
                      textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ fontWeight: '600', color: form.serviceType === service ? 'var(--primary-700)' : 'var(--gray-900)' }}>{service}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-fade-in">
              <h4 style={{ marginBottom: '12px' }}>Confirm Location</h4>
              <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '20px' }}>Help us estimate your arrival time.</p>
              <LocationPicker
                status={locationStatus}
                onDetect={handleDetect}
                onSelect={({ lat, lng }) => {
                  setForm(f => ({ ...f, userLat: lat, userLng: lng }));
                  setLocationStatus('detected');
                }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '24px', borderTop: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between' }}>
          {step > 1 ? (
            <button className="btn btn-secondary" onClick={prevStep}>Back</button>
          ) : (
            <div /> // Spacer
          )}

          {step < 3 ? (
            <button
              className="btn btn-primary"
              onClick={nextStep}
              disabled={step === 1 ? (!form.customerName || !form.customerEmail) : (!form.serviceType)}
            >
              Next Step
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={!form.userLat && !form.userLng}
              style={{ paddingLeft: '32px', paddingRight: '32px' }}
            >
              Confirm Booking
            </button>
          )}
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

const ProfileView = ({ user, onBack, office }) => {
  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h2 className="page-title">My Profile</h2>
          <p className="page-subtitle">Manage your personal information</p>
        </div>
        <button className="btn btn-ghost" onClick={onBack}>Back to Dashboard</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 300px', gap: '32px', alignItems: 'start' }}>
        {/* Left Col: Personal Info */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px' }}>
            <div style={{
              width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary-500), var(--primary-700))',
              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)'
            }}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '4px' }}>{user.name}</h3>
              <div className={`chip ${user.role === 'admin' ? 'chip-success' : 'chip-warning'}`}>
                <span className="chip-dot"></span>
                {user.role}
              </div>
            </div>
          </div>

          <h4 style={{ marginBottom: '20px', borderBottom: '1px solid var(--gray-200)', paddingBottom: '12px' }}>Personal Details</h4>
          <div className="grid-2">
            <div className="input-group">
              <label className="input-label">Email</label>
              <div className="input-field" style={{ background: 'var(--gray-50)' }}>{user.email}</div>
            </div>
            <div className="input-group">
              <label className="input-label">Phone</label>
              <div className="input-field" style={{ background: 'var(--gray-50)' }}>{user.phone || 'Not provided'}</div>
            </div>
            <div className="input-group">
              <label className="input-label">Date of Birth</label>
              <div className="input-field" style={{ background: 'var(--gray-50)' }}>{user.dob ? new Date(user.dob).toLocaleDateString() : 'Not provided'}</div>
            </div>
            <div className="input-group">
              <label className="input-label">Age/Gender</label>
              <div className="input-field" style={{ background: 'var(--gray-50)' }}>
                {user.age ? `${user.age} yrs` : '-'} · {user.gender || '-'}
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Office / Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {user.role === 'admin' && office ? (
            <div className="card hover-lift">
              <h4 style={{ marginBottom: '16px' }}>Office Structure</h4>
              <div className="input-group">
                <label className="input-label">Office Name</label>
                <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>{office.name}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                <span className="text-muted">Avg. Service Time</span>
                <span className="chip chip-success">{office.avg_service_minutes} mins</span>
              </div>
            </div>
          ) : (
            <div className="card hover-lift">
              <h4 style={{ marginBottom: '16px' }}>Membership</h4>
              <div style={{ padding: '16px', background: 'var(--primary-50)', borderRadius: '12px', border: '1px solid var(--primary-100)' }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--primary-700)', fontWeight: '600' }}>Standard Member</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--primary-600)', marginTop: '4px' }}>Joined {new Date().getFullYear()}</div>
              </div>
            </div>
          )}

          <div className="card" style={{ background: 'linear-gradient(135deg, var(--primary-600), var(--primary-700))', color: 'white' }}>
            <h4 style={{ color: 'white', marginBottom: '8px' }}>GetEzi Pro</h4>
            <p style={{ fontSize: '0.9rem', opacity: 0.9, marginBottom: '16px' }}>Upgrade to manage multiple offices and get advanced analytics.</p>
            <button className="btn" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', width: '100%', border: 'none' }}>Coming Soon</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const SettingsView = ({ user, onBack, adminKey, selectedOfficeId }) => {
  const [retention, setRetention] = useState(user.history_retention_days || 30);
  const [exportStart, setExportStart] = useState(new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]);
  const [exportEnd, setExportEnd] = useState(new Date().toISOString().split('T')[0]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSaveRetention = async () => {
    if (!adminKey) return setMessage('Admin Access Required');
    setLoading(true);
    try {
      await fetchJSON('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ userId: user.id, retentionDays: Number(retention) })
      });
      setMessage('Preferences saved successfully.');
    } catch (err) { setMessage(err.message); } finally { setLoading(false); }
  };

  const handleExport = async () => {
    if (!adminKey) return setMessage('Admin Access Required');
    setLoading(true);
    try {
      const query = new URLSearchParams({ start: exportStart, end: exportEnd, format: 'xlsx' }).toString();
      const response = await fetch(`/api/admin/export?${query}`, {
        headers: { 'x-admin-key': adminKey }
      });
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `token_history_${exportStart}_to_${exportEnd}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setMessage('Export started.');
    } catch (err) { setMessage(err.message); } finally { setLoading(false); }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h2 className="page-title">Settings</h2>
          <p className="page-subtitle">Configure your workspace preferences</p>
        </div>
        <button className="btn btn-ghost" onClick={onBack}>Back to Dashboard</button>
      </div>

      <div style={{ display: 'grid', gap: '24px' }}>
        {/* Data Retention Card */}
        {user.role === 'admin' ? (
          <>
            <section className="card hover-lift">
              <div className="panel-header">
                <div>
                  <h3 style={{ fontSize: '1.2rem' }}>Data Management</h3>
                  <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '4px' }}>Control how long your data is stored.</p>
                </div>
              </div>
              <div className="grid-2">
                <div className="input-group">
                  <label className="input-label">History Retention (Days)</label>
                  <select
                    className="input-field"
                    value={retention}
                    onChange={e => setRetention(e.target.value)}
                    style={{ cursor: 'pointer' }}
                  >
                    <option value={30}>30 Days</option>
                    <option value={60}>60 Days</option>
                    <option value={90}>90 Days</option>
                    <option value={365}>1 Year</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '8px' }}>
                  <button className="btn btn-primary" onClick={handleSaveRetention} disabled={loading} style={{ width: '100%' }}>
                    {loading ? 'Saving...' : 'Save Preference'}
                  </button>
                </div>
              </div>
              {message && <div style={{ marginTop: '12px', color: 'var(--primary-600)', fontWeight: '500' }}>{message}</div>}
            </section>

            {/* Export Card */}
            <section className="card hover-lift">
              <div className="panel-header">
                <div>
                  <h3 style={{ fontSize: '1.2rem' }}>Export Data</h3>
                  <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '4px' }}>Download your token history as CSV.</p>
                </div>
              </div>
              <div className="grid-3">
                <div className="input-group">
                  <label className="input-label">Start Date</label>
                  <input type="date" className="input-field" value={exportStart} onChange={e => setExportStart(e.target.value)} />
                </div>
                <div className="input-group">
                  <label className="input-label">End Date</label>
                  <input type="date" className="input-field" value={exportEnd} onChange={e => setExportEnd(e.target.value)} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '8px' }}>
                  <button className="btn btn-secondary" onClick={handleExport} style={{ width: '100%' }}>
                    Download CSV
                  </button>
                </div>
              </div>
            </section>
          </>
        ) : (
          <div className="card hover-lift text-center" style={{ padding: '48px' }}>
            <h3 style={{ marginBottom: '8px' }}>Coming Soon</h3>
            <p className="text-muted">Customer preferences are under development.</p>
          </div>
        )}

        {/* Future Settings Placeholder */}
        <section className="card" style={{ opacity: 0.7 }}>
          <div className="panel-header">
            <div>
              <h3 style={{ fontSize: '1.2rem' }}>Notifications</h3>
              <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '4px' }}>Email & SMS alerts (Coming Soon)</p>
            </div>
            <span className="chip chip-warning">Beta</span>
          </div>
          <div className="input-group">
            <label className="input-label">Daily Digest</label>
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button className="btn btn-secondary" disabled>Email Me</button>
              <button className="btn btn-secondary" disabled>SMS Me</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

const HistoryView = ({ user, onBack, adminKey, selectedOfficeId }) => {
  const [history, setHistory] = useState([]);
  const [start, setStart] = useState(new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]);
  const [end, setEnd] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadHistory();
  }, [start, end, status]);

  const loadHistory = async () => {
    if (!adminKey) return;
    setLoading(true);
    try {
      const query = `officeId=${selectedOfficeId}&start=${start}&end=${end}&status=${status}`;
      const data = await fetchJSON(`/api/admin/token-history?${query}`);
      setHistory(data.history || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: '800px', margin: '40px auto' }}>
      <div className="panel-header">
        <h3>Token Archives</h3>
        <button className="btn btn-ghost" onClick={onBack}>Back</button>
      </div>

      <div className="grid-3" style={{ marginBottom: '20px' }}>
        <label className="input-group">
          <span className="input-label">From</span>
          <input className="input-field" type="date" value={start} onChange={e => setStart(e.target.value)} />
        </label>
        <label className="input-group">
          <span className="input-label">To</span>
          <input className="input-field" type="date" value={end} onChange={e => setEnd(e.target.value)} />
        </label>
        <label className="input-group">
          <span className="input-label">Status</span>
          <select className="input-field" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="all">All</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no-show">No Show</option>
          </select>
        </label>
      </div>

      <div className="token-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {loading && <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading records...</div>}
        {!loading && history.length === 0 && (
          <div className="empty-state" style={{ padding: '40px' }}>No archived records found for this range.</div>
        )}
        {history.map(t => (
          <div key={t.id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '16px', borderBottom: '1px solid var(--gray-100)'
          }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '1rem', color: 'var(--primary-700)' }}>#{t.token_number} - {t.user_name}</div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                {new Date(t.created_at).toLocaleDateString()} · {t.service_type} · <span className="badge badge-neutral">{t.status}</span>
              </div>
            </div>
            <div className="badge badge-neutral" style={{ fontSize: '0.8rem' }}>
              Archived: {new Date(t.archived_at).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

function App() {
  const { user, logout, loading: authLoading } = useAuth();

  // Initialize view from history state or default
  const [view, setViewState] = useState(user ? (user.role === 'admin' ? 'admin' : 'customer') : 'landing');

  // Pause Modal State
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pauseReason, setPauseReason] = useState('Short Break');
  const [pauseMessage, setPauseMessage] = useState('');
  const [selectedToken, setSelectedToken] = useState(null);

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
  const [showAdminKey, setShowAdminKey] = useState(false);

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
  const [tokenFilter, setTokenFilter] = useState('pending'); // 'pending', 'completed', 'cancelled'

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

  // Socket.IO Integration
  useEffect(() => {
    const socket = io(API_BASE);

    if (user) {
      socket.emit('join_user', user.id);
    }

    if (selectedOfficeId) {
      socket.emit('join_office', selectedOfficeId);
    }

    socket.on('queue_update', (data) => {
      if (data.officeId === selectedOfficeId) {
        setSelectedOfficeData(prev => {
          if (!prev || !prev.office) return prev; // If initial fetch hasn't happened, ignore update to avoid corruption

          return {
            ...prev,
            tokens: data.tokens,
            office: { ...prev.office, ...data.stats }
          };
        });
      }
    });

    socket.on('notification', (payload) => {
      setMessage(payload.message); // Show toast
      setNotificationCount(c => c + 1); // Increment badge
    });

    return () => socket.disconnect();
  }, [selectedOfficeId, user]);

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
      if (user?.role === 'admin') {
        if (data.offices.length > 0) {
          setSelectedOfficeId(data.offices[0].id);
        } else if (user.is_verified) {
          // Redirect to create office if none exist and Verified
          setView('create-office');
        }
      } else if (!selectedOfficeId && data.offices.length > 0 && user?.role !== 'admin') {
        // for customers, maybe don't auto select or keep existing logic
        setSelectedOfficeId(data.offices[0].id);
      }
    } catch (err) { setMessage(err.message); } finally { setLoading(false); }
  };

  const fetchOfficeDetail = async (id) => {
    if (!id || id === 'undefined' || id === 'null') return;
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
          lat: formData.userLat,
          lng: formData.userLng,
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
      setMessage(`Called ${data.user_name}`);
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
        'no-show': 'marked as no-show',
        're-queue': 're-queued'
      };

      setMessage(`Token ${verbs[action] || action}`);
      fetchOfficeDetail(selectedOfficeId);
    } catch (err) { setMessage(err.message); }
  };

  const handlePauseToggle = async () => {
    if (!adminKey) return setMessage('Admin key required');

    if (selectedOffice.is_paused) {
      // Resume Logic
      try {
        await fetchJSON(`/api/offices/${selectedOfficeId}/resume`, {
          method: 'POST',
          headers: { 'x-admin-key': adminKey }
        });
        setMessage('Queue Resumed');
        fetchOfficeDetail(selectedOfficeId);
      } catch (err) { setMessage(err.message); }
    } else {
      // Open Pause Modal
      setPauseReason('Short Break');
      setPauseMessage('Service paused for a short break. We will resume shortly.');
      setShowPauseModal(true);
    }
  };

  const submitPause = async () => {
    try {
      await fetchJSON(`/api/offices/${selectedOfficeId}/pause`, {
        method: 'POST',
        headers: { 'x-admin-key': adminKey },
        body: JSON.stringify({ reason: pauseReason, message: pauseMessage })
      });
      setMessage('Queue Paused');
      setShowPauseModal(false);
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

  if (view === 'settings') {
    return (
      <>
        <header className="app-header">
          <div className="eyebrow">Settings</div>
          <ProfileMenu user={user} onNavigate={setView} onLogout={logout} />
        </header>
        <SettingsView user={user} onBack={() => setView('admin')} adminKey={adminKey} selectedOfficeId={selectedOfficeId} />
      </>
    );
  }

  if (view === 'history') {
    return (
      <>
        <header className="app-header">
          <div className="eyebrow">Archives</div>
          <ProfileMenu user={user} onNavigate={setView} onLogout={logout} />
        </header>
        <HistoryView user={user} onBack={() => setView('admin')} adminKey={adminKey} selectedOfficeId={selectedOfficeId} />
      </>
    );
  }

  // Admin / Customer Dashboard
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
        <ProfileView
          user={user}
          onBack={() => setView(user.role === 'admin' ? 'admin' : 'customer')}
          office={user.role === 'admin' ? offices[0] : null}
        />
      ) : view === 'settings' ? (
        <SettingsView onBack={() => setView(user.role === 'admin' ? 'admin' : 'customer')} />
      ) : (
        <div className="dashboard-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 300px) 1fr', gap: '24px', alignItems: 'start' }}>
          <aside className="card" style={{ padding: '24px', height: 'fit-content' }}>
            <div className="view-toggle" style={{ marginBottom: 20 }}>
              {/* Role-based: show only relevant view or both if dual-role (simplified to strict separation) */}
              <div style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--primary-600)', letterSpacing: '0.05em' }}>Logged in as {user.role}</div>
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
                  You need to create an office to get started.
                </div>
              )}
              {user?.role === 'admin' && offices.map((office) => (
                // Admin sees only their own offices, simplified view or just auto-selected. 
                // Request says "don't show it", implies singular focus.
                // We will show a simple list if they have multiple, but likely just one.
                <button
                  key={office.id}
                  className={`office-card ${selectedOfficeId === office.id ? 'selected' : ''}`}
                  onClick={() => setSelectedOfficeId(office.id)}
                >
                  <div className="office-name">{office.name} (Your Office)</div>
                  <div className="office-meta">
                    <span>Queue: {office.queueCount || 0}</span>
                  </div>
                </button>
              ))}
            </div>

            {view === 'admin' && (
              <>
                {/* REMOVED Create Office Form from Sidebar */}
                {/* Only History remains */}
                <div className="panel-section">
                  <h4>History</h4>
                  <button onClick={() => setView('history')} className="ghost">View Token History</button>
                </div>
              </>
            )}
          </aside>

          <main style={{ display: 'flex', flexDirection: 'column' }}>
            {showHistory && view === 'admin' ? (
              <div className="card history-view">
                <div className="panel-header">
                  <h3>Token History</h3>
                  <button className="btn btn-ghost" onClick={() => setShowHistory(false)}>Close</button>
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
                <section className="card" style={{ marginBottom: '24px' }}>
                  <div className="panel-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <h3 style={{ fontSize: '1.5rem', letterSpacing: '-0.02em' }}>{selectedOffice.name}</h3>
                      {view === 'admin' && (
                        <span className={`chip ${selectedOffice.is_paused ? 'chip-warning' : 'chip-success'}`}>
                          <span className="chip-dot" />
                          {selectedOffice.is_paused ? 'Paused' : 'Live'}
                        </span>
                      )}
                    </div>
                    <div className="stat-group">
                      {view === 'admin' && (
                        <button className="btn btn-ghost small" onClick={() => setView('history')} style={{ marginRight: 'auto' }}>View Archives</button>
                      )}
                      {view === 'admin' ? (
                        <Stat label="Current Token" value={
                          (selectedOfficeData?.tokens || [])
                            .filter(t => t.status === 'called')
                            .sort((a, b) => (new Date(b.called_at || 0) - new Date(a.called_at || 0)))[0]?.token_number || '--'
                        } />
                      ) : (
                        <Stat label="Wait" value={
                          (selectedOffice.queueCount * (selectedOffice.average_velocity || selectedOffice.avg_service_minutes)) > 0
                            ? `${Math.round(selectedOffice.queueCount * (selectedOffice.average_velocity || selectedOffice.avg_service_minutes))}m`
                            : 'Access Allowed'
                        } />
                      )}
                      <Stat label="Avail" value={selectedOffice.available_today} />
                      {view === 'admin' && (
                        <Stat label="Velocity" value={`${Math.round((selectedOffice.counter_count || 1) / (selectedOffice.average_velocity || 5))} t/m`} />
                      )}
                    </div>
                  </div>
                </section>

                {view === 'customer' && (
                  <section className="card" style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h4 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Book a Slot</h4>
                        <p style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>
                          {selectedOffice.available_today > 0
                            ? "We're open! Book now to skip the line."
                            : `Current estimated wait is ${Math.round(selectedOffice.queueCount * (selectedOffice.average_velocity || selectedOffice.avg_service_minutes))} mins. We'll notify you.`
                          }
                        </p>
                      </div>
                      <button className="btn btn-primary" onClick={() => setIsBookingModalOpen(true)}>Book Now</button>
                    </div>
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
                  <section className="card" style={{ marginBottom: '24px' }}>
                    <h4 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Admin Controls</h4>
                    <div className="admin-controls-grid">
                      <div className="grid-2" style={{ marginBottom: '16px' }}>
                        <div className="input-group">
                          <span className="input-label">Availability</span>
                          <input className="input-field" type="number" value={availabilityInput} onChange={e => setAvailabilityInput(e.target.value)} />
                        </div>
                        <div className="input-group" style={{ position: 'relative' }}>
                          <span className="input-label">Admin Key</span>
                          <div style={{ position: 'relative' }}>
                            <input
                              className="input-field"
                              type={showAdminKey ? 'text' : 'password'}
                              value={adminKey}
                              onChange={e => setAdminKey(e.target.value)}
                              placeholder="••••"
                              style={{ paddingRight: '40px' }}
                            />
                            <button
                              className="btn btn-ghost"
                              onClick={() => setShowAdminKey(!showAdminKey)}
                              style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', padding: '4px 8px' }}
                            >
                              {showAdminKey ? 'Hide' : 'Show'}
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2" style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={handleAvailabilityUpdate} className="btn btn-secondary">Update</button>
                        <button onClick={callNext} disabled={selectedOffice.is_paused || (selectedOfficeData?.tokens || []).filter(t => t.status === 'CALLED').length >= (selectedOffice.counter_count || 1)} className="btn btn-primary">Call Next</button>
                        <button onClick={handlePauseToggle} className={`btn ${selectedOffice.is_paused ? 'btn-danger' : 'btn-secondary'}`}>
                          {selectedOffice.is_paused ? 'Resume' : 'Pause'}
                        </button>
                      </div>
                    </div>
                    {/* Pause Modal */}
                    {showPauseModal && (
                      <div className="modal-overlay">
                        <div className="modal-content">
                          <h3 style={{ marginTop: 0 }}>Pause Office Service</h3>
                          <div className="input-group">
                            <label className="input-label" style={{ marginBottom: '12px' }}>Select Reason</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              {[
                                ['Short Break', 'Service paused for a short break. We will resume shortly.'],
                                ['Lunch Break', 'Service paused for lunch break. Please wait for resume notification.'],
                                ['System Maintenance', 'Service paused due to system maintenance. ETA will update after resume.']
                              ].map(([reason, msg]) => (
                                <label key={reason} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '12px', border: '1px solid var(--gray-200)', borderRadius: '8px', transition: 'all 0.2s' }}>
                                  <input
                                    type="radio"
                                    name="pauseReason"
                                    checked={pauseReason === reason}
                                    onChange={() => { setPauseReason(reason); setPauseMessage(msg); }}
                                    style={{ accentColor: 'var(--primary-600)' }}
                                  />
                                  <span style={{ fontWeight: 500 }}>{reason}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                          <div className="input-group">
                            <label className="input-label">Additional Note (Optional)</label>
                            <textarea
                              className="input-field"
                              value={pauseMessage}
                              onChange={e => setPauseMessage(e.target.value)}
                              rows={3}
                            />
                          </div>
                          <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
                            <button className="btn btn-ghost" onClick={() => setShowPauseModal(false)}>Cancel</button>
                            <button onClick={submitPause} className="btn btn-danger">Confirm Pause</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </section>
                )}

                <section className="card">
                  <h4 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>
                    {view === 'customer' ? 'Your Visit Status' : 'Live Queue Operations'}
                  </h4>
                  {/* Enable tabs for both customer and admin */}
                  {(view === 'customer' || view === 'admin') && (
                    <div className="tabs" style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: 'var(--gray-50)', padding: '4px', borderRadius: 'var(--radius-md)', width: 'fit-content' }}>
                      <button
                        className="btn"
                        style={{
                          padding: '6px 16px', borderRadius: '8px', fontSize: '0.9rem',
                          background: tokenFilter === 'pending' ? 'white' : 'transparent',
                          color: tokenFilter === 'pending' ? 'var(--primary-600)' : 'var(--text-muted)',
                          boxShadow: tokenFilter === 'pending' ? 'var(--shadow-sm)' : 'none'
                        }}
                        onClick={() => setTokenFilter('pending')}
                      >
                        Pending
                      </button>
                      <button
                        className="btn"
                        style={{
                          padding: '6px 16px', borderRadius: '8px', fontSize: '0.9rem',
                          background: tokenFilter === 'completed' ? 'white' : 'transparent',
                          color: tokenFilter === 'completed' ? 'var(--primary-600)' : 'var(--text-muted)',
                          boxShadow: tokenFilter === 'completed' ? 'var(--shadow-sm)' : 'none'
                        }}
                        onClick={() => setTokenFilter('completed')}
                      >
                        Completed
                      </button>
                      <button
                        className="btn"
                        style={{
                          padding: '6px 16px', borderRadius: '8px', fontSize: '0.9rem',
                          background: tokenFilter === 'cancelled' ? 'white' : 'transparent',
                          color: tokenFilter === 'cancelled' ? 'var(--primary-600)' : 'var(--text-muted)',
                          boxShadow: tokenFilter === 'cancelled' ? 'var(--shadow-sm)' : 'none'
                        }}
                        onClick={() => setTokenFilter('cancelled')}
                      >
                        Cancelled
                      </button>
                    </div>
                  )}
                  <div className="token-list">
                    {(selectedOfficeData?.tokens || [])
                      .filter(t => {
                        // Admin sees all users, Customer sees only theirs
                        if (view === 'customer') {
                          const isMine = t.user_id === user?.id;
                          if (!isMine) return false;
                        }

                        // Apply status filter for both
                        if (tokenFilter === 'pending') return ['WAIT', 'ALLOCATED', 'CALLED', 'booked', 'queued', 'called'].includes(t.status);
                        if (tokenFilter === 'completed') return ['COMPLETED', 'completed'].includes(t.status);
                        if (tokenFilter === 'cancelled') return ['cancelled', 'no-show', 'history'].includes(t.status);
                        return false;
                      })
                      .map(t => {
                        if (view === 'admin') {
                          return (
                            <AdminTokenRow key={t.id} token={t} onComplete={id => updateToken(id, 'complete')} onNoShow={id => updateToken(id, 'no-show')} onCancel={id => updateToken(id, 'cancel')} onReQueue={id => updateToken(id, 're-queue')} onSelect={setSelectedToken} />
                          );
                        } else {
                          return (
                            <CustomerTokenRow key={t.id} token={t} onCancel={id => updateToken(id, 'cancel')} onArrive={id => updateToken(id, 'arrive')} isOwner={t.user_id === user?.id} office={selectedOffice} />
                          );
                        }
                      })}
                    {selectedToken && (
                      <TokenDetailsModal token={selectedToken} office={selectedOffice} onClose={() => setSelectedToken(null)} onAction={updateToken} />
                    )}
                    {view === 'customer' && (selectedOfficeData?.tokens || []).filter(t => {
                      const isMine = t.user_id === user?.id;
                      if (!isMine) return false;
                      if (tokenFilter === 'pending') return ['WAIT', 'ALLOCATED', 'CALLED', 'booked', 'queued', 'called'].includes(t.status);
                      if (tokenFilter === 'completed') return ['COMPLETED', 'completed'].includes(t.status);
                      if (tokenFilter === 'cancelled') return ['cancelled', 'no-show', 'history'].includes(t.status);
                      return false;
                    }).length === 0 && (
                        <div className="empty-state">
                          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🌱</div>
                          No tokens found in "{tokenFilter}" section.
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

