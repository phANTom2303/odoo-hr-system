import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Clock, LogOut, User, ChevronDown } from 'lucide-react';
import { useApp } from '../context/AppContext';

function NavItem({ label, to, children, active }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!children) {
    return (
      <button className={`nav-item ${active ? 'active' : ''}`} onClick={() => navigate(to)}>
        {label}
      </button>
    );
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className={`nav-item ${active ? 'active' : ''}`} onClick={() => setOpen(o => !o)}>
        {label} <ChevronDown size={12} />
      </button>
      {open && (
        <div className="nav-dropdown">
          {children.map(c => (
            <button key={c.to} onClick={() => { navigate(c.to); setOpen(false); }}>
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AttendanceWidget() {
  const { checkedIn, setCheckedIn, checkInTime, setCheckInTime, currentUser } = useApp();
  const [open, setOpen] = useState(false);
  const [elapsed, setElapsed] = useState('');
  const ref = useRef();

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!checkedIn || !checkInTime) { setElapsed(''); return; }
    const iv = setInterval(() => {
      const diff = Math.floor((Date.now() - checkInTime) / 1000);
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setElapsed(`${h}h ${m}m ${s}s`);
    }, 1000);
    return () => clearInterval(iv);
  }, [checkedIn, checkInTime]);

  const toggle = () => {
    if (!checkedIn) {
      setCheckedIn(true);
      setCheckInTime(Date.now());
    } else {
      setCheckedIn(false);
      setCheckInTime(null);
    }
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className={`att-widget-btn ${checkedIn ? 'checked-in' : 'checked-out'}`}
        onClick={() => setOpen(o => !o)}
        title="Attendance"
      >
        <Clock size={15} />
      </button>
      {open && (
        <div className="att-popup">
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              Welcome back, {currentUser?.name?.split(' ')[0]}!
            </div>
            {checkedIn && checkInTime && (
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary)', margin: '8px 0' }}>
                {elapsed}
              </div>
            )}
            <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>
              {checkedIn
                ? `Checked in at ${new Date(checkInTime).toLocaleTimeString()}`
                : 'Not checked in'}
            </div>
          </div>
          <button
            className={`btn w-full ${checkedIn ? 'btn-danger' : 'btn-success'}`}
            style={{ justifyContent: 'center' }}
            onClick={toggle}
          >
            {checkedIn ? 'Check Out' : 'Check In'}
          </button>
        </div>
      )}
    </div>
  );
}

/** Map DB enum roles to display labels */
const ROLE_LABELS = {
  admin:               'Admin',
  hr_manager:          'HR Manager',
  hr_payroll_user:     'HR Payroll User',
  hr_payroll_manager:  'HR Payroll Manager',
  employee:            'Employee',
};

export default function Topbar() {
  const { currentUser, logout } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

  const handleLogout = async () => {
    await logout();
    // AppShell will re-render to show Login once currentUser is null
  };

  const roleLabel = ROLE_LABELS[currentUser?.role] ?? currentUser?.role ?? '';

  return (
    <div className="topbar">
      <div className="topbar-logo">PeoplePay360</div>
      <div style={{ fontSize: 12, color: 'var(--gray-300)', marginRight: 8 }}>HR</div>

      <nav className="topbar-nav">
        {['hr_manager', 'hr_payroll_user', 'hr_payroll_manager', 'admin'].includes(currentUser?.role) ? (
          <NavItem label="Employees ▾" active={path.startsWith('/employees') || path.startsWith('/schedules') || path.startsWith('/contracts')}
            children={[
              { label: 'Employees',        to: '/employees' },
              { label: 'Contracts',        to: '/contracts' },
              { label: 'Working Schedules',to: '/schedules' },
            ]}
          />
        ) : (
          <NavItem label="My Schedule" to="/schedules" active={path.startsWith('/schedules')} />
        )}

        <NavItem label="Attendance" to="/attendance" active={path.startsWith('/attendance')} />

        <NavItem label="Time Off ▾" active={path.startsWith('/timeoff')}
          children={[
            { label: 'Requests',       to: '/timeoff/requests' },
            { label: 'Allocations',    to: '/timeoff/allocations' },
            ...( (currentUser?.role === 'employee' || currentUser?.role === 'Employee') ? [] : [{ label: 'Time Off Types', to: '/timeoff/types' }] )
          ]}
        />

        {['hr_payroll_user', 'hr_payroll_manager', 'admin'].includes(currentUser?.role) ? (
          <NavItem label="Payroll ▾" active={path.startsWith('/payroll') || path.startsWith('/salary')}
            children={[
              { label: 'Pay Runs',          to: '/payroll/runs' },
              { label: 'Payslips',          to: '/payroll/payslips' },
              { label: 'Salary Structures', to: '/salary/structures' },
              { label: 'Salary Rules',      to: '/salary/rules' },
            ]}
          />
        ) : (
          <NavItem label="My Payslips" to="/payroll/payslips" active={path.startsWith('/payroll/payslips')} />
        )}

        {['hr_manager', 'hr_payroll_user', 'hr_payroll_manager', 'admin'].includes(currentUser?.role) && (
          <NavItem label="Dashboard" to="/dashboard" active={path === '/dashboard'} />
        )}

        {currentUser?.role === 'admin' && (
          <NavItem label="Users" to="/users" active={path === '/users'} />
        )}
      </nav>

      <div className="topbar-right">
        <AttendanceWidget />
        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
          {currentUser?.name}
          <span style={{ marginLeft: 6, color: 'var(--gray-400)' }}>({roleLabel})</span>
        </div>
        <button className="avatar-btn" title={currentUser?.name}>
          {currentUser?.initials}
        </button>
        <button className="btn-ghost btn btn-sm" onClick={handleLogout} title="Logout">
          <LogOut size={14} />
        </button>
      </div>
    </div>
  );
}
