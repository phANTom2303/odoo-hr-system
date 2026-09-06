import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getContracts } from '../../api/contracts';
import { useApp } from '../../context/AppContext';

export default function ContractList() {
  const navigate = useNavigate();
  const { currentUser } = useApp();
  const [params] = useSearchParams();
  const empFilter = params.get('employee');
  const [search, setSearch] = useState('');

  const isHR = ['admin', 'hr_manager', 'hr_payroll_user', 'hr_payroll_manager'].includes(currentUser?.role);

  // Backend already scopes to currentUser for employees — just pass HR's empFilter
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['contracts', { empFilter }],
    queryFn: () => getContracts(isHR && empFilter ? { employee_id: empFilter } : {}),
  });

  const allContracts = data?.data ?? [];
  const filtered = allContracts.filter(c =>
    !search ||
    c.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
    String(c.id).includes(search)
  );

  const statusBadge = (s) => {
    if (s === 'active')    return 'badge-green';
    if (s === 'expired')   return 'badge-gray';
    if (s === 'cancelled') return 'badge-red';
    return 'badge-yellow'; // draft
  };

  if (isLoading) return <div style={{ padding: 20 }}>Loading contracts…</div>;
  if (isError)   return <div style={{ padding: 20, color: 'red' }}>Error: {error.message}</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-breadcrumb">{isHR ? 'Employees ▸' : 'My Work ▸'} <span>Contracts</span></div>
          <h1>{isHR ? 'Contracts' : 'My Contracts'}</h1>
        </div>
        {isHR && (
          <button className="btn btn-primary" onClick={() => navigate('/contracts/new')}>
            <Plus size={15} /> New
          </button>
        )}
      </div>

      {isHR && (
        <div className="toolbar">
          <div className="search-bar">
            <Search size={14} color="var(--gray-400)" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contracts…" />
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {isHR && <th>Employee</th>}
                <th>Contract #</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Wage / Month</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} onClick={() => navigate(`/contracts/${c.id}`)} style={{ cursor: 'pointer' }}>
                  {isHR && <td style={{ fontWeight: 500 }}>{c.employee_name}</td>}
                  <td className="font-mono">#{c.id}</td>
                  <td>{c.start_date?.slice(0, 10)}</td>
                  <td>{c.end_date?.slice(0, 10) || '—'}</td>
                  <td>{c.wage ? `₹ ${Number(c.wage).toLocaleString('en-IN')}` : '—'}</td>
                  <td><span className={`badge ${statusBadge(c.status)}`}>{c.status}</span></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={isHR ? 6 : 5} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 24 }}>
                    No contracts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 20px', fontSize: 12, color: 'var(--gray-400)' }}>
          {filtered.length} contract{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}
