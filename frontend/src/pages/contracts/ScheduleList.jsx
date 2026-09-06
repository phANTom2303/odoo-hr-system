import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { getSchedules } from '../../api/schedules';
import { useApp } from '../../context/AppContext';

export default function ScheduleList() {
  const navigate = useNavigate();
  const { currentUser } = useApp();
  const [search, setSearch] = useState('');

  const isHR = ['admin', 'hr_manager', 'hr_payroll_user', 'hr_payroll_manager'].includes(currentUser?.role);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['schedules'],
    queryFn: () => getSchedules().then(r => r.data),
  });

  const schedules = (data ?? []).filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <div className="page-header"><p>Loading schedules…</p></div>;
  if (isError)   return <div className="page-header"><p style={{ color: 'var(--danger)' }}>Failed to load schedules.</p></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-breadcrumb">{isHR ? 'Employees ▸' : 'My Work ▸'} <span>Working Schedules</span></div>
          <h1>Working Schedules</h1>
        </div>
        {isHR && (
          <button className="btn btn-primary" onClick={() => navigate('/schedules/new')}>
            <Plus size={15} /> New Schedule
          </button>
        )}
      </div>

      <div className="toolbar">
        <div className="search-bar">
          <Search size={14} color="var(--gray-400)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search schedules…" />
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Schedule Name</th>
                <th>Days / Week</th>
                <th>Total Hours</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map(s => (
                <tr key={s.id} onClick={() => navigate(`/schedules/${s.id}`)} style={{ cursor: 'pointer' }}>
                  <td style={{ fontWeight: 500 }}>{s.name}</td>
                  <td>{s.lines?.length ?? 0}</td>
                  <td>{s.total_weekly_hours ? `${s.total_weekly_hours}h` : '—'}</td>
                  <td><span className={`badge ${s.is_active ? 'badge-green' : 'badge-gray'}`}>{s.is_active ? 'Active' : 'Inactive'}</span></td>
                </tr>
              ))}
              {schedules.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 24 }}>No schedules found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
