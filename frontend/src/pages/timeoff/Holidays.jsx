import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getHolidays } from '../../api/holidays';
import { useApp } from '../../context/AppContext';

export default function Holidays() {
  const navigate = useNavigate();
  const { currentUser } = useApp();
  const [search, setSearch] = useState('');
  const isHR = ['admin', 'hr_manager', 'hr_payroll_user', 'hr_payroll_manager'].includes(currentUser?.role);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['holidays'],
    queryFn: () => getHolidays().then(r => r.data),
  });

  const holidays = (data ?? []).filter(h =>
    h.name?.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <div className="page-header"><p>Loading holidays…</p></div>;
  if (isError)   return <div className="page-header"><p style={{ color: 'var(--danger)' }}>Failed to load holidays.</p></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-breadcrumb">Time Off ▸ <span>Holidays</span></div>
          <h1>Public Holidays</h1>
        </div>
        {isHR && (
          <button className="btn btn-primary" onClick={() => navigate('/timeoff/holidays/new')}>
            <Plus size={15} /> New
          </button>
        )}
      </div>

      <div className="toolbar">
        <div className="search-bar">
          <Search size={14} color="var(--gray-400)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search holidays…" />
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Date</th>
                <th>Country</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {holidays.map(h => (
                <tr key={h.id} onClick={() => isHR && navigate(`/timeoff/holidays/${h.id}`)}
                  style={{ cursor: isHR ? 'pointer' : 'default' }}>
                  <td style={{ fontWeight: 500 }}>{h.name}</td>
                  <td>{h.date?.slice(0, 10)}</td>
                  <td>{h.country ?? '—'}</td>
                  <td>{h.holiday_type ?? '—'}</td>
                </tr>
              ))}
              {holidays.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 24 }}>No holidays found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 20px', fontSize: 12, color: 'var(--gray-400)' }}>
          {holidays.length} holiday{holidays.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}
