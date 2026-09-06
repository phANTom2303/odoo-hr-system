import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getAttendance } from '../../api/attendance';

export default function AttendanceList() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const empFilter = params.get('employee');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['attendance', { empFilter, status }],
    queryFn: () => getAttendance({ employee_id: empFilter || undefined, status: status || undefined }).then(r => r.data),
  });

  const records = data ?? [];

  const filtered = records.filter(a =>
    a.employee_name?.toLowerCase().includes(search.toLowerCase())
  );

  const statusBadge = (s) => {
    if (s === 'present')  return 'badge-green';
    if (s === 'absent')   return 'badge-red';
    if (s === 'on_leave') return 'badge-yellow';
    if (s === 'holiday')  return 'badge-blue';
    return 'badge-gray';
  };

  if (isLoading) return <div className="page-header"><p>Loading attendance…</p></div>;
  if (isError)   return <div className="page-header"><p style={{ color: 'var(--danger)' }}>Failed to load attendance.</p></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-breadcrumb">HR ▸ <span>Attendance</span></div>
          <h1>Attendance</h1>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/attendance/new')}>
          <Plus size={15} /> New
        </button>
      </div>

      <div className="toolbar">
        <div className="search-bar">
          <Search size={14} color="var(--gray-400)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employee…" />
        </div>
        <select className="filter-select" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="present">Present</option>
          <option value="absent">Absent</option>
          <option value="on_leave">On Leave</option>
          <option value="holiday">Holiday</option>
        </select>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Date</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Worked Hours</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id} onClick={() => navigate(`/attendance/${a.id}`)}>
                  <td style={{ fontWeight: 500 }}>{a.employee_name}</td>
                  <td>{a.date?.slice(0, 10)}</td>
                  <td>{a.check_in ? new Date(a.check_in).toLocaleTimeString() : '—'}</td>
                  <td>{a.check_out ? new Date(a.check_out).toLocaleTimeString() : '—'}</td>
                  <td>{a.worked_hours != null ? Number(a.worked_hours).toFixed(2) : '0.00'}</td>
                  <td><span className={`badge ${statusBadge(a.status)}`}>{a.status}</span></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 24 }}>No records found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 20px', fontSize: 12, color: 'var(--gray-400)' }}>
          {filtered.length} record{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}
