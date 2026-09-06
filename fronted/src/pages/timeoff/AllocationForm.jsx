import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAllocationById, createAllocation, approveAllocation, refuseAllocation } from '../../api/allocations';
import { getEmployees } from '../../api/employees';
import { getTimeOffTypes } from '../../api/timeOffTypes';
import { useApp } from '../../context/AppContext';

export default function AllocationForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentUser } = useApp();
  const isNew = id === 'new';
  const isHR = ['admin', 'hr_manager', 'hr_payroll_user', 'hr_payroll_manager'].includes(currentUser?.role);

  const [editing, setEditing] = useState(isNew);
  const [form, setForm] = useState({
    employee_id: '', time_off_type_id: '',
    start_date: '', end_date: '',
    allocated_amount: '', status: 'draft',
  });
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const { data: alloc, isLoading } = useQuery({
    queryKey: ['allocation', id],
    queryFn: () => getAllocationById(id).then(r => r.data),
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
  const display = isNew ? form : (alloc ?? form);

  const createMutation = useMutation({
    mutationFn: createAllocation,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['allocations'] }); navigate('/timeoff/allocations'); },
  });

  const approveMutation = useMutation({
    mutationFn: () => approveAllocation(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['allocations'] }); queryClient.invalidateQueries({ queryKey: ['allocation', id] }); },
  });

  const refuseMutation = useMutation({
    mutationFn: () => refuseAllocation(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['allocations'] }); queryClient.invalidateQueries({ queryKey: ['allocation', id] }); },
  });

  const save = () => createMutation.mutate(form);

  const statusBadge = (s) => {
    if (s === 'approved') return 'badge-green';
    if (s === 'draft')    return 'badge-yellow';
    if (s === 'refused')  return 'badge-red';
    return 'badge-gray';
  };

  if (!isNew && isLoading) return <div><p>Loading…</p></div>;

  return (
    <div>
      <div className="page-breadcrumb" style={{ marginBottom: 8 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/timeoff/allocations')}>
          <ArrowLeft size={14} /> Allocations
        </button>
        <span> / {isNew ? 'New Allocation' : display.employee_name}</span>
      </div>

      <div className="page-header">
        <div>
          <h1>{isNew ? 'New Allocation' : `Allocation — ${display.employee_name}`}</h1>
          {!isNew && display.status && (
            <span className={`badge ${statusBadge(display.status)}`} style={{ marginTop: 4 }}>{display.status}</span>
          )}
        </div>
        <div className="d-flex gap-2">
          {!isNew && display.status === 'draft' && isHR && (
            <>
              <button className="btn btn-success" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>Approve</button>
              <button className="btn btn-danger"  onClick={() => refuseMutation.mutate()}  disabled={refuseMutation.isPending}>Refuse</button>
            </>
          )}
          {isNew && isHR && (
            <>
              <button className="btn btn-secondary" onClick={() => navigate('/timeoff/allocations')}>Cancel</button>
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
              {isNew && isHR ? (
                <select className="form-control" value={form.employee_id} onChange={e => setField('employee_id', e.target.value)}>
                  <option value="">Select employee</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              ) : (
                <input className="form-control" value={isNew ? currentUser?.name : display.employee_name ?? ''} disabled />
              )}
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
                disabled={!isNew} onChange={e => setField('start_date', e.target.value)} />
            </div>
            <div className="form-group">
              <label>End Date</label>
              <input className="form-control" type="date"
                value={isNew ? form.end_date : display.end_date?.slice(0, 10) ?? ''}
                disabled={!isNew} onChange={e => setField('end_date', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Allocated Days</label>
              <input className="form-control no-spinner" type="number"
                value={isNew ? form.allocated_amount : display.allocated_amount ?? ''}
                disabled={!isNew} onChange={e => setField('allocated_amount', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Taken</label>
              <input className="form-control" value={display.taken ?? 0} disabled />
            </div>
            <div className="form-group">
              <label>Remaining</label>
              <input className="form-control" value={display.remaining ?? '—'} disabled />
            </div>
            <div className="form-group">
              <label>Status</label>
              <input className="form-control" value={display.status ?? ''} disabled />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
