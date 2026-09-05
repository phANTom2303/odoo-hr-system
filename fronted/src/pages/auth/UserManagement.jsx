import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { roles } from '../../data/mockData';

export default function UserManagement() {
  const { users, setUsers, employees } = useApp();
  const [showModal, setShowModal]   = useState(false);
  const [editing, setEditing]       = useState(null);
  const [search, setSearch]         = useState('');
  const [form, setForm] = useState({ name: '', email: '', employeeId: '', role: 'Employee', status: 'Active' });

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setForm({ name: '', email: '', employeeId: '', role: 'Employee', status: 'Active' });
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (u) => {
    setForm({ name: u.name, email: u.email, employeeId: u.employeeId ?? '', role: u.role, status: u.status });
    setEditing(u.id);
    setShowModal(true);
  };

  const save = () => {
    if (editing) {
      setUsers(prev => prev.map(u => u.id === editing ? { ...u, ...form } : u));
    } else {
      setUsers(prev => [...prev, { id: Date.now(), ...form, employeeId: form.employeeId || null }]);
    }
    setShowModal(false);
  };

  const statusBadge = (s) => s === 'Active' ? 'badge-green' : 'badge-gray';

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-breadcrumb">Admin</div>
          <h1>User Management</h1>
        </div>
        <button className="btn btn-primary" onClick={openNew}><Plus size={15} /> New User</button>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="search-bar">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users, employees or email…" />
          </div>
          <select className="filter-select">
            <option>Role Filter</option>
            {roles.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Employee</th>
                <th>Work Email</th>
                <th>Role</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} onClick={() => openEdit(u)}>
                  <td style={{ fontWeight: 500 }}>{u.name}</td>
                  <td>{u.name}</td>
                  <td className="text-muted">{u.email}</td>
                  <td>{u.role}</td>
                  <td><span className={`badge ${statusBadge(u.status)}`}>{u.status}</span></td>
                  <td><button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); openEdit(u); }}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '12px 20px', fontSize: 12, color: 'var(--gray-400)' }}>
          Select a user to edit access, or create a new user.
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editing ? 'Edit User' : 'Create / Edit User'}</h3>
              <button className="btn-ghost btn" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid cols-1" style={{ gap: 14 }}>
                <div className="form-group">
                  <label>Employee <span className="req">*</span></label>
                  <select className="form-control" value={form.employeeId} onChange={e => {
                    const emp = employees.find(em => em.id === Number(e.target.value));
                    setForm(f => ({ ...f, employeeId: e.target.value, name: emp?.name || f.name }));
                  }}>
                    <option value="">Select employee</option>
                    {employees.map(em => <option key={em.id} value={em.id}>{em.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Work Email <span className="req">*</span></label>
                  <input className="form-control" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="employee@company.com" />
                </div>
                <div className="form-group">
                  <label>Roles <span className="req">*</span></label>
                  <select className="form-control" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                    {roles.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Account Status</label>
                  <select className="form-control" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>{editing ? 'Save Access' : 'Create User'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
