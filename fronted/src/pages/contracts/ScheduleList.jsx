import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { getSchedules } from '../../api/schedules';
import { useAuth, useApp } from '../../context/AppContext';

export default function ScheduleList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const { currentUser } = useAuth();
  const { employees } = useApp();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['schedules'],
    queryFn: () => getSchedules().then(r => r.data),
  });

  const isEmployeeOnly = currentUser?.role === 'Employee' || currentUser?.role?.name === 'Employee';

  // TODO: The backend should ideally filter schedules for the Employee role.
  // We do frontend filtering here to prevent access to data of other employees.
  let allowedSchedules = data ?? [];
  if (isEmployeeOnly && currentUser?.employeeId) {
    const empRecord = employees.find(e => e.id === currentUser.employeeId);
    if (empRecord?.schedule) {
      allowedSchedules = allowedSchedules.filter(s => s.name === empRecord.schedule);
    }
  }

  const schedules = allowedSchedules.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <div className="page-header"><p>Loading schedules…</p></div>;
  if (isError)   return <div className="page-header"><p style={{ color: 'var(--danger)' }}>Failed to load schedules.</p></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-breadcrumb">Employees ▸ <span>Working Schedules</span></div>
          <h1>Working Schedules</h1>
        </div>
        {!isEmployeeOnly && (
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
                <th>Hours / Week</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map(s => (
                <tr key={s.id} onClick={() => navigate(`/schedules/${s.id}`)}>
                  <td style={{ fontWeight: 500 }}>{s.name}</td>
                  <td>{s.lines?.length ?? 0}</td>
                  <td>{s.total_weekly_hours}h</td>
                  <td><span className={`badge ${s.is_active ? 'badge-green' : 'badge-gray'}`}>{s.is_active ? 'Active' : 'Inactive'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
