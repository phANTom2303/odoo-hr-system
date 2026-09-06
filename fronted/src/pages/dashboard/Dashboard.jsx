import { useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { AlertTriangle, Clock, Calendar, DollarSign } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getEmployees } from '../../api/employees';
import { getAttendance } from '../../api/attendance';
import { getLeaveRequests } from '../../api/leaveRequests';
import { getAllocations } from '../../api/allocations';

const BAR_COLORS = ['#4f46e5','#0891b2','#059669','#d97706','#7c3aed','#be185d'];
const fmt = (n) => n >= 100000
  ? `₹ ${(n / 100000).toFixed(1)}L`
  : `₹ ${n.toLocaleString('en-IN')}`;

export default function Dashboard() {
  const [dept, setDept] = useState('All Departments');

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => getEmployees().then(r => r.data),
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ['attendance', {}],
    queryFn: () => getAttendance().then(r => r.data),
  });

  const { data: leaveRequests = [] } = useQuery({
    queryKey: ['leave-requests', {}],
    queryFn: () => getLeaveRequests().then(r => r.data),
  });

  const { data: allocations = [] } = useQuery({
    queryKey: ['allocations', {}],
    queryFn: () => getAllocations().then(r => r.data),
  });

  // ── KPI calculations ────────────────────────────────────────
  const presentCount  = attendance.filter(a => a.status === 'present' || a.status === 'Late').length;
  const attHealth     = attendance.length ? Math.round((presentCount / attendance.length) * 100) : 0;
  const missingCO     = attendance.filter(a => a.check_in && !a.check_out).length;
  const approvedDays  = leaveRequests
    .filter(r => r.status === 'approved')
    .reduce((s, r) => s + Number(r.number_of_days || 0), 0);
  const pendingLeave  = leaveRequests.filter(r => r.status === 'pending' || r.status === 'draft').length;

  // ── Department overview ─────────────────────────────────────
  const depts = [...new Set(employees.map(e => e.department).filter(Boolean))];
  const deptOverview = depts.map(d => ({
    dept:      d,
    headcount: employees.filter(e => e.department === d).length,
  }));

  // ── Attendance status breakdown ─────────────────────────────
  const attBreakdown = [
    { label: 'Present',  value: attendance.filter(a => a.status === 'present').length,  color: 'var(--success)' },
    { label: 'Absent',   value: attendance.filter(a => a.status === 'absent').length,   color: 'var(--danger)'  },
    { label: 'On Leave', value: attendance.filter(a => a.status === 'on_leave').length, color: 'var(--warning)' },
    { label: 'Holiday',  value: attendance.filter(a => a.status === 'holiday').length,  color: 'var(--primary)' },
  ];

  // ── Time off by type ────────────────────────────────────────
  const toTypes = [...new Set(leaveRequests.map(r => r.time_off_type_name).filter(Boolean))];
  const toOverview = toTypes.map(type => {
    const approved = leaveRequests
      .filter(r => r.time_off_type_name === type && r.status === 'approved')
      .reduce((s, r) => s + (r.number_of_days || 0), 0);
    const pending = leaveRequests
      .filter(r => r.time_off_type_name === type && (r.status === 'pending' || r.status === 'draft'))
      .length;
    const alloc = allocations
      .filter(a => a.time_off_type_name === type && a.status === 'approved')
      .reduce((s, a) => s + Number(a.remaining || 0), 0);
    return { type, approved, pending, remaining: alloc };
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-breadcrumb">HR ▸ <span>Dashboard</span></div>
          <h1>HR Dashboard</h1>
          <p style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: 2 }}>
            Live overview of headcount, attendance, and time off.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-row" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--gray-600)' }}>
          <span>Department</span>
          <select className="filter-select" value={dept} onChange={e => setDept(e.target.value)}>
            <option>All Departments</option>
            {depts.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label"><DollarSign size={11} style={{ display: 'inline' }} /> Total Employees</div>
          <div className="kpi-value">{employees.length}</div>
          <div className="kpi-sub">{employees.filter(e => e.is_active).length} active</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label"><Clock size={11} style={{ display: 'inline' }} /> Attendance Health</div>
          <div className="kpi-value">{attHealth}%</div>
          <div className="kpi-sub">{presentCount} present of {attendance.length} records</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Missing Check-Outs</div>
          <div className="kpi-value" style={{ color: missingCO > 0 ? 'var(--danger)' : 'var(--success)' }}>{missingCO}</div>
          <div className="kpi-sub">Incomplete attendance records</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label"><Calendar size={11} style={{ display: 'inline' }} /> Approved Leave Days</div>
          <div className="kpi-value">{approvedDays}</div>
          <div className="kpi-sub">{pendingLeave} pending approval</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Departments</div>
          <div className="kpi-value">{depts.length}</div>
          <div className="kpi-sub">Across all employees</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="charts-row">
        <div className="chart-card">
          <h3>Headcount by Department</h3>
          <div className="chart-sub">Source: Employees</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={deptOverview} margin={{ top: 4, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
              <XAxis dataKey="dept" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="headcount" radius={[4, 4, 0, 0]}>
                {deptOverview.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Attendance Overview</h3>
          <div className="chart-sub">Source: Attendance records</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
            {attBreakdown.map(item => (
              <div key={item.label} style={{ padding: '14px', background: 'var(--gray-50)', borderRadius: 8 }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: item.color }}>{item.value}</div>
                <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{item.label}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, fontSize: 12, color: 'var(--gray-500)', lineHeight: 1.8 }}>
            Missing check-outs: <strong>{missingCO}</strong><br />
            Attendance coverage: <strong>{attHealth}%</strong>
          </div>
        </div>
      </div>

      {/* Time Off + Alerts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="chart-card">
          <h3>Time Off Overview</h3>
          <div className="chart-sub">Source: Leave Requests + Allocations</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Approved Days</th>
                  <th>Pending</th>
                  <th>Remaining Balance</th>
                </tr>
              </thead>
              <tbody>
                {toOverview.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 16 }}>No leave data</td></tr>
                )}
                {toOverview.map(t => (
                  <tr key={t.type}>
                    <td style={{ fontWeight: 500 }}>{t.type}</td>
                    <td>{t.approved}</td>
                    <td>{t.pending}</td>
                    <td style={{ color: t.remaining > 0 ? 'var(--success)' : 'var(--gray-400)' }}>
                      {t.remaining > 0 ? `${t.remaining.toFixed(1)} days` : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="chart-card">
          <h3>Alerts</h3>
          <div className="chart-sub">Action items requiring attention</div>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {missingCO > 0 && (
              <div className="alert alert-warning">
                <AlertTriangle size={13} /> {missingCO} employee{missingCO !== 1 ? 's' : ''} missing check-out today
              </div>
            )}
            {pendingLeave > 0 && (
              <div className="alert alert-warning">
                <AlertTriangle size={13} /> {pendingLeave} leave request{pendingLeave !== 1 ? 's' : ''} pending approval
              </div>
            )}
            {allocations.filter(a => a.status === 'draft').length > 0 && (
              <div className="alert alert-warning">
                <AlertTriangle size={13} /> {allocations.filter(a => a.status === 'draft').length} allocation{allocations.filter(a => a.status === 'draft').length !== 1 ? 's' : ''} pending approval
              </div>
            )}
            {missingCO === 0 && pendingLeave === 0 && (
              <div style={{ fontSize: 13, color: 'var(--gray-400)', padding: '12px 0', textAlign: 'center' }}>
                No alerts — everything looks good.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
