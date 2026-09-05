import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function AllocationForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { allocations, setAllocations, employees, timeOffTypes, approveAllocation } = useApp();

  const isNew = id === 'new';
  const existing = isNew ? null : allocations.find(a => a.id === Number(id));

  const [form, setForm] = useState(existing || {
    employeeId: '', employeeName: '', typeId: '', typeName: '',
    allocated: 0, taken: 0, remaining: 0, status: 'To Approve',
    approver: '', validity: '', description: '',
  });
  const [editing, setEditing] = useState(isNew);
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = () => {
    if (isNew) {
      const emp  = employees.find(e => e.id === Number(form.employeeId));
      const type = timeOffTypes.find(t => t.id === Number(form.typeId));
      const newA = { ...form, id: Date.now(), employeeName: emp?.name || '', typeName: type?.name || '', remaining: Number(form.allocated) - Number(form.taken) };
      setAllocations(prev => [...prev, newA]);
      navigate('/timeoff/allocations');
    } else {
      setAllocations(prev => prev.map(a => a.id === Number(id) ? { ...a, ...form } : a));
      setEditing(false);
    }
  };

  if (!isNew && !existing) return <div><p>Allocation not found.</p></div>;

  const statusBadge = (s) => {
    if (s === 'Approved')   return 'badge-green';
    if (s === 'To Approve') return 'badge-yellow';
    return 'badge-gray';
  };

  return (
    <div>
      <div className="page-breadcrumb" style={{ marginBottom: 8 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/timeoff/allocations')}>
          <ArrowLeft size={14} /> Allocations
        </button>
        <span> / {isNew ? 'New Allocation' : form.employeeName}</span>
      </div>

      <div className="page-header">
        <div>
          <h1>{isNew ? 'New Allocation' : `Allocation / ${form.employeeName}`}</h1>
          {!isNew && <span className={`badge ${statusBadge(form.status)}`} style={{ marginTop: 4 }}>{form.status}</span>}
        </div>
        <div className="d-flex gap-2">
          {!isNew && form.status === 'To Approve' && (
            <button className="btn btn-success" onClick={() => { approveAllocation(Number(id)); navigate('/timeoff/allocations'); }}>
              <Check size={14} /> Approve
            </button>
          )}
          {!isNew && !editing && <button className="btn btn-secondary" onClick={() => setEditing(true)}>Edit</button>}
          {(editing || isNew) && (
            <>
              <button className="btn btn-secondary" onClick={() => isNew ? navigate('/timeoff/allocations') : setEditing(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>Save</button>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="form-grid">
            <div className="form-group">
              <label>Employee</label>
              {isNew ? (
                <select className="form-control" value={form.employeeId} onChange={e => setField('employeeId', e.target.value)}>
                  <option value="">Select employee</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              ) : <input className="form-control" value={form.employeeName} disabled />}
            </div>
            <div className="form-group">
              <label>Taken</label>
              <input className="form-control" type="number" value={form.taken} disabled={!editing} onChange={e => setField('taken', Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label>Time Off Type</label>
              {isNew ? (
                <select className="form-control" value={form.typeId} onChange={e => setField('typeId', e.target.value)}>
                  <option value="">Select type</option>
                  {timeOffTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              ) : <input className="form-control" value={form.typeName} disabled />}
            </div>
            <div className="form-group">
              <label>Remaining</label>
              <input className="form-control" value={`${Number(form.allocated) - Number(form.taken)} Days`} disabled />
            </div>
            <div className="form-group">
              <label>Allocated Days</label>
              <input className="form-control" type="number" value={form.allocated} disabled={!editing} onChange={e => setField('allocated', Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label>Approver</label>
              <input className="form-control" value={form.approver} disabled={!editing} onChange={e => setField('approver', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Status</label>
              <input className="form-control" value={form.status} disabled />
            </div>
            <div className="form-group">
              <label>Validity</label>
              <input className="form-control" value={form.validity} disabled={!editing} onChange={e => setField('validity', e.target.value)} />
            </div>
            <div className="form-group span-2">
              <label>Description</label>
              <textarea className="form-control" value={form.description} disabled={!editing} onChange={e => setField('description', e.target.value)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
