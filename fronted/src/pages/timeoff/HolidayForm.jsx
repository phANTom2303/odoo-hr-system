import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getHolidayById, createHoliday, updateHoliday, deleteHoliday } from '../../api/holidays';
import { useApp } from '../../context/AppContext';

const EMPTY = { name: '', date: '', holiday_type: 'national', is_paid: true };

export default function HolidayForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentUser } = useApp();
  const isNew = id === 'new';
  const isHR = ['admin', 'hr_manager', 'hr_payroll_user', 'hr_payroll_manager'].includes(currentUser?.role);

  const [editing, setEditing] = useState(isNew);
  const [form, setForm] = useState(EMPTY);
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const { data: holiday, isLoading } = useQuery({
    queryKey: ['holiday', id],
    queryFn: () => getHolidayById(id).then(r => r.data),
    enabled: !isNew,
  });

  useEffect(() => {
    if (holiday) setForm({ ...EMPTY, ...holiday, date: holiday.date?.slice(0, 10) ?? '' });
  }, [holiday]);

  const createMutation = useMutation({
    mutationFn: createHoliday,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['holidays'] }); navigate('/timeoff/holidays'); },
  });

  const updateMutation = useMutation({
    mutationFn: updateHoliday,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['holidays'] }); queryClient.invalidateQueries({ queryKey: ['holiday', id] }); setEditing(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteHoliday(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['holidays'] }); navigate('/timeoff/holidays'); },
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
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/timeoff/holidays')}>
          <ArrowLeft size={14} /> Holidays
        </button>
        <span> / {isNew ? 'New Holiday' : form.name}</span>
      </div>

      <div className="page-header">
        <h1>{isNew ? 'New Holiday' : form.name}</h1>
        {isHR && (
          <div className="d-flex gap-2">
            {!isNew && !editing && (
              <>
                <button className="btn btn-secondary" onClick={() => setEditing(true)}>Edit</button>
                <button className="btn btn-danger" onClick={() => { if (window.confirm('Delete this holiday?')) deleteMutation.mutate(); }} disabled={deleteMutation.isPending}>
                  Delete
                </button>
              </>
            )}
            {(editing || isNew) && (
              <>
                <button className="btn btn-secondary" onClick={() => isNew ? navigate('/timeoff/holidays') : setEditing(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={save} disabled={isPending}>{isPending ? 'Saving…' : 'Save'}</button>
              </>
            )}
          </div>
        )}
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="card">
        <div className="card-body">
          <div className="form-grid">
            <div className="form-group">
              <label>Holiday Name <span className="req">*</span></label>
              <input className="form-control" value={form.name} disabled={!editing} onChange={e => setField('name', e.target.value)} placeholder="e.g. Republic Day" />
            </div>
            <div className="form-group">
              <label>Date <span className="req">*</span></label>
              <input className="form-control" type="date" value={form.date} disabled={!editing} onChange={e => setField('date', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Holiday Type</label>
              <select className="form-control" value={form.holiday_type} disabled={!editing} onChange={e => setField('holiday_type', e.target.value)}>
                <option value="national">National</option>
                <option value="regional">Regional</option>
                <option value="company">Company</option>
              </select>
            </div>
            <div className="form-group">
              <label>Paid Holiday</label>
              <select className="form-control" value={form.is_paid ? 'yes' : 'no'} disabled={!editing}
                onChange={e => setField('is_paid', e.target.value === 'yes')}>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
