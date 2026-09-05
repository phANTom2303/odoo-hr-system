import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function TimeOffTypeForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { timeOffTypes, setTimeOffTypes } = useApp();

  const isNew = id === 'new';
  const existing = isNew ? null : timeOffTypes.find(t => t.id === Number(id));

  const [form, setForm] = useState(existing || {
    name: '', unit: 'Days', requiresAllocation: 'Yes', approval: 'Manager',
    payrollEntry: 'Leave Work Entry', color: 'Blue', status: 'Active', notes: '',
  });
  const [editing, setEditing] = useState(isNew);
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = () => {
    if (isNew) {
      setTimeOffTypes(prev => [...prev, { ...form, id: Date.now() }]);
      navigate('/timeoff/types');
    } else {
      setTimeOffTypes(prev => prev.map(t => t.id === Number(id) ? { ...t, ...form } : t));
      setEditing(false);
    }
  };

  if (!isNew && !existing) return <div><p>Type not found.</p></div>;

  return (
    <div>
      <div className="page-breadcrumb" style={{ marginBottom: 8 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/timeoff/types')}>
          <ArrowLeft size={14} /> Time Off Types
        </button>
        <span> / {isNew ? 'New Type' : form.name}</span>
      </div>

      <div className="page-header">
        <h1>{isNew ? 'New Time Off Type' : `Time Off Type / ${form.name}`}</h1>
        <div className="d-flex gap-2">
          {!isNew && !editing && <button className="btn btn-secondary" onClick={() => setEditing(true)}>Edit</button>}
          {(editing || isNew) && (
            <>
              <button className="btn btn-secondary" onClick={() => isNew ? navigate('/timeoff/types') : setEditing(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>Save</button>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="form-grid">
            <div className="form-group">
              <label>Type Name <span className="req">*</span></label>
              <input className="form-control" value={form.name} disabled={!editing} onChange={e => setField('name', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Approval</label>
              <select className="form-control" value={form.approval} disabled={!editing} onChange={e => setField('approval', e.target.value)}>
                <option>Manager</option><option>Officer</option><option>HR Manager</option><option>No Validation</option>
              </select>
            </div>
            <div className="form-group">
              <label>Unit</label>
              <select className="form-control" value={form.unit} disabled={!editing} onChange={e => setField('unit', e.target.value)}>
                <option>Days</option><option>Hours</option>
              </select>
            </div>
            <div className="form-group">
              <label>Payroll / Work Entry</label>
              <input className="form-control" value={form.payrollEntry} disabled={!editing} onChange={e => setField('payrollEntry', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Requires Allocation</label>
              <select className="form-control" value={form.requiresAllocation} disabled={!editing} onChange={e => setField('requiresAllocation', e.target.value)}>
                <option>Yes</option><option>No</option>
              </select>
            </div>
            <div className="form-group">
              <label>Display Color</label>
              <select className="form-control" value={form.color} disabled={!editing} onChange={e => setField('color', e.target.value)}>
                <option>Blue</option><option>Green</option><option>Orange</option><option>Red</option><option>Purple</option>
              </select>
            </div>
            <div className="form-group">
              <label>Active</label>
              <select className="form-control" value={form.status} disabled={!editing} onChange={e => setField('status', e.target.value)}>
                <option>Active</option><option>Inactive</option>
              </select>
            </div>
            <div className="form-group span-2">
              <label>Configuration Notes</label>
              <textarea className="form-control" value={form.notes} disabled={!editing} onChange={e => setField('notes', e.target.value)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
