import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { getTimeOffTypeById, createTimeOffType, updateTimeOffType } from '../../api/timeOffTypes';

export default function TimeOffTypeForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = id === 'new';

  const [editing, setEditing] = useState(isNew);
  const EMPTY = { name: '', unit: 'days', requires_allocation: true, approval_required: true, approver_role: 'hr_manager', leave_validation: 'manager', attendance_impact: 'absent', is_paid: true, is_active: true };
  const [form, setForm] = useState(EMPTY);
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const { data: type, isLoading } = useQuery({
    queryKey: ['time-off-type', id],
    queryFn: () => getTimeOffTypeById(id).then(r => r.data),
    enabled: !isNew,
  });

  useEffect(() => { if (type) setForm(type); }, [type]);

  const createMutation = useMutation({
    mutationFn: createTimeOffType,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['time-off-types'] }); navigate('/timeoff/types'); },
  });

  const updateMutation = useMutation({
    mutationFn: updateTimeOffType,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['time-off-types'] }); queryClient.invalidateQueries({ queryKey: ['time-off-type', id] }); setEditing(false); },
  });

  const save = () => {
    if (isNew) createMutation.mutate(form);
    else       updateMutation.mutate({ id: Number(id), ...form });
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const error     = createMutation.error?.message || updateMutation.error?.message;

  if (!isNew && isLoading) return <div><p>Loading…</p></div>;

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
              <button className="btn btn-primary" onClick={save} disabled={isPending}>{isPending ? 'Saving…' : 'Save'}</button>
            </>
          )}
        </div>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="card">
        <div className="card-body">
          <div className="form-grid">
            <div className="form-group">
              <label>Type Name <span className="req">*</span></label>
              <input className="form-control" value={form.name} disabled={!editing} onChange={e => setField('name', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Unit</label>
              <select className="form-control" value={form.unit} disabled={!editing} onChange={e => setField('unit', e.target.value)}>
                <option value="days">Days</option><option value="hours">Hours</option>
              </select>
            </div>
            <div className="form-group">
              <label>Requires Allocation</label>
              <select className="form-control" value={form.requires_allocation ? 'yes' : 'no'} disabled={!editing}
                onChange={e => setField('requires_allocation', e.target.value === 'yes')}>
                <option value="yes">Yes</option><option value="no">No</option>
              </select>
            </div>
            <div className="form-group">
              <label>Attendance Impact</label>
              <select className="form-control" value={form.attendance_impact} disabled={!editing} onChange={e => setField('attendance_impact', e.target.value)}>
                <option value="absent">Absent</option><option value="present">Present</option><option value="none">None</option>
              </select>
            </div>
            <div className="form-group">
              <label>Leave Validation</label>
              <select className="form-control" value={form.leave_validation} disabled={!editing} onChange={e => setField('leave_validation', e.target.value)}>
                <option value="no_validation">No Validation</option>
                <option value="hr">HR</option>
                <option value="manager">Manager</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div className="form-group">
              <label>Is Paid</label>
              <select className="form-control" value={form.is_paid ? 'yes' : 'no'} disabled={!editing}
                onChange={e => setField('is_paid', e.target.value === 'yes')}>
                <option value="yes">Yes</option><option value="no">No</option>
              </select>
            </div>
            <div className="form-group">
              <label>Active</label>
              <select className="form-control" value={form.is_active ? 'active' : 'inactive'} disabled={!editing}
                onChange={e => setField('is_active', e.target.value === 'active')}>
                <option value="active">Active</option><option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
