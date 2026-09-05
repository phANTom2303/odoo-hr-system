import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function Allocations() {
  const { allocations, approveAllocation } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const empFilter = params.get('employee');
  const [search, setSearch] = useState('');

  const filtered = allocations.filter(a => {
    const matchEmp = empFilter ? a.employeeId === Number(empFilter) : true;
    const matchSearch = a.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      a.typeName.toLowerCase().includes(search.toLowerCase());
    return matchEmp && matchSearch;
  });

  const statusBadge = (s) => {
    if (s === 'Approved')   return 'badge-green';
    if (s === 'To Approve') return 'badge-yellow';
    if (s === 'Refused')    return 'badge-red';
    return 'badge-gray';
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-breadcrumb">Time Off ▸ <span>Allocations</span></div>
          <h1>Allocations</h1>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/timeoff/allocations/new')}>
          <Plus size={15} /> New
        </button>
      </div>

      <div className="toolbar">
        <div className="search-bar">
          <Search size={14} color="var(--gray-400)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search allocations…" />
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th>Allocated</th>
                <th>Taken</th>
                <th>Remaining</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 500 }} onClick={() => navigate(`/timeoff/allocations/${a.id}`)}>{a.employeeName}</td>
                  <td onClick={() => navigate(`/timeoff/allocations/${a.id}`)}>{a.typeName}</td>
                  <td onClick={() => navigate(`/timeoff/allocations/${a.id}`)}>{a.allocated} days</td>
                  <td onClick={() => navigate(`/timeoff/allocations/${a.id}`)}>{a.taken} days</td>
                  <td onClick={() => navigate(`/timeoff/allocations/${a.id}`)} style={{ fontWeight: 600, color: a.remaining > 5 ? 'var(--success)' : 'var(--warning)' }}>
                    {a.remaining} days
                  </td>
                  <td><span className={`badge ${statusBadge(a.status)}`}>{a.status}</span></td>
                  <td>
                    {a.status === 'To Approve' && (
                      <button className="btn btn-success btn-sm" onClick={() => approveAllocation(a.id)}>
                        <Check size={12} /> Approve
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 20px', fontSize: 12, color: 'var(--gray-400)' }}>
          Approved allocation creates available leave balance for the employee.
        </div>
      </div>
    </div>
  );
}
