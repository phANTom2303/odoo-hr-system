import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileText, Clock, Calendar, Gift } from 'lucide-react';
import {
  getEmployeeById, createEmployee, updateEmployee, deleteEmployee,
  getEmployeeContracts, getEmployeeAttendance,
  getEmployeeTimeOff, getEmployeeAllocations,
} from '../../api/employees';

const COLORS = ['#4f46e5','#0891b2','#059669','#d97706','#7c3aed','#be185d','#0f766e','#c2410c'];

export default function EmployeeForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = id === 'new';

  const [tab, setTab]       = useState('work');
  const [editing, setEditing] = useState(isNew);

  const { data: emp, isLoading } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => getEmployeeById(id).then(r => r.data),
    enabled: !isNew,
  });

  const { data: empContracts   = [] } = useQuery({ queryKey: ['emp-contracts',   id], queryFn: () => getEmployeeContracts(id).then(r => r.data),   enabled: !isNew });
  const { data: empAttendance  = [] } = useQuery({ queryKey: ['emp-attendance',  id], queryFn: () => getEmployeeAttendance(id).then(r => r.data),  enabled: !isNew });
  const { data: empTimeOff     = [] } = useQuery({ queryKey: ['emp-timeoff',     id], queryFn: () => getEmployeeTimeOff(id).then(r => r.data),     enabled: !isNew });
  const { data: empAllocations = [] } = useQuery({ queryKey: ['emp-allocations', id], queryFn: () => getEmployeeAllocations(id).then(r => r.data), enabled: !isNew });

  const EMPTY = {
    first_name: '', last_name: '', email: '', phone: '', password: '',
    role: 'employee', employment_status: 'active', employee_type: 'full_time',
    department_id: null, job_position_id: null, manager_id: null,
    date_of_joining: '', date_of_birth: '',
    bank_name: '', bank_account: '', address: '',
  };

  const [form, setForm] = useState(EMPTY);
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Populate form once data loads
  const formData = isNew ? form : (emp ? { ...emp, password: '' } : form);

  const createMutation = useMutation({
    mutationFn: createEmployee,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['employees'] }); navigate('/employees'); },
  });

  const updateMutation = useMutation({
    mutationFn: updateEmployee,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['employees'] }); queryClient.invalidateQueries({ queryKey: ['employee', id] }); setEditing(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteEmployee(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['employees'] }); navigate('/employees'); },
  });

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${display.first_name} ${display.last_name}?`)) {
      deleteMutation.mutate();
    }
  };

  const save = () => {
    if (isNew) {
      createMutation.mutate(form);
    } else {
      const { password, ...rest } = form;
      updateMutation.mutate({ id: Number(id), ...(password ? { password } : {}), ...rest });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const error     = createMutation.error?.message || updateMutation.error?.message;

  if (!isNew && isLoading) return <div><p>Loading…</p></div>;

  const display = isNew ? form : (emp ?? form);
  const avatarColor = COLORS[(Number(id) || 0) % COLORS.length];

  return (
    <div>
      <div className="page-breadcrumb" style={{ marginBottom: 8 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/employees')}>
          <ArrowLeft size={14} /> Employees
        </button>
        <span>/ {isNew ? 'New Employee' : `${display.first_name} ${display.last_name}`}</span>
      </div>

      <div className="page-header">
        <div className="d-flex gap-2" style={{ alignItems: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, fontWeight: 700 }}>
            {[display.first_name?.[0], display.last_name?.[0]].filter(Boolean).join('').toUpperCase() || 'EM'}
          </div>
          <div>
            <h1 style={{ marginBottom: 2 }}>{isNew ? 'New Employee' : `${display.first_name} ${display.last_name}`}</h1>
            <div style={{ fontSize: 13, color: 'var(--gray-400)' }}>{display.job_position_title} {display.department_name ? `• ${display.department_name}` : ''}</div>
          </div>
        </div>
        <div className="d-flex gap-2">
          {!isNew && !editing && (
            <>
              <button className="btn btn-secondary" onClick={() => {
              setForm({
                first_name:        emp.first_name        ?? '',
                last_name:         emp.last_name         ?? '',
                email:             emp.email             ?? '',
                phone:             emp.phone             ?? '',
                password:          '',
                role:              emp.role              ?? 'employee',
                employment_status: emp.employment_status ?? 'active',
                employee_type:     emp.employee_type     ?? 'full_time',
                department_id:     emp.department_id     ?? null,
                job_position_id:   emp.job_position_id   ?? null,
                manager_id:        emp.manager_id        ?? null,
                date_of_joining:   emp.date_of_joining   ? emp.date_of_joining.slice(0, 10) : '',
                date_of_birth:     emp.date_of_birth     ? emp.date_of_birth.slice(0, 10)   : '',
                bank_name:         emp.bank_name         ?? '',
                bank_account:      emp.bank_account      ?? '',
                address:           emp.address           ?? '',
              });
              setEditing(true);
            }}>Edit</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </>
          )}
          {(editing || isNew) && (
            <>
              <button className="btn btn-secondary" onClick={() => isNew ? navigate('/employees') : setEditing(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={isPending}>{isPending ? 'Saving…' : 'Save'}</button>
            </>
          )}
        </div>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}

      {!isNew && (
        <div className="smart-btns">
          <button className="smart-btn" onClick={() => navigate(`/contracts?employee=${id}`)}>
            <FileText size={14} /> Contracts <span className="count">{empContracts.length}</span>
          </button>
          <button className="smart-btn" onClick={() => navigate(`/attendance?employee=${id}`)}>
            <Clock size={14} /> Attendance <span className="count">{empAttendance.length}</span>
          </button>
          <button className="smart-btn" onClick={() => navigate(`/timeoff/requests?employee=${id}`)}>
            <Calendar size={14} /> Time Off <span className="count">{empTimeOff.length}</span>
          </button>
          <button className="smart-btn" onClick={() => navigate(`/timeoff/allocations?employee=${id}`)}>
            <Gift size={14} /> Allocations <span className="count">{empAllocations.length}</span>
          </button>
        </div>
      )}

      <div className="card">
        <div className="tabs" style={{ padding: '0 20px' }}>
          <button className={`tab-btn ${tab === 'work' ? 'active' : ''}`} onClick={() => setTab('work')}>Work Information</button>
          <button className={`tab-btn ${tab === 'private' ? 'active' : ''}`} onClick={() => setTab('private')}>Private Information</button>
        </div>
        <div className="card-body">
          {tab === 'work' && (
            <div className="form-grid">
              {[
                { label: 'First Name *', field: 'first_name', type: 'text' },
                { label: 'Last Name *',  field: 'last_name',  type: 'text' },
                { label: 'Work Email *', field: 'email',      type: 'email' },
                { label: 'Phone',        field: 'phone',      type: 'text' },
              ].map(({ label, field, type }) => (
                <div className="form-group" key={field}>
                  <label>{label}</label>
                  <input className="form-control" type={type}
                    value={editing ? form[field] : display[field] ?? ''}
                    disabled={!editing && !isNew}
                    onChange={e => setField(field, e.target.value)} />
                </div>
              ))}
              {isNew && (
                <div className="form-group">
                  <label>Password *</label>
                  <input className="form-control" type="password" value={form.password}
                    onChange={e => setField('password', e.target.value)} />
                </div>
              )}
              <div className="form-group">
                <label>Role</label>
                <select className="form-control"
                  value={editing ? form.role : display.role ?? ''}
                  disabled={!editing && !isNew}
                  onChange={e => setField('role', e.target.value)}>
                  {['employee','hr_manager','hr_payroll_user','hr_payroll_manager','admin'].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Employee Type</label>
                <select className="form-control"
                  value={editing ? form.employee_type : display.employee_type ?? ''}
                  disabled={!editing && !isNew}
                  onChange={e => setField('employee_type', e.target.value)}>
                  {['full_time','part_time','contract','intern'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Date of Joining</label>
                <input className="form-control" type="date"
                  value={editing ? form.date_of_joining : display.date_of_joining?.slice(0,10) ?? ''}
                  disabled={!editing && !isNew}
                  onChange={e => setField('date_of_joining', e.target.value)} />
              </div>
            </div>
          )}
          {tab === 'private' && (
            <div className="form-grid">
              <div className="form-group">
                <label>Date of Birth</label>
                <input className="form-control" type="date"
                  value={editing ? form.date_of_birth : display.date_of_birth?.slice(0,10) ?? ''}
                  disabled={!editing && !isNew}
                  onChange={e => setField('date_of_birth', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Bank Name</label>
                <input className="form-control"
                  value={editing ? form.bank_name : display.bank_name ?? ''}
                  disabled={!editing && !isNew}
                  onChange={e => setField('bank_name', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Bank Account</label>
                <input className="form-control"
                  value={editing ? form.bank_account : display.bank_account ?? ''}
                  disabled={!editing && !isNew}
                  onChange={e => setField('bank_account', e.target.value)} />
              </div>
              <div className="form-group span-2">
                <label>Address</label>
                <textarea className="form-control"
                  value={editing ? form.address : display.address ?? ''}
                  disabled={!editing && !isNew}
                  onChange={e => setField('address', e.target.value)} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
