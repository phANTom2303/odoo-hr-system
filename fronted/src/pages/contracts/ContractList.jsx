import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function ContractList() {
  const { contracts } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const empFilter = params.get('employee');
  const [search, setSearch] = useState('');

  const filtered = contracts.filter(c => {
    const matchEmp = empFilter ? c.employeeId === Number(empFilter) : true;
    const matchSearch = c.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      c.ref.toLowerCase().includes(search.toLowerCase());
    return matchEmp && matchSearch;
  });

  const statusBadge = (s) => {
    if (s === 'Running') return 'badge-green';
    if (s === 'Expired') return 'badge-gray';
    return 'badge-yellow';
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-breadcrumb">Employees ▸ <span>Contracts</span></div>
          <h1>Contracts</h1>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/contracts/new')}>
          <Plus size={15} /> New
        </button>
      </div>

      <div className="toolbar">
        <div className="search-bar">
          <Search size={14} color="var(--gray-400)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contracts…" />
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Contract</th>
                <th>Employee</th>
                <th>Start</th>
                <th>End</th>
                <th>Wage / Month</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} onClick={() => navigate(`/contracts/${c.id}`)}>
                  <td className="font-mono" style={{ fontWeight: 500 }}>{c.ref}</td>
                  <td>{c.employeeName}</td>
                  <td>{c.startDate}</td>
                  <td>{c.endDate || '—'}</td>
                  <td>₹ {c.wage.toLocaleString('en-IN')}</td>
                  <td><span className={`badge ${statusBadge(c.status)}`}>{c.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 20px', fontSize: 12, color: 'var(--gray-400)' }}>
          Retain contract history, but the active Running contract is used for payroll.
        </div>
      </div>
    </div>
  );
}
