import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, LayoutGrid, List } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const COLORS = ['#4f46e5','#0891b2','#059669','#d97706','#7c3aed','#be185d','#0f766e','#c2410c'];

export default function EmployeeList() {
  const { employees } = useApp();
  const navigate = useNavigate();
  const [view, setView] = useState('kanban');
  const [search, setSearch] = useState('');

  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.department.toLowerCase().includes(search.toLowerCase()) ||
    e.jobTitle.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <h1>Employees</h1>
        <div className="d-flex gap-2">
          <div className="view-toggle">
            <button className={view === 'kanban' ? 'active' : ''} onClick={() => setView('kanban')}><LayoutGrid size={14} /></button>
            <button className={view === 'list'   ? 'active' : ''} onClick={() => setView('list')}><List size={14} /></button>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/employees/new')}>
            <Plus size={15} /> New
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-bar">
          <Search size={14} color="var(--gray-400)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employees…" />
        </div>
        <select className="filter-select">
          <option value="">All Departments</option>
          {[...new Set(employees.map(e => e.department))].map(d => <option key={d}>{d}</option>)}
        </select>
        <select className="filter-select">
          <option value="">All Status</option>
          <option>Active</option>
          <option>Inactive</option>
        </select>
      </div>

      {view === 'kanban' ? (
        <div className="kanban-grid">
          {filtered.map(emp => (
            <div className="kanban-card" key={emp.id} onClick={() => navigate(`/employees/${emp.id}`)}>
              <div className="kanban-avatar" style={{ background: emp.color || COLORS[emp.id % COLORS.length] }}>
                {emp.initials}
              </div>
              <h3>{emp.name}</h3>
              <p>{emp.jobTitle} • {emp.department}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className={`badge ${emp.status === 'Active' ? 'badge-green' : 'badge-gray'}`}>
                  {emp.status}
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
                {filtered.map(emp => (
                  <tr key={emp.id} onClick={() => navigate(`/employees/${emp.id}`)}>
                    <td>
                      <div className="d-flex gap-2">
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: emp.color || COLORS[emp.id % COLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                          {emp.initials}
                        </div>
                        <span style={{ fontWeight: 500 }}>{emp.name}</span>
                      </div>
                    </td>
                    <td className="text-muted">{emp.email}</td>
                    <td>{emp.jobTitle}</td>
                    <td>{emp.department}</td>
                    <td><span className={`badge ${emp.status === 'Active' ? 'badge-green' : 'badge-gray'}`}>{emp.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '10px 20px', fontSize: 12, color: 'var(--gray-400)' }}>
            {filtered.length} employee{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
