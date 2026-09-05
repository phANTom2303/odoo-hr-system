import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, LayoutGrid, List } from 'lucide-react';
import { getEmployees } from '../../api/employees';
import { useAuth } from '../../context/AppContext';

const COLORS = ['#4f46e5','#0891b2','#059669','#d97706','#7c3aed','#be185d','#0f766e','#c2410c'];

const initials = (e) => {
  const words = [e.first_name, e.last_name].filter(Boolean);
  return words.map(w => w[0]).join('').toUpperCase() || 'EM';
};

export default function EmployeeList() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [view, setView]   = useState('kanban');
  const [search, setSearch] = useState('');
  const [dept, setDept]   = useState('');
  const [status, setStatus] = useState('');

  const isEmployeeOnly = currentUser?.role === 'Employee' || currentUser?.role?.name === 'Employee' || currentUser?.role === 'employee';

  const { data, isLoading, isError } = useQuery({
    queryKey: ['employees', { search, dept, status }],
    queryFn: () => getEmployees({ search, department: dept, status }).then(r => r.data),
  });

  // TODO: The backend should filter this automatically for the Employee role.
  const allEmployees = data ?? [];
  const employees = (isEmployeeOnly && currentUser?.employeeId)
    ? allEmployees.filter(e => e.id === currentUser.employeeId)
    : allEmployees;

  const departments = [...new Set(employees.map(e => e.department_name).filter(Boolean))];

  if (isLoading) return <div className="page-header"><p>Loading employees…</p></div>;
  if (isError)   return <div className="page-header"><p style={{ color: 'var(--danger)' }}>Failed to load employees.</p></div>;

  return (
    <div>
      <div className="page-header">
        <h1>Employees</h1>
        <div className="d-flex gap-2">
          <div className="view-toggle">
            <button className={view === 'kanban' ? 'active' : ''} onClick={() => setView('kanban')}><LayoutGrid size={14} /></button>
            <button className={view === 'list'   ? 'active' : ''} onClick={() => setView('list')}><List size={14} /></button>
          </div>
          {!isEmployeeOnly && (
            <button className="btn btn-primary" onClick={() => navigate('/employees/new')}>
              <Plus size={15} /> New
            </button>
          )}
        </div>
      </div>

      <div className="toolbar">
        <div className="search-bar">
          <Search size={14} color="var(--gray-400)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employees…" />
        </div>
        <select className="filter-select" value={dept} onChange={e => setDept(e.target.value)}>
          <option value="">All Departments</option>
          {departments.map(d => <option key={d}>{d}</option>)}
        </select>
        <select className="filter-select" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {view === 'kanban' ? (
        <div className="kanban-grid">
          {employees.map((emp, idx) => (
            <div className="kanban-card" key={emp.id} onClick={() => navigate(`/employees/${emp.id}`)}>
              <div className="kanban-avatar" style={{ background: COLORS[idx % COLORS.length] }}>
                {initials(emp)}
              </div>
              <h3>{emp.first_name} {emp.last_name}</h3>
              <p>{emp.job_position_title} • {emp.department_name}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className={`badge ${emp.employment_status === 'active' ? 'badge-green' : 'badge-gray'}`}>
                  {emp.employment_status === 'active' ? 'Active' : 'Inactive'}
                </span>
                <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>{emp.email}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Work Email</th>
                  <th>Job Position</th>
                  <th>Department</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, idx) => (
                  <tr key={emp.id} onClick={() => navigate(`/employees/${emp.id}`)}>
                    <td>
                      <div className="d-flex gap-2">
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: COLORS[idx % COLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                          {initials(emp)}
                        </div>
                        <span style={{ fontWeight: 500 }}>{emp.first_name} {emp.last_name}</span>
                      </div>
                    </td>
                    <td className="text-muted">{emp.email}</td>
                    <td>{emp.job_position_title}</td>
                    <td>{emp.department_name}</td>
                    <td><span className={`badge ${emp.employment_status === 'active' ? 'badge-green' : 'badge-gray'}`}>{emp.employment_status === 'active' ? 'Active' : 'Inactive'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '10px 20px', fontSize: 12, color: 'var(--gray-400)' }}>
            {employees.length} employee{employees.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
