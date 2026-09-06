import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Clock, LogOut, ChevronDown } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getTodayAttendance, checkInRequest, checkOutRequest, resetTodayRequest } from '../api/attendance';

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
  const { currentUser } = useApp();
  const queryClient = useQueryClient();
  const [open, setOpen]       = useState(false);
  const [elapsed, setElapsed] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const ref = useRef();

  // ── Fetch today's record scoped to the logged-in user ─────────────────────
  // Key includes currentUser.id so switching accounts never leaks cached data
  const { data: todayRecord } = useQuery({
    queryKey: ['attendance', 'today', currentUser?.id],
    queryFn: () => getTodayAttendance().then(r => r.data ?? null),
    enabled: !!currentUser?.id,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // All state is derived purely from the DB record — no manual setState needed
  const checkedIn  = !!(todayRecord?.check_in && !todayRecord?.check_out);
  const checkedOut = !!(todayRecord?.check_in &&  todayRecord?.check_out);
  const checkInMs  = todayRecord?.check_in  ? new Date(todayRecord.check_in).getTime()  : null;
  const checkOutMs = todayRecord?.check_out ? new Date(todayRecord.check_out).getTime() : null;

  // Close popup on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Live elapsed timer — only ticks while actively checked in
  useEffect(() => {
    if (!checkedIn || !checkInMs) { setElapsed(''); return; }
    const tick = () => {
      const diff = Math.floor((Date.now() - checkInMs) / 1000);
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setElapsed(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      );
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [checkedIn, checkInMs]);

  const handleToggle = async () => {
    setError('');
    setLoading(true);
    if (!checkedIn) setElapsed('00:00:00');
    try {
      const res = checkedIn ? await checkOutRequest() : await checkInRequest();
      queryClient.setQueryData(['attendance', 'today', currentUser?.id], res.data);
      setOpen(false);
    } catch (err) {
      if (!checkedIn) setElapsed('');
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const statusLabel = checkedOut ? 'Completed' : checkedIn ? 'Checked In' : 'Not Checked In';
  const statusColor = checkedOut || !checkedIn ? 'var(--gray-400)' : 'var(--success, #16a34a)';

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className={`att-widget-btn ${checkedIn ? 'checked-in' : 'checked-out'}`}
        onClick={() => { setOpen(o => !o); setError(''); }}
        title={statusLabel}
      >
        <Clock size={15} />
      </button>

      {open && (
        <div className="att-popup">
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              Welcome back, {currentUser?.firstName}!
            </div>

            {checkedIn && checkInMs && (
              <div style={{ margin: '8px 0' }}>
                <div style={{ fontSize: 10, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                  Time at work
                </div>
                <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {elapsed}
                </div>
              </div>
            )}

            <div style={{ fontSize: 11, color: statusColor, fontWeight: 500, marginBottom: 2 }}>
              {statusLabel}
            </div>

            <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>
              {checkedIn && checkInMs  && `In: ${new Date(checkInMs).toLocaleTimeString()}`}
              {checkedOut && (
                <>
                  {checkInMs  && `In: ${new Date(checkInMs).toLocaleTimeString()}`}
                  {checkOutMs && <span style={{ marginLeft: 8 }}>{`Out: ${new Date(checkOutMs).toLocaleTimeString()}`}</span>}
                </>
              )}
              {!checkedIn && !checkedOut && 'No activity today yet'}
            </div>
          </div>

          {error && (
            <div style={{ fontSize: 12, color: 'var(--danger, #ef4444)', background: 'var(--danger-light, #fef2f2)', borderRadius: 6, padding: '6px 10px', marginBottom: 10, textAlign: 'center' }}>
              {error}
            </div>
          )}

          {checkedOut ? (
            <>
              <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--gray-500)', padding: '8px 0' }}>
                Attendance complete for today.
              </div>
              {import.meta.env.DEV && (
                <button
                  className="btn w-full btn-ghost btn-sm"
                  style={{ justifyContent: 'center', marginTop: 4, fontSize: 11, color: 'var(--gray-400)' }}
                  onClick={async () => {
                    const res = await resetTodayRequest();
                    queryClient.setQueryData(['attendance', 'today', currentUser?.id], res.data);
                  }}
                >
                  ↺ Reset for testing
                </button>
              )}
            </>
          ) : (
            <button
              className={`btn w-full ${checkedIn ? 'btn-danger' : 'btn-success'}`}
              style={{ justifyContent: 'center' }}
              onClick={handleToggle}
              disabled={loading}
            >
              {loading
                ? (checkedIn ? 'Checking out…' : 'Checking in…')
                : (checkedIn ? 'Check Out' : 'Check In')}
            </button>
          )}
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

        {['hr_payroll_user', 'hr_payroll_manager', 'admin'].includes(currentUser?.role) && (
          <NavItem label="Payroll ▾" active={path.startsWith('/payroll') || path.startsWith('/salary')}
            children={[
              { label: 'Pay Runs',          to: '/payroll/runs' },
              { label: 'Payslips',          to: '/payroll/payslips' },
              { label: 'Salary Structures', to: '/salary/structures' },
              { label: 'Salary Rules',      to: '/salary/rules' },
            ]}
          />
        )}

        {['hr_manager', 'hr_payroll_user', 'hr_payroll_manager', 'admin'].includes(currentUser?.role) && (
          <NavItem label="Dashboard" to="/dashboard" active={path === '/dashboard'} />
        )}

        {currentUser?.role === 'admin' && (
          <NavItem label="Users" to="/users" active={path === '/users'} />
        )}

        {currentUser?.role === 'admin' && (
          <NavItem label="Audit Trail" to="/audit-trail" active={path === '/audit-trail'} />
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
