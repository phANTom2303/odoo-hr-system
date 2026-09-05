import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function ContractForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { contracts, setContracts, employees, schedules, salaryStructures } = useApp();

  const isNew = id === 'new';
  const existing = isNew ? null : contracts.find(c => c.id === Number(id));

  const [form, setForm] = useState(existing || {
    ref: '', employeeId: '', employeeName: '', department: '', jobPosition: '',
    startDate: '', endDate: '', wage: '', status: 'Draft',
    schedule: '', structure: 'Employee Salary',
  });
  const [editing, setEditing] = useState(isNew);

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = () => {
    if (isNew) {
      const emp = employees.find(e => e.id === Number(form.employeeId));
      const next = { ...form, id: Date.now(), employeeName: emp?.name || form.employeeName, wage: Number(form.wage) };
      setContracts(prev => [...prev, next]);
      navigate('/contracts');
    } else {
      setContracts(prev => prev.map(c => c.id === Number(id) ? { ...c, ...form, wage: Number(form.wage) } : c));
      setEditing(false);
    }
  };

  if (!isNew && !existing) return <div><p>Contract not found.</p></div>;

  const statusBadge = (s) => {
    if (s === 'Running') return 'badge-green';
    if (s === 'Expired') return 'badge-gray';
    return 'badge-yellow';
  };

  return (
    <div>
      <div className="page-breadcrumb" style={{ marginBottom: 8 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/contracts')}>
          <ArrowLeft size={14} /> Contracts
        </button>
        <span> / {isNew ? 'New Contract' : form.ref}</span>
      </div>

      <div className="page-header">
        <div>
          <h1>{isNew ? 'New Contract' : `Contract / ${form.ref}`}</h1>
          {!isNew && <span className={`badge ${statusBadge(form.status)}`} style={{ marginTop: 4 }}>{form.status}</span>}
        </div>
        <div className="d-flex gap-2">
          {!isNew && !editing && <button className="btn btn-secondary" onClick={() => setEditing(true)}>Edit</button>}
          {(editing || isNew) && (
            <>
              <button className="btn btn-secondary" onClick={() => isNew ? navigate('/contracts') : setEditing(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>Save</button>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="form-grid">
            <div className="form-group">
              <label>Employee <span className="req">*</span></label>
              {isNew ? (
                <select className="form-control" value={form.employeeId} onChange={e => {
                  const emp = employees.find(em => em.id === Number(e.target.value));
                  setForm(f => ({ ...f, employeeId: e.target.value, department: emp?.department || '', jobPosition: emp?.jobTitle || '' }));
                }}>
                  <option value="">Select employee</option>
                  {employees.map(em => <option key={em.id} value={em.id}>{em.name}</option>)}
                </select>
              ) : (
                <input className="form-control" value={form.employeeName} disabled />
              )}
            </div>
            <div className="form-group">
              <label>Department</label>
              <input className="form-control" value={form.department} disabled={!editing} onChange={e => setField('department', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Start Date <span className="req">*</span></label>
              <input className="form-control" type="date" value={form.startDate} disabled={!editing} onChange={e => setField('startDate', e.target.value)} />
            </div>
            <div className="form-group">
              <label>End Date</label>
              <input className="form-control" type="date" value={form.endDate || ''} disabled={!editing} onChange={e => setField('endDate', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Job Position</label>
              <input className="form-control" value={form.jobPosition} disabled={!editing} onChange={e => setField('jobPosition', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Wage / Month (₹) <span className="req">*</span></label>
              <input className="form-control" type="number" value={form.wage} disabled={!editing} onChange={e => setField('wage', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select className="form-control" value={form.status} disabled={!editing} onChange={e => setField('status', e.target.value)}>
                <option>Draft</option><option>Running</option><option>Expired</option>
              </select>
            </div>
            <div className="form-group">
              <label>Working Schedule</label>
              <select className="form-control" value={form.schedule} disabled={!editing} onChange={e => setField('schedule', e.target.value)}>
                <option value="">— Select —</option>
                {schedules.map(s => <option key={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="divider" />
          <div className="form-group">
            <label>Salary Structure / Notes</label>
            <div style={{ padding: '10px 14px', background: 'var(--gray-50)', borderRadius: 8, fontSize: 13 }}>
              <strong>Structure Type:</strong> {form.structure}
              {form.status === 'Running' && (
                <div style={{ marginTop: 4, color: 'var(--gray-500)', fontSize: 12 }}>
                  This running contract is the source for payroll calculation in the active period.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
