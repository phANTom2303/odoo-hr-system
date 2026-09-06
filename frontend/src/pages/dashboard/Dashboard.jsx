import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { AlertTriangle, Clock, Calendar, DollarSign } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getDashboardSummary } from '../../api/dashboard';
import { getDepartments } from '../../api/departments';

const BAR_COLORS = ['#4f46e5','#0891b2','#059669','#d97706','#7c3aed','#be185d'];

const EMPLOYEE_TYPES = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract',  label: 'Contract' },
  { value: 'intern',    label: 'Intern' },
];

const fmt = (n) => n >= 100000
  ? `₹ ${(n / 100000).toFixed(1)}L`
  : `₹ ${n.toLocaleString('en-IN')}`;

const fmtPct = (v) => (v == null ? null : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`);

/** Trailing 12 months ending at the current real month, oldest first. */
function getPeriodOptions() {
  const now = new Date();
  const opts = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    opts.push({ value, label });
  }
  return opts;
}

/** Human label for a 'YYYY-MM' period, e.g. 'Aug 2026'. */
function periodLabel(value) {
  const [year, month] = value.split('-').map(Number);
  return new Date(year, month - 1, 1)
    .toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

const PERIOD_OPTIONS = getPeriodOptions();

export default function Dashboard() {
  const navigate = useNavigate();

  // '' means "let the server choose". It answers with the most recent month
  // that actually has a pay run, so the dashboard doesn't open on a month whose
  // payroll hasn't been run yet and read 0 across every payslip-backed section.
  const [period, setPeriod]           = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [employeeType, setEmployeeType] = useState('');

  const { data: depts } = useQuery({
    queryKey: ['departments'],
    queryFn: () => getDepartments().then(r => r.data),
  });
  const departments = depts ?? [];

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['dashboard-summary', { period, departmentId, employeeType }],
    queryFn: () => getDashboardSummary({
      period: period || undefined,
      department_id: departmentId || undefined,
      employee_type: employeeType || undefined,
    }).then(r => r.data),
  });

  if (isLoading) return <div className="page-header"><p>Loading dashboard…</p></div>;
  if (isError)   return <div className="page-header"><p style={{ color: 'var(--danger)' }}>Failed to load dashboard{error?.message ? `: ${error.message}` : '.'}</p></div>;

  // Until the user picks a period explicitly, the select mirrors whichever
  // month the server resolved to.
  const activePeriod = period || data.period;
  const payrollPeriods = data.payrollPeriods ?? [];
  const hasPayroll = data.hasPayroll !== false;

  // Keep the resolved period selectable even if it predates the trailing-12 window.
  const periodOptions = PERIOD_OPTIONS.some(o => o.value === activePeriod)
    ? PERIOD_OPTIONS
    : [{ value: activePeriod, label: periodLabel(activePeriod) }, ...PERIOD_OPTIONS];

  const kpis = data.kpis;
  const salaryByDepartment = data.salaryByDepartment ?? [];
  const monthlySalaryTrend = data.monthlySalaryTrend ?? [];
  const payslipStatusCounts = data.payslipStatusCounts ?? {};
  const alerts = data.alerts ?? {};
  const attendanceOverview = data.attendanceOverview ?? {};
  const timeOffOverview = data.timeOffOverview ?? [];
  const departmentOverview = data.departmentOverview ?? [];

  const changePct = fmtPct(kpis.totalNetSalaryChangePct);

  const alertList = [
    alerts.missingBankAccounts > 0 && {
      type: 'danger',
      msg: `${alerts.missingBankAccounts} employees missing bank account`,
      onClick: () => navigate('/employees'),
    },
    alerts.duplicatePayslipWarnings > 0 && {
      type: 'danger',
      msg: `${alerts.duplicatePayslipWarnings} duplicate payslip warning${alerts.duplicatePayslipWarnings === 1 ? '' : 's'}`,
      onClick: () => navigate('/payroll/payslips'),
    },
    alerts.draftsNotValidated > 0 && {
      type: 'warning',
      msg: `${alerts.draftsNotValidated} drafts still not validated`,
      onClick: () => navigate('/payroll/payslips?status=draft'),
    },
    alerts.contractsExpiringSoon > 0 && {
      type: 'warning',
      msg: `${alerts.contractsExpiringSoon} contracts expiring this month`,
      onClick: () => navigate('/contracts'),
    },
  ].filter(Boolean);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-breadcrumb">HR ▸ <span>Payroll Dashboard</span></div>
          <h1>Payroll Dashboard</h1>
          <p style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: 2 }}>
            Payments, staffing impact, leave patterns, and attendance quality for the selected period.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-row" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--gray-600)' }}>
          <span>Period</span>
          <select className="filter-select" value={activePeriod} onChange={e => setPeriod(e.target.value)}>
            {periodOptions.map(o => (
              <option key={o.value} value={o.value}>
                {payrollPeriods.includes(o.value) ? o.label : `${o.label} — no payroll`}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--gray-600)' }}>
          <span>Department</span>
          <select className="filter-select" value={departmentId} onChange={e => setDepartmentId(e.target.value)}>
            <option value="">All Departments</option>
            {departments.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--gray-600)' }}>
          <span>Employee Type</span>
          <select className="filter-select" value={employeeType} onChange={e => setEmployeeType(e.target.value)}>
            <option value="">All Types</option>
            {EMPLOYEE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--gray-600)' }}>
          <span>Company</span>
          <select className="filter-select"><option>OXP Pvt Ltd</option></select>
        </div>
      </div>

      {!hasPayroll && (
        <div className="alert alert-warning" style={{ marginBottom: 16 }}>
          <AlertTriangle size={13} />
          No pay run covers {periodLabel(activePeriod)}, so all payroll figures below read zero.
          Attendance and time-off figures are unaffected.
        </div>
      )}

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/payroll/payslips?status=paid')}>
          <div className="kpi-label"><DollarSign size={11} style={{ display:'inline' }} /> Total Net Salary Paid</div>
          <div className="kpi-value">{fmt(kpis.totalNetSalary ?? 0)}</div>
          <div className={`kpi-sub ${changePct == null ? '' : kpis.totalNetSalaryChangePct >= 0 ? 'up' : 'down'}`}>
            {changePct == null ? '—' : `${changePct} vs previous month`}
          </div>
        </div>
        <div className="kpi-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/payroll/payslips')}>
          <div className="kpi-label">Payslips Generated</div>
          <div className="kpi-value">{kpis.payslipsGenerated ?? 0}</div>
          <div className="kpi-sub">{kpis.payslipsPaid ?? 0} paid, {kpis.payslipsPending ?? 0} pending</div>
        </div>
        <div className="kpi-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/payroll/payslips?status=paid')}>
          <div className="kpi-label">Avg Salary / Employee</div>
          <div className="kpi-value">{fmt(kpis.avgSalaryPerEmployee ?? 0)}</div>
          <div className="kpi-sub">Based on current pay run</div>
        </div>
        <div className="kpi-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/timeoff/requests?status=approved')}>
          <div className="kpi-label"><Calendar size={11} style={{ display:'inline' }} /> Approved Time Off Days</div>
          <div className="kpi-value">{kpis.approvedTimeOffDays ?? 0}</div>
          <div className="kpi-sub">Across selected period</div>
        </div>
        <div className="kpi-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/attendance')}>
          <div className="kpi-label"><Clock size={11} style={{ display:'inline' }} /> Attendance Health</div>
          <div className="kpi-value">{kpis.attendanceHealthPct ?? 0}%</div>
          <div className="kpi-sub">Present / reviewed records</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="charts-row">
        <div className="chart-card">
          <h3>Salary Cost by Department</h3>
          <div className="chart-sub">Source: Payslips + Employee Department</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={salaryByDepartment}
              margin={{ top: 4, right: 10, left: 10, bottom: 0 }}
              onClick={(state) => {
                const label = state?.activeLabel;
                if (label) navigate(`/employees?department=${encodeURIComponent(label)}`);
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
              <XAxis dataKey="department" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={v => [`₹ ${v.toLocaleString('en-IN')}`, 'Net Salary']} />
              <Bar
                dataKey="amount"
                radius={[4, 4, 0, 0]}
                style={{ cursor: 'pointer' }}
                onClick={(entry) => {
                  if (entry?.department) navigate(`/employees?department=${encodeURIComponent(entry.department)}`);
                }}
              >
                {salaryByDepartment.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Monthly Net Salary Trend</h3>
          <div className="chart-sub">Source: historical Payslips / Payruns</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={monthlySalaryTrend}
              margin={{ top: 4, right: 10, left: 10, bottom: 0 }}
              style={{ cursor: 'pointer' }}
              onClick={() => navigate('/payroll/runs')}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
              <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/100000).toFixed(1)}L`} />
              <Tooltip formatter={v => [fmt(v), 'Net Salary']} />
              <Line type="monotone" dataKey="amount" stroke="var(--primary)" strokeWidth={2} dot={{ r: 4, fill: 'var(--primary)' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Alerts + Payslip Status */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="chart-card">
          <h3>Payslip Status & Payroll Alerts</h3>
          <div className="chart-sub">Source: Pay Run + Payslip validation</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            {Object.entries(payslipStatusCounts).map(([status, count]) => (
              <div
                key={status}
                style={{ padding: '10px 14px', background: 'var(--gray-50)', borderRadius: 8, cursor: 'pointer' }}
                onClick={() => navigate(`/payroll/payslips?status=${status}`)}
              >
                <div style={{ fontSize: 20, fontWeight: 700 }}>{count}</div>
                <div style={{ fontSize: 12, color: 'var(--gray-500)', textTransform: 'capitalize' }}>{status}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-600)', marginBottom: 8 }}>Current Alerts</div>
          {alertList.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>No active alerts</div>
          ) : (
            alertList.map((a, i) => (
              <div key={i} className={`alert alert-${a.type}`} style={{ cursor: 'pointer' }} onClick={a.onClick}>
                <AlertTriangle size={13} />
                {a.msg}
              </div>
            ))
          )}
        </div>

        <div className="chart-card">
          <h3>Attendance Overview</h3>
          <div className="chart-sub">Source: Attendance</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            {[
              { label: 'Present',  value: attendanceOverview.present ?? 0,  color: 'var(--success)', onClick: () => navigate('/attendance?status=present') },
              { label: 'Late',     value: attendanceOverview.late ?? 0,     color: 'var(--warning)', onClick: () => navigate('/attendance') },
              { label: 'Absent',   value: attendanceOverview.absent ?? 0,   color: 'var(--danger)',  onClick: () => navigate('/attendance?status=absent') },
              { label: 'On Leave', value: attendanceOverview.onLeave ?? 0,  color: 'var(--primary)', onClick: () => navigate('/attendance?status=on_leave') },
            ].map(item => (
              <div
                key={item.label}
                style={{ padding: '10px 14px', background: 'var(--gray-50)', borderRadius: 8, cursor: 'pointer' }}
                onClick={item.onClick}
              >
                <div style={{ fontSize: 22, fontWeight: 700, color: item.color }}>{item.value}</div>
                <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{item.label}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--gray-500)', lineHeight: 1.7 }}>
            Missing check-outs: <strong>{attendanceOverview.missingCheckouts ?? 0}</strong><br />
            Manual attendance edits: <strong>{attendanceOverview.manualEdits ?? 0}</strong><br />
            Attendance coverage: <strong>{attendanceOverview.coveragePct ?? 0}%</strong>
          </div>
        </div>
      </div>

      {/* Time Off Overview + Department Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="chart-card">
          <h3>Time Off Overview</h3>
          <div className="chart-sub">Source: Time Off Requests + Allocations</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Approved Days</th>
                  <th>Pending</th>
                </tr>
              </thead>
              <tbody>
                {timeOffOverview.map(t => (
                  <tr
                    key={t.typeId}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/timeoff/requests?time_off_type_id=${t.typeId}`)}
                  >
                    <td style={{ fontWeight: 500 }}>{t.type}</td>
                    <td>{t.approvedDays}</td>
                    <td>{t.pending}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="chart-card">
          <h3>Department Overview</h3>
          <div className="chart-sub">Source: Employee + Contract + Payslip totals</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Headcount</th>
                  <th>Monthly Salary</th>
                </tr>
              </thead>
              <tbody>
                {departmentOverview.map(d => (
                  <tr
                    key={d.departmentId}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/employees?department=${encodeURIComponent(d.department)}`)}
                  >
                    <td style={{ fontWeight: 500 }}>{d.department}</td>
                    <td>{d.headcount}</td>
                    <td style={{ fontWeight: 500 }}>{d.monthlySalary > 0 ? fmt(d.monthlySalary) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Models to Aggregate note */}
      <div className="card" style={{ background: 'var(--primary-light)', border: '1px solid #c7d2fe' }}>
        <div className="card-body" style={{ fontSize: 12, color: 'var(--primary-dark)' }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Models Aggregated on this Dashboard</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            <div>• Employees / Departments → headcount, ownership, grouping</div>
            <div>• Contracts → wage, schedule, active employees</div>
            <div>• Payruns / Payslips → salary totals, paid vs pending, trend</div>
            <div>• Attendance → presence, absences, late entries, overtime</div>
            <div>• Time Off Requests / Allocations → leave taken and balances</div>
          </div>
        </div>
      </div>
    </div>
  );
}
