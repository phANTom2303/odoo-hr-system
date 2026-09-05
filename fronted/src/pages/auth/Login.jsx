import { useState } from 'react';
import { useApp } from '../../context/AppContext';

export default function Login() {
  const { login } = useApp();
  const [email, setEmail]     = useState('admin@company.com');
  const [password, setPassword] = useState('admin123');
  const [error, setError]     = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const ok = login(email, password);
    if (!ok) setError('Invalid email or password.');
    else setError('');
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
            />
          </div>

          {error && (
            <div className="alert alert-danger" style={{ marginBottom: 14 }}>
              {error}
            </div>
          )}

          <button className="btn btn-primary w-full" style={{ justifyContent: 'center', padding: '10px' }} type="submit">
            Sign In
          </button>
        </form>

        <div style={{ marginTop: 20, padding: 12, background: 'var(--gray-50)', borderRadius: 8, fontSize: 12, color: 'var(--gray-500)' }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Demo accounts:</div>
          <div>admin@company.com / admin123</div>
          <div>aarav@company.com / pass123</div>
          <div>maya@company.com / pass123</div>
        </div>

        <p style={{ marginTop: 16, textAlign: 'center', fontSize: 11, color: 'var(--gray-400)' }}>
          Accounts are created by an administrator.
        </p>
      </div>
    </div>
  );
}
