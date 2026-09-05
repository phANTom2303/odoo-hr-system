import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useApp, useAuth } from '../../context/AppContext';

export default function AttendanceList() {
  const { attendanceRecords } = useApp();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const empFilter = params.get('employee');
  const [search, setSearch] = useState('');

  const isEmployeeOnly = currentUser?.role === 'Employee' || currentUser?.role?.name === 'Employee';

  // TODO: When API is connected, the backend should filter attendance records for the Employee role.
  const allowedRecords = isEmployeeOnly && currentUser?.employeeId 
    ? attendanceRecords.filter(a => a.employeeId === currentUser.employeeId)
    : attendanceRecords;

  const filtered = allowedRecords.filter(a => {
    const matchEmp = empFilter ? a.employeeId === Number(empFilter) : true;
    const matchSearch = a.employeeName.toLowerCase().includes(search.toLowerCase());
    return matchEmp && matchSearch;
  });

  const statusBadge = (s) => {
    if (s === 'Present') return 'badge-green';
    if (s === 'Absent')  return 'badge-red';
    if (s === 'Late')    return 'badge-yellow';
    return 'badge-gray';
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-breadcrumb">HR ▸ <span>Attendance</span></div>
          <h1>{empFilter ? `Attendance` : 'Attendance'}</h1>
        </div>
        {!isEmployeeOnly && (
          <button className="btn btn-primary" onClick={() => navigate('/attendance/new')}>
            <Plus size={15} /> New
          </button>
        )}
      </div>

      <div className="toolbar">
        <div className="search-bar">
          <Search size={14} color="var(--gray-400)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search attendance…" />
        </div>
        <select className="filter-select">
          <option>Today</option>
          <option>This Week</option>
          <option>This Month</option>
        </select>
        {!empFilter && (
          <select className="filter-select">
            <option value="">All Employees</option>
          </select>
        )}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Worked Hours</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id} onClick={() => navigate(`/attendance/${a.id}`)}>
                  <td style={{ fontWeight: 500 }}>{a.employeeName}</td>
                  <td>{a.checkIn || '—'}</td>
                  <td>{a.checkOut || '—'}</td>
                  <td>{a.workedHours > 0 ? a.workedHours.toFixed(2) : '0.00'}</td>
                  <td><span className={`badge ${statusBadge(a.status)}`}>{a.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 20px', fontSize: 12, color: 'var(--gray-400)' }}>
          List view shows raw check-in / check-out data. Missing punches are highlighted.
        </div>
      </div>
    </div>
  );
}
