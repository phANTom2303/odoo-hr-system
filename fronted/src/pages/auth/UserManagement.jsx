import { useState } from 'react';
import { Search } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getEmployees, updateEmployee } from '../../api/employees';

const ROLE_OPTIONS = [
  { value: 'employee',           label: 'Employee' },
  { value: 'hr_manager',         label: 'HR Manager' },
  { value: 'hr_payroll_user',    label: 'HR Payroll User' },
  { value: 'hr_payroll_manager', label: 'HR Payroll Manager' },
  { value: 'admin',              label: 'Admin' },
];

const ROLE_LABELS = Object.fromEntries(ROLE_OPTIONS.map(r => [r.value, r.label]));

export default function UserManagement() {
  const queryClient = useQueryClient();
  const [search, setSearch]     = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [editing, setEditing]   = useState(null); // employee being edited
  const [form, setForm]         = useState({});

  const { data, isLoading, isError } = useQuery({
    queryKey: ['employees'],
    queryFn: () => getEmployees().then(r => r.data),
  });

  const employees = data ?? [];

  const filtered = employees.filter(e => {
    const matchSearch = !search ||
      e.name?.toLowerCase().includes(search.toLowerCase()) ||
      e.email?.toLowerCase().includes(search.toLowerCase());
    const matchRole = !roleFilter || e.role === roleFilter;
    return matchSearch && matchRole;
  });

  const updateMutation = useMutation({
    mutationFn: updateEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setEditing(null);
    },
  });

  const openEdit = (emp) => {
    setEditing(emp.id);
    setForm({ role: emp.role, isActive: emp.is_active });
  };

  const save = () => {
    updateMutation.mutate({ id: editing, role: form.role, is_active: form.isActive });
  };

  const statusBadge = (active) => active ? 'badge-green' : 'badge-gray';

  if (isLoading) return <div className="page-header"><p>Loading users…</p></div>;
  if (isError)   return <div className="page-header"><p style={{ color: 'var(--danger)' }}>Failed to load users.</p></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-breadcrumb">Admin ▸ <span>Users</span></div>
          <h1>User Management</h1>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-bar">
          <Search size={14} color="var(--gray-400)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or email…" />
        </div>
        <select className="filter-select" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="">All Roles</option>
          {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(emp => (
                <tr key={emp.id}>
                  <td style={{ fontWeight: 500 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="avatar-btn" style={{ width: 28, height: 28, fontSize: 11 }}>{emp.initials}</div>
                      {emp.name}
                    </div>
                  </td>
                  <td style={{ color: 'var(--gray-500)' }}>{emp.email}</td>
                  <td>{ROLE_LABELS[emp.role] ?? emp.role}</td>
                  <td><span className={`badge ${statusBadge(emp.is_active)}`}>{emp.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(emp)}>Edit</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 24 }}>No users found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 20px', fontSize: 12, color: 'var(--gray-400)' }}>
          {filtered.length} user{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit User Access</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid cols-1" style={{ gap: 14 }}>
                <div className="form-group">
                  <label>Role</label>
                  <select className="form-control" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                    {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Account Status</label>
                  <select className="form-control" value={form.isActive ? 'active' : 'inactive'}
                    onChange={e => setForm(f => ({ ...f, isActive: e.target.value === 'active' }))}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              {updateMutation.error && (
                <div className="alert alert-danger" style={{ marginTop: 10 }}>{updateMutation.error.message}</div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
