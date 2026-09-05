import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function TimeOffRequestForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { timeOffRequests, setTimeOffRequests, employees, timeOffTypes, approveRequest, refuseRequest } = useApp();

  const isNew = id === 'new';
  const existing = isNew ? null : timeOffRequests.find(r => r.id === Number(id));

  const [form, setForm] = useState(existing || {
    employeeId: '', employeeName: '', typeId: '', typeName: '',
    startDate: '', endDate: '', duration: 0, status: 'Draft',
    approver: 'Sara Khan', allocationUsed: '', reason: '',
  });
  const [editing, setEditing] = useState(isNew);

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = () => {
    if (isNew) {
      const emp  = employees.find(e => e.id === Number(form.employeeId));
      const type = timeOffTypes.find(t => t.id === Number(form.typeId));
      const newR = { ...form, id: Date.now(), employeeName: emp?.name || '', typeName: type?.name || '' };
      setTimeOffRequests(prev => [...prev, newR]);
      navigate('/timeoff/requests');
    } else {
      setTimeOffRequests(prev => prev.map(r => r.id === Number(id) ? { ...r, ...form } : r));
      setEditing(false);
    }
  };

  if (!isNew && !existing) return <div><p>Request not found.</p></div>;

  const statusBadge = (s) => {
    if (s === 'Approved') return 'badge-green';
    if (s === 'Refused')  return 'badge-red';
    if (s === 'To Approve' || s === 'Draft') return 'badge-yellow';
    return 'badge-gray';
  };

  return (
    <div>
      <div className="page-breadcrumb" style={{ marginBottom: 8 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/timeoff/requests')}>
          <ArrowLeft size={14} /> Requests
        </button>
        <span> / {isNew ? 'New Request' : form.employeeName}</span>
      </div>

      <div className="page-header">
        <div>
          <h1>{isNew ? 'New Time Off Request' : `Time Off Request / ${form.employeeName}`}</h1>
          {!isNew && <span className={`badge ${statusBadge(form.status)}`} style={{ marginTop: 4 }}>{form.status}</span>}
        </div>
        <div className="d-flex gap-2">
          {!isNew && (form.status === 'To Approve' || form.status === 'Draft') && (
            <>
              <button className="btn btn-success" onClick={() => { approveRequest(Number(id)); navigate('/timeoff/requests'); }}>
                <Check size={14} /> Approve
              </button>
              <button className="btn btn-danger" onClick={() => { refuseRequest(Number(id)); navigate('/timeoff/requests'); }}>
                <X size={14} /> Refuse
              </button>
            </>
          )}
          {!isNew && !editing && <button className="btn btn-secondary" onClick={() => setEditing(true)}>Edit</button>}
          {(editing || isNew) && (
            <>
              <button className="btn btn-secondary" onClick={() => isNew ? navigate('/timeoff/requests') : setEditing(false)}>Cancel</button>
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
              <label>Duration</label>
              <input className="form-control" value={`${form.duration} Days`} disabled />
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
              <label>Status</label>
              <input className="form-control" value={form.status} disabled />
            </div>
            <div className="form-group">
              <label>Start Date</label>
              <input className="form-control" type="date" value={form.startDate} disabled={!editing}
                onChange={e => {
                  const s = new Date(e.target.value);
                  const en = form.endDate ? new Date(form.endDate) : s;
                  const days = Math.max(1, Math.round((en - s) / 86400000) + 1);
                  setForm(f => ({ ...f, startDate: e.target.value, duration: days }));
                }} />
            </div>
            <div className="form-group">
              <label>Approver</label>
              <input className="form-control" value={form.approver} disabled={!editing} onChange={e => setField('approver', e.target.value)} />
            </div>
            <div className="form-group">
              <label>End Date</label>
              <input className="form-control" type="date" value={form.endDate} disabled={!editing}
                onChange={e => {
                  const s = form.startDate ? new Date(form.startDate) : new Date(e.target.value);
                  const en = new Date(e.target.value);
                  const days = Math.max(1, Math.round((en - s) / 86400000) + 1);
                  setForm(f => ({ ...f, endDate: e.target.value, duration: days }));
                }} />
            </div>
            <div className="form-group">
              <label>Allocation Used</label>
              <input className="form-control" value={form.allocationUsed} disabled={!editing} onChange={e => setField('allocationUsed', e.target.value)} />
            </div>
            <div className="form-group span-2">
              <label>Reason</label>
              <textarea className="form-control" value={form.reason} disabled={!editing} onChange={e => setField('reason', e.target.value)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
