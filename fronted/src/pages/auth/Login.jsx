import { useState } from 'react';
import { useApp } from '../../context/AppContext';

export default function Login() {
  const { login } = useApp();
  const [email, setEmail]       = useState('anish@peoplepay.dev');
  const [password, setPassword] = useState('password123');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      // On success, AppContext sets currentUser → AppShell renders the app shell
    } catch (err) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">PeoplePay360</div>
        <div className="login-sub">HR &amp; Payroll Platform</div>

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label>Work Email</label>
            <input
              className="form-control"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
              disabled={loading}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label>Password</label>
            <input
              className="form-control"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </div>

          {error && (
            <div className="alert alert-danger" style={{ marginBottom: 14 }}>
              {error}
            </div>
          )}

          <button
            className="btn btn-primary w-full"
            style={{ justifyContent: 'center', padding: '10px' }}
            type="submit"
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: 20, padding: 12, background: 'var(--gray-50)', borderRadius: 8, fontSize: 12, color: 'var(--gray-500)' }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Demo accounts (password: password123):</div>
          <div>anish@peoplepay.dev — Admin</div>
          <div>priya@peoplepay.dev — HR Manager</div>
          <div>rahul@peoplepay.dev — Employee</div>
          <div>neha@peoplepay.dev — Employee (Part-time)</div>
          <div>arjun@peoplepay.dev — Employee (Intern)</div>
        </div>

        <p style={{ marginTop: 16, textAlign: 'center', fontSize: 11, color: 'var(--gray-400)' }}>
          Accounts are created by an administrator.
        </p>
      </div>
    </div>
  );
}
