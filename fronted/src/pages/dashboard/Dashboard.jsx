import { useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { AlertTriangle, Users, Clock, Calendar, DollarSign, TrendingUp } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { salaryByDept, monthlySalaryTrend } from '../../data/mockData';

const BAR_COLORS = ['#4f46e5','#0891b2','#059669','#d97706','#7c3aed','#be185d'];

const fmt = (n) => n >= 100000
  ? `₹ ${(n / 100000).toFixed(1)}L`
  : `₹ ${n.toLocaleString('en-IN')}`;

export default function Dashboard() {
  const { payslips, payruns, employees, attendanceRecords, timeOffRequests, allocations } = useApp();

  const [period, setPeriod]   = useState('Sep 2026');
  const [dept, setDept]       = useState('All Departments');
  const [empType, setEmpType] = useState('All Types');

  // KPI calculations from real data
  const paidSlips   = payslips.filter(s => s.status === 'Paid');
  const totalNet    = paidSlips.reduce((sum, s) => sum + (s.lines?.find(l => l.code === 'NET')?.amount || 0), 0);
  const avgSalary   = paidSlips.length ? Math.round(totalNet / paidSlips.length) : 0;
  const approvedOff = timeOffRequests.filter(r => r.status === 'Approved').reduce((s, r) => s + r.duration, 0);
  const presentCount = attendanceRecords.filter(a => a.status === 'Present' || a.status === 'Late').length;
  const attHealth    = attendanceRecords.length
    ? Math.round((presentCount / attendanceRecords.length) * 100)
    : 0;

  const pendingSlips = payslips.filter(s => s.status === 'Draft' || s.status === 'Computed').length;
  const missingCO    = attendanceRecords.filter(a => a.checkIn && !a.checkOut).length;
  const manualEdits  = attendanceRecords.filter(a => a.notes?.includes('manual') || a.notes?.includes('corrected')).length;
  const expiringContracts = 3; // mock

  // Time off overview
  const toTypes = [...new Set(timeOffRequests.map(r => r.typeName))];
  const toOverview = toTypes.map(type => {
    const approved = timeOffRequests.filter(r => r.typeName === type && r.status === 'Approved').reduce((s, r) => s + r.duration, 0);
    const pending  = timeOffRequests.filter(r => r.typeName === type && (r.status === 'To Approve' || r.status === 'Draft')).length;
    const alloc    = allocations.filter(a => a.typeName === type && a.status === 'Approved').reduce((s, a) => s + a.remaining, 0);
    return { type, approved, pending, remaining: alloc };
  });

  // Department overview
  const depts = [...new Set(employees.map(e => e.department))];
  const deptOverview = depts.map(d => {
    const count = employees.filter(e => e.department === d).length;
    const salaries = payslips.filter(s => s.status === 'Paid' && employees.find(e => e.name === s.employeeName && e.department === d));
    const total = salaries.reduce((sum, s) => sum + (s.lines?.find(l => l.code === 'NET')?.amount || 0), 0);
    return { dept: d, headcount: count, salary: total };
  });

  // Payslip status split
  const statusCounts = {
    Paid: payslips.filter(s => s.status === 'Paid').length,
    Validated: payslips.filter(s => s.status === 'Validated').length,
    Computed: payslips.filter(s => s.status === 'Computed').length,
    Draft: payslips.filter(s => s.status === 'Draft').length,
  };

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
          <select className="filter-select" value={period} onChange={e => setPeriod(e.target.value)}>
            {['Jan 2026','Feb 2026','Mar 2026','Apr 2026','May 2026','Jun 2026','Jul 2026','Aug 2026','Sep 2026'].map(m => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--gray-600)' }}>
          <span>Department</span>
          <select className="filter-select" value={dept} onChange={e => setDept(e.target.value)}>
            <option>All Departments</option>
            {depts.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--gray-600)' }}>
          <span>Employee Type</span>
          <select className="filter-select" value={empType} onChange={e => setEmpType(e.target.value)}>
            <option>All Types</option><option>Full-time</option><option>Contract</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--gray-600)' }}>
          <span>Company</span>
          <select className="filter-select"><option>OXP Pvt Ltd</option></select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label"><DollarSign size={11} style={{ display:'inline' }} /> Total Net Salary Paid</div>
          <div className="kpi-value">{fmt(totalNet)}</div>
          <div className="kpi-sub up">+8.5% vs previous month</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Payslips Generated</div>
          <div className="kpi-value">{payslips.length}</div>
          <div className="kpi-sub">{paidSlips.length} paid, {pendingSlips} pending</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Avg Salary / Employee</div>
          <div className="kpi-value">{fmt(avgSalary)}</div>
          <div className="kpi-sub">Based on current pay run</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label"><Calendar size={11} style={{ display:'inline' }} /> Approved Time Off Days</div>
          <div className="kpi-value">{approvedOff}</div>
          <div className="kpi-sub">Across selected period</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label"><Clock size={11} style={{ display:'inline' }} /> Attendance Health</div>
          <div className="kpi-value">{attHealth}%</div>
          <div className="kpi-sub">Present / reviewed records</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="charts-row">
        <div className="chart-card">
          <h3>Salary Cost by Department</h3>
          <div className="chart-sub">Source: Payslips + Employee Department</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={salaryByDept} margin={{ top: 4, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
              <XAxis dataKey="dept" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={v => [`₹ ${v.toLocaleString('en-IN')}`, 'Net Salary']} />
              <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                {salaryByDept.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Monthly Net Salary Trend</h3>
          <div className="chart-sub">Source: historical Payslips / Payruns</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={monthlySalaryTrend} margin={{ top: 4, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
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
            {Object.entries(statusCounts).map(([status, count]) => (
              <div key={status} style={{ padding: '10px 14px', background: 'var(--gray-50)', borderRadius: 8 }}>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{count}</div>
                <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{status}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-600)', marginBottom: 8 }}>Current Alerts</div>
          {[
            { msg: '2 employees missing bank account', type: 'warning' },
            { msg: '1 duplicate payslip warning',      type: 'warning' },
            { msg: `${pendingSlips} drafts not yet validated`, type: 'warning' },
            { msg: `${expiringContracts} contracts expiring this month`, type: 'danger' },
          ].map((a, i) => (
            <div key={i} className={`alert alert-${a.type}`}>
              <AlertTriangle size={13} />
              {a.msg}
            </div>
          ))}
        </div>

        <div className="chart-card">
          <h3>Attendance Overview</h3>
          <div className="chart-sub">Source: Attendance</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            {[
              { label: 'Present',  value: attendanceRecords.filter(a => a.status === 'Present').length, color: 'var(--success)' },
              { label: 'Late',     value: attendanceRecords.filter(a => a.status === 'Late').length,    color: 'var(--warning)' },
              { label: 'Absent',   value: attendanceRecords.filter(a => a.status === 'Absent').length,  color: 'var(--danger)' },
              { label: 'Overtime', value: attendanceRecords.filter(a => a.overtime > 0).length,         color: 'var(--primary)' },
            ].map(item => (
              <div key={item.label} style={{ padding: '10px 14px', background: 'var(--gray-50)', borderRadius: 8 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: item.color }}>{item.value}</div>
                <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{item.label}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--gray-500)', lineHeight: 1.7 }}>
            Missing check-outs: <strong>{missingCO}</strong><br />
            Manual attendance edits: <strong>{manualEdits || 7}</strong><br />
            Attendance coverage: <strong>{attHealth}%</strong>
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
                  <th>Remaining Balance</th>
                </tr>
              </thead>
              <tbody>
                {toOverview.map(t => (
                  <tr key={t.type}>
                    <td style={{ fontWeight: 500 }}>{t.type}</td>
                    <td>{t.approved}</td>
                    <td>{t.pending}</td>
                    <td style={{ color: t.remaining > 0 ? 'var(--success)' : 'var(--gray-400)' }}>
                      {t.remaining > 0 ? `${t.remaining} Days` : 'N/A'}
                    </td>
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
                {deptOverview.map(d => (
                  <tr key={d.dept}>
                    <td style={{ fontWeight: 500 }}>{d.dept}</td>
                    <td>{d.headcount}</td>
                    <td style={{ fontWeight: 500 }}>{d.salary > 0 ? fmt(d.salary) : '—'}</td>
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
