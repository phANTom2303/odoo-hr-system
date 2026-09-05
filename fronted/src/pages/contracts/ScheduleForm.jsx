import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { getScheduleById, createSchedule, updateSchedule } from '../../api/schedules';

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];

const calcHours = (start, end, breakMins) => {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const worked = (eh * 60 + em) - (sh * 60 + sm) - (Number(breakMins) || 0);
  return worked > 0 ? `${(worked / 60).toFixed(1)}h` : '—';
};

export default function ScheduleForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = id === 'new';

  const [editing, setEditing] = useState(isNew);
  const [form, setForm] = useState({ name: '', is_active: true, lines: [] });
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (messages.length === 0) return;
    const t = setTimeout(() => setMessages([]), 3000);
    return () => clearTimeout(t);
  }, [messages]);

  const { data: schedule, isLoading } = useQuery({
    queryKey: ['schedule', id],
    queryFn: () => getScheduleById(id).then(r => r.data),
    enabled: !isNew,
  });

  useEffect(() => {
    if (schedule) {
      setForm({
        name: schedule.name,
        is_active: schedule.is_active,
        lines: (schedule.lines ?? []).map(l => ({
          day_of_week: l.day_of_week,
          start_time: l.start_time?.slice(0, 5) ?? '09:00',
          end_time: l.end_time?.slice(0, 5) ?? '18:00',
          break_minutes: l.break_minutes ?? '',
        })),
      });
    }
  }, [schedule]);

  const createMutation = useMutation({
    mutationFn: createSchedule,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['schedules'] }); navigate('/schedules'); },
  });

  const updateMutation = useMutation({
    mutationFn: updateSchedule,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['schedules'] }); queryClient.invalidateQueries({ queryKey: ['schedule', id] }); setEditing(false); },
  });

  const save = () => {
    if (isNew) createMutation.mutate(form);
    else       updateMutation.mutate({ id: Number(id), ...form });
  };

  const addLine = () => {
    setForm(f => ({
      ...f, lines: [...f.lines, { day_of_week: 'monday', start_time: '09:00', end_time: '18:00', break_minutes: '' }],
    }));
  };

  const updateLine = (i, k, v) => {
    if (k === 'day_of_week') {
      if (v === 'saturday' || v === 'sunday') {
        setMessages([`"${v}" is a non-working day and cannot be added.`]);
        return;
      }
      const duplicate = form.lines.some((l, idx) => idx !== i && l.day_of_week === v);
      if (duplicate) {
        setMessages([`"${v}" is already in this schedule.`]);
        return;
      }
      setMessages([]);
    }
    setForm(f => {
      const lines = [...f.lines];
      lines[i] = { ...lines[i], [k]: v };
      return { ...f, lines };
    });
  };

  const removeLine = (i) => setForm(f => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }));

  const totalHours = form.lines.reduce((sum, l) => {
    const [sh, sm] = l.start_time.split(':').map(Number);
    const [eh, em] = l.end_time.split(':').map(Number);
    const worked = (eh * 60 + em) - (sh * 60 + sm) - (Number(l.break_minutes) || 0);
    return sum + (worked > 0 ? worked / 60 : 0);
  }, 0);

  const isPending = createMutation.isPending || updateMutation.isPending;
  const error     = createMutation.error?.message || updateMutation.error?.message;

  if (!isNew && isLoading) return <div><p>Loading…</p></div>;

  return (
    <div>
      <div className="page-breadcrumb" style={{ marginBottom: 8 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/schedules')}>
          <ArrowLeft size={14} /> Working Schedules
        </button>
        <span> / {isNew ? 'New Schedule' : form.name}</span>
      </div>

      <div className="page-header">
        <h1>{isNew ? 'New Working Schedule' : form.name}</h1>
        <div className="d-flex gap-2">
          {!isNew && !editing && <button className="btn btn-secondary" onClick={() => setEditing(true)}>Edit</button>}
          {(editing || isNew) && (
            <>
              <button className="btn btn-secondary" onClick={() => isNew ? navigate('/schedules') : setEditing(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={isPending}>{isPending ? 'Saving…' : 'Save'}</button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="alert alert-warning" style={{ marginBottom: 12 }}>
          ⚠ Something went wrong while saving. Please check your entries and try again.
        </div>
      )}

      {messages.length > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: 12 }}>
          {messages.map((msg, i) => <div key={i}>⚠ {msg}</div>)}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body">
          <div className="form-grid">
            <div className="form-group">
              <label>Schedule Name <span className="req">*</span></label>
              <input className="form-control" value={form.name} disabled={!editing}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select className="form-control" value={form.is_active ? 'active' : 'inactive'} disabled={!editing}
                onChange={e => setForm(f => ({ ...f, is_active: e.target.value === 'active' }))}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Weekly Schedule</h3>
          {editing && (
            <button className="btn btn-secondary btn-sm" onClick={addLine}>
              <Plus size={13} /> Add Day
            </button>
          )}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Day</th><th>Start</th><th>End</th><th>Break (min)</th><th>Hours</th>{editing && <th></th>}</tr>
            </thead>
            <tbody>
              {form.lines.map((line, i) => (
                <tr key={i}>
                  <td>
                    {editing ? (
                      <select className="form-control" value={line.day_of_week}
                        onChange={e => updateLine(i, 'day_of_week', e.target.value)} style={{ width: 'auto' }}>
                        {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    ) : line.day_of_week}
                  </td>
                  <td>
                    {editing ? <input className="form-control" type="time" value={line.start_time}
                      onChange={e => updateLine(i, 'start_time', e.target.value)} style={{ width: 110 }} />
                      : line.start_time}
                  </td>
                  <td>
                    {editing ? <input className="form-control" type="time" value={line.end_time}
                      onChange={e => updateLine(i, 'end_time', e.target.value)} style={{ width: 110 }} />
                      : line.end_time}
                  </td>
                  <td>
                    {editing ? <input className="form-control no-spinner" type="number" value={line.break_minutes ?? ''}
                      onChange={e => updateLine(i, 'break_minutes', e.target.value === '' ? '' : Number(e.target.value))} style={{ width: 80 }} />
                      : line.break_minutes}
                  </td>
                  <td style={{ fontWeight: 500 }}>{calcHours(line.start_time, line.end_time, line.break_minutes)}</td>
                  {editing && <td><button className="btn btn-ghost btn-sm" onClick={() => removeLine(i)}><X size={14} /></button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', gap: 8, fontSize: 13, fontWeight: 600, borderTop: '1px solid var(--gray-100)' }}>
          <span style={{ color: 'var(--gray-500)' }}>Total Weekly Hours:</span>
          <span>{totalHours.toFixed(1)}h</span>
        </div>
      </div>
    </div>
  );
}
