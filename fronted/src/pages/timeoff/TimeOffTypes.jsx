import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { getTimeOffTypes } from '../../api/timeOffTypes';

export default function TimeOffTypes() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['time-off-types'],
    queryFn: () => getTimeOffTypes().then(r => r.data),
  });

  const types = (data ?? []).filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  if (isLoading) return <div className="page-header"><p>Loading…</p></div>;
  if (isError)   return <div className="page-header"><p style={{ color: 'var(--danger)' }}>Failed to load time off types.</p></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-breadcrumb">Time Off ▸ <span>Time Off Types</span></div>
          <h1>Time Off Types</h1>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/timeoff/types/new')}>
          <Plus size={15} /> New
        </button>
      </div>

      <div className="toolbar">
        <div className="search-bar">
          <Search size={14} color="var(--gray-400)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search time off types…" />
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Type</th><th>Unit</th><th>Requires Allocation</th><th>Approval</th><th>Paid</th><th>Status</th></tr>
            </thead>
            <tbody>
              {types.map(t => (
                <tr key={t.id} onClick={() => navigate(`/timeoff/types/${t.id}`)}>
                  <td style={{ fontWeight: 500 }}>{t.name}</td>
                  <td>{t.unit}</td>
                  <td>{t.requires_allocation ? 'Yes' : 'No'}</td>
                  <td>{t.leave_validation}</td>
                  <td>{t.is_paid ? 'Yes' : 'No'}</td>
                  <td><span className={`badge ${t.is_active ? 'badge-green' : 'badge-gray'}`}>{t.is_active ? 'Active' : 'Inactive'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
