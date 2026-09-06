import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getLeaveRequestById, createLeaveRequest, approveLeaveRequest, refuseLeaveRequest, withdrawLeaveRequest } from '../../api/leaveRequests';
import { getEmployees } from '../../api/employees';
import { getTimeOffTypes } from '../../api/timeOffTypes';

export default function TimeOffRequestForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = id === 'new';

  const [form, setForm] = useState({
    employee_id: '', time_off_type_id: '',
    start_date: '', end_date: '',
    reason: '', status: 'draft',
  });
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const { data: req, isLoading } = useQuery({
    queryKey: ['leave-request', id],
    queryFn: () => getLeaveRequestById(id).then(r => r.data),
    enabled: !isNew,
  });

  const { data: employeesData } = useQuery({
    queryKey: ['employees'],
    queryFn: () => getEmployees().then(r => r.data),
  });

  const { data: typesData } = useQuery({
    queryKey: ['timeOffTypes'],
    queryFn: () => getTimeOffTypes().then(r => r.data),
  });

  const employees = employeesData ?? [];
  const types = typesData ?? [];
  const display = isNew ? form : (req ?? form);

  const numDays = (start, end) => {
    if (!start || !end) return 0;
    return Math.max(1, Math.round((new Date(end) - new Date(start)) / 86400000) + 1);
  };

  const createMutation = useMutation({
    mutationFn: createLeaveRequest,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['leave-requests'] }); navigate('/timeoff/requests'); },
  });

  const approveMutation = useMutation({
    mutationFn: () => approveLeaveRequest(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['leave-requests'] }); queryClient.invalidateQueries({ queryKey: ['leave-request', id] }); },
  });

  const refuseMutation = useMutation({
    mutationFn: () => refuseLeaveRequest(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['leave-requests'] }); queryClient.invalidateQueries({ queryKey: ['leave-request', id] }); },
  });

  const withdrawMutation = useMutation({
    mutationFn: () => withdrawLeaveRequest(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['leave-requests'] }); queryClient.invalidateQueries({ queryKey: ['leave-request', id] }); },
  });

  const save = () => createMutation.mutate(form);

  const statusBadge = (s) => {
    if (s === 'approved')  return 'badge-green';
    if (s === 'refused')   return 'badge-red';
    if (s === 'pending')   return 'badge-yellow';
    if (s === 'withdrawn') return 'badge-gray';
    return 'badge-gray';
  };

  if (!isNew && isLoading) return <div><p>Loading…</p></div>;

  return (
    <div>
      <div className="page-breadcrumb" style={{ marginBottom: 8 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/timeoff/requests')}>
          <ArrowLeft size={14} /> Requests
        </button>
        <span> / {isNew ? 'New Request' : display.employee_name}</span>
      </div>

      <div className="page-header">
        <div>
          <h1>{isNew ? 'New Time Off Request' : `Request — ${display.employee_name}`}</h1>
          {!isNew && display.status && (
            <span className={`badge ${statusBadge(display.status)}`} style={{ marginTop: 4 }}>{display.status}</span>
          )}
        </div>
        <div className="d-flex gap-2">
          {!isNew && (display.status === 'draft' || display.status === 'pending') && (
            <>
              <button className="btn btn-success" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
                <Check size={14} /> Approve
              </button>
              <button className="btn btn-danger" onClick={() => refuseMutation.mutate()} disabled={refuseMutation.isPending}>
                <X size={14} /> Refuse
              </button>
            </>
          )}
          {!isNew && display.status === 'pending' && (
            <button className="btn btn-secondary" onClick={() => withdrawMutation.mutate()} disabled={withdrawMutation.isPending}>
              Withdraw
            </button>
          )}
          {isNew && (
            <>
              <button className="btn btn-secondary" onClick={() => navigate('/timeoff/requests')}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Saving…' : 'Save'}
              </button>
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
                <select className="form-control" value={form.employee_id} onChange={e => setField('employee_id', e.target.value)}>
                  <option value="">Select employee</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
                </select>
              ) : <input className="form-control" value={display.employee_name ?? ''} disabled />}
            </div>
            <div className="form-group">
              <label>Time Off Type</label>
              {isNew ? (
                <select className="form-control" value={form.time_off_type_id} onChange={e => setField('time_off_type_id', e.target.value)}>
                  <option value="">Select type</option>
                  {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              ) : <input className="form-control" value={display.time_off_type_name ?? ''} disabled />}
            </div>
            <div className="form-group">
              <label>Start Date</label>
              <input className="form-control" type="date"
                value={isNew ? form.start_date : display.start_date?.slice(0, 10) ?? ''}
                disabled={!isNew}
                onChange={e => setField('start_date', e.target.value)} />
            </div>
            <div className="form-group">
              <label>End Date</label>
              <input className="form-control" type="date"
                value={isNew ? form.end_date : display.end_date?.slice(0, 10) ?? ''}
                disabled={!isNew}
                onChange={e => setField('end_date', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Duration</label>
              <input className="form-control"
                value={isNew
                  ? `${numDays(form.start_date, form.end_date)} day(s)`
                  : `${display.number_of_days ?? 0} day(s)`}
                disabled />
            </div>
            <div className="form-group">
              <label>Status</label>
              <input className="form-control" value={display.status ?? ''} disabled />
            </div>
            <div className="form-group span-2">
              <label>Reason</label>
              <textarea className="form-control"
                value={isNew ? form.reason : display.reason ?? ''}
                disabled={!isNew}
                onChange={e => setField('reason', e.target.value)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
