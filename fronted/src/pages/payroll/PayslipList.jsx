import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getPayslips, n } from '../../api/payroll';

const STATUS_OPTIONS = ['computed', 'validated', 'paid'];

export default function PayslipList() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const payRunId = params.get('pay_run_id');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['payslips', { payRunId, status }],
    queryFn: () =>
      getPayslips({
        ...(payRunId ? { pay_run_id: payRunId } : {}),
        ...(status ? { status } : {}),
      }).then(r => r.data),
  });

  const payslips = data ?? [];

  const searchTerm = search.toLowerCase();
  const filtered = payslips.filter(s => {
    if (searchTerm.length >= 1) {
      return (
        s.employee_name?.toLowerCase().includes(searchTerm) ||
        s.pay_run_name?.toLowerCase().includes(searchTerm)
      );
    }
    return true;
  });

  const statusBadge = (s) => {
    if (s === 'paid') return 'badge-green';
    if (s === 'validated') return 'badge-blue';
    if (s === 'computed') return 'badge-yellow';
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
        <select className="filter-select" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="card-body"><p>Loading…</p></div>
        ) : isError ? (
          <div className="card-body"><p style={{ color: 'var(--danger)' }}>Failed to load payslips: {error.message}</p></div>
        ) : (
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
                {filtered.map(s => (
                  <tr key={s.id} onClick={() => navigate(`/payroll/payslips/${s.id}`)}>
                    <td style={{ fontWeight: 500 }}>{s.employee_name}</td>
                    <td>{s.structure_name}</td>
                    <td className="font-mono">{s.pay_run_name}</td>
                    <td>{s.start_date} – {s.end_date}</td>
                    <td>{n(s.worked_days)}</td>
                    <td style={{ fontWeight: 600 }}>₹ {n(s.net_salary).toLocaleString('en-IN')}</td>
                    <td><span className={`badge ${statusBadge(s.status)}`}>{s.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
