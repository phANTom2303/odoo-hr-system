import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function ScheduleList() {
  const { schedules } = useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const filtered = schedules.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-breadcrumb">Employees ▸ <span>Working Schedules</span></div>
          <h1>Working Schedules</h1>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/schedules/new')}>
          <Plus size={15} /> New Schedule
        </button>
      </div>

      <div className="toolbar">
        <div className="search-bar">
          <Search size={14} color="var(--gray-400)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search schedules…" />
        </div>
        <button className="btn btn-secondary btn-sm">Filter</button>
        <button className="btn btn-secondary btn-sm">Columns</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Schedule Name</th>
                <th>Days / Week</th>
                <th>Hours / Week</th>
                <th>Company</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} onClick={() => navigate(`/schedules/${s.id}`)}>
                  <td style={{ fontWeight: 500 }}>{s.name}</td>
                  <td>{s.daysPerWeek}</td>
                  <td>{s.hoursPerWeek}</td>
                  <td>{s.company}</td>
                  <td><span className={`badge ${s.status === 'Active' ? 'badge-green' : 'badge-gray'}`}>{s.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
