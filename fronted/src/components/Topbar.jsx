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
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const ref = useRef();

  const { data: todayRecord } = useQuery({
    queryKey: ['attendance', 'today', currentUser?.id],
    queryFn: () => getTodayAttendance().then(r => r.data ?? null),
    enabled: !!currentUser?.id,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const checkedIn  = !!(todayRecord?.check_in && !todayRecord?.check_out);
  const checkedOut = !!(todayRecord?.check_in &&  todayRecord?.check_out);

  const fmt = (ts) => ts
    ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
    : '—';

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleToggle = async () => {
    setError('');
    setLoading(true);
    try {
      const res = checkedIn ? await checkOutRequest() : await checkInRequest();
      queryClient.setQueryData(['attendance', 'today', currentUser?.id], res.data);
      setOpen(false);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const statusLabel = checkedOut ? 'Completed' : checkedIn ? 'Checked In' : 'Not Checked In';
  const statusColor = checkedIn ? 'var(--success, #16a34a)' : 'var(--gray-400)';

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
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
              {currentUser?.firstName}
            </div>

            {/* Time rows — always show both, populated from DB */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--gray-400)' }}>Check In</span>
                <span style={{ fontWeight: 600, color: todayRecord?.check_in ? 'var(--gray-700, #374151)' : 'var(--gray-300)' }}>
                  {fmt(todayRecord?.check_in)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--gray-400)' }}>Check Out</span>
                <span style={{ fontWeight: 600, color: todayRecord?.check_out ? 'var(--gray-700, #374151)' : 'var(--gray-300)' }}>
                  {fmt(todayRecord?.check_out)}
                </span>
              </div>
              {todayRecord?.worked_hours != null && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--gray-400)' }}>Worked</span>
                  <span style={{ fontWeight: 600 }}>
                    {Number(todayRecord.worked_hours).toFixed(2)} hrs
                  </span>
                </div>
              )}
            </div>

            <div style={{ fontSize: 11, color: statusColor, fontWeight: 500 }}>
              {statusLabel}
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
  const path = location.pathname;
  const isHR = ['admin', 'hr_manager', 'hr_payroll_user', 'hr_payroll_manager'].includes(currentUser?.role);

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
        {isHR ? (
          <NavItem label="Employees ▾" active={path.startsWith('/employees') || path.startsWith('/schedules') || path.startsWith('/contracts')}
            children={[
              { label: 'Employees',         to: '/employees' },
              { label: 'Contracts',         to: '/contracts' },
              { label: 'Working Schedules', to: '/schedules' },
            ]}
          />
        ) : (
          <NavItem label="My Work" active={path.startsWith('/contracts')}
            children={[
              { label: 'My Contract', to: '/contracts' },
            ]}
          />
        )}

        <NavItem label="Attendance" to="/attendance" active={path.startsWith('/attendance')} />

        <NavItem label="Time Off ▾" active={path.startsWith('/timeoff')}
          children={[
            { label: 'Requests',       to: '/timeoff/requests' },
            { label: 'Allocations',    to: '/timeoff/allocations' },
            { label: 'Holidays',       to: '/timeoff/holidays' },
            ...( isHR ? [
              { label: 'Time Off Types', to: '/timeoff/types' },
            ] : [] ),
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
