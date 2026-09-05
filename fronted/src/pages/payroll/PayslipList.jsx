import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useApp, useAuth } from '../../context/AppContext';

export default function PayslipList() {
  const { payslips } = useApp();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const isEmployeeOnly = currentUser?.role === 'Employee' || currentUser?.role?.name === 'Employee' || currentUser?.role === 'employee';
  
  // TODO: Backend should enforce this filtering.
  const allowedPayslips = (isEmployeeOnly && currentUser?.employeeId)
    ? payslips.filter(p => p.employeeId === currentUser.employeeId)
    : payslips;

  const filtered = allowedPayslips.filter(s =>
    s.employeeName.toLowerCase().includes(search.toLowerCase()) ||
    s.period.toLowerCase().includes(search.toLowerCase()) ||
    s.payrunName.toLowerCase().includes(search.toLowerCase())
  );

  const statusBadge = (s) => {
    if (s === 'Paid')      return 'badge-green';
    if (s === 'Validated') return 'badge-blue';
    if (s === 'Computed')  return 'badge-yellow';
    return 'badge-gray';
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-breadcrumb">Payroll ▸ <span>Payslips</span></div>
          <h1>Payslips</h1>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-bar">
          <Search size={14} color="var(--gray-400)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search payslips…" />
        </div>
        <select className="filter-select">
          <option>All Periods</option>
          {[...new Set(payslips.map(s => s.period))].map(p => <option key={p}>{p}</option>)}
        </select>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Structure</th>
                <th>Pay Run</th>
                <th>Period</th>
                <th>Worked Days</th>
                <th>Net Salary</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const net = s.lines?.find(l => l.code === 'NET')?.amount || 0;
                return (
                  <tr key={s.id} onClick={() => navigate(`/payroll/payslips/${s.id}`)}>
                    <td style={{ fontWeight: 500 }}>{s.employeeName}</td>
                    <td>{s.structure}</td>
                    <td className="font-mono">{s.payrunName}</td>
                    <td>{s.period}</td>
                    <td>{s.workedDays}</td>
                    <td style={{ fontWeight: 600 }}>₹ {net.toLocaleString('en-IN')}</td>
                    <td><span className={`badge ${statusBadge(s.status)}`}>{s.status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
