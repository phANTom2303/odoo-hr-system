import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

function calcHours(start, end, brk) {
  try {
    const toMins = t => {
      const [time, mer] = t.split(' ');
      let [h, m] = time.split(':').map(Number);
      if (mer === 'PM' && h !== 12) h += 12;
      if (mer === 'AM' && h === 12) h = 0;
      return h * 60 + m;
    };
    const brkMins = brk === '—' || !brk ? 0 : parseFloat(brk) * 60;
    const worked = toMins(end) - toMins(start) - brkMins;
    return `${(worked / 60).toFixed(1)}h`;
  } catch { return '—'; }
}

export default function ScheduleForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { schedules, setSchedules } = useApp();

  const isNew = id === 'new';
  const existing = isNew ? null : schedules.find(s => s.id === Number(id));

  const [form, setForm] = useState(existing || {
    name: '', daysPerWeek: 5, hoursPerWeek: '40h', company: 'My Company', status: 'Active', lines: [],
  });
  const [editing, setEditing] = useState(isNew);

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addLine = () => setForm(f => ({
    ...f,
    lines: [...f.lines, { day: 'Monday', start: '09:00 AM', end: '06:00 PM', breakH: '1h', hours: '8h' }],
  }));

  const updateLine = (i, k, v) => setForm(f => {
    const lines = [...f.lines];
    lines[i] = { ...lines[i], [k]: v };
    lines[i].hours = calcHours(lines[i].start, lines[i].end, lines[i].breakH);
    return { ...f, lines };
  });

  const removeLine = (i) => setForm(f => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }));

  const totalHours = form.lines.reduce((sum, l) => {
    const h = parseFloat(l.hours) || 0;
    return sum + h;
  }, 0);

  const save = () => {
    const updated = { ...form, hoursPerWeek: `${totalHours}h`, daysPerWeek: form.lines.length };
    if (isNew) {
      setSchedules(prev => [...prev, { ...updated, id: Date.now() }]);
      navigate('/schedules');
    } else {
      setSchedules(prev => prev.map(s => s.id === Number(id) ? { ...s, ...updated } : s));
      setEditing(false);
    }
  };

  if (!isNew && !existing) return <div><p>Schedule not found.</p></div>;

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
              <button className="btn btn-primary" onClick={save}>Save</button>
            </>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body">
          <div className="form-grid">
            <div className="form-group">
              <label>Schedule Name <span className="req">*</span></label>
              <input className="form-control" value={form.name} disabled={!editing} onChange={e => setField('name', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Company</label>
              <input className="form-control" value={form.company} disabled={!editing} onChange={e => setField('company', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Timezone</label>
              <input className="form-control" defaultValue="Company timezone" disabled={!editing} />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select className="form-control" value={form.status} disabled={!editing} onChange={e => setField('status', e.target.value)}>
                <option>Active</option><option>Inactive</option>
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
              <tr>
                <th>Day</th>
                <th>Start Time</th>
                <th>End Time</th>
                <th>Break</th>
                <th>Hours</th>
                {editing && <th></th>}
              </tr>
            </thead>
            <tbody>
              {form.lines.map((line, i) => (
                <tr key={i}>
                  <td>
                    {editing ? (
                      <select className="form-control" value={line.day} onChange={e => updateLine(i, 'day', e.target.value)} style={{ width: 'auto' }}>
                        {DAYS.map(d => <option key={d}>{d}</option>)}
                      </select>
                    ) : line.day}
                  </td>
                  <td>
                    {editing ? (
                      <input className="form-control" value={line.start} onChange={e => updateLine(i, 'start', e.target.value)} style={{ width: 110 }} />
                    ) : line.start}
                  </td>
                  <td>
                    {editing ? (
                      <input className="form-control" value={line.end} onChange={e => updateLine(i, 'end', e.target.value)} style={{ width: 110 }} />
                    ) : line.end}
                  </td>
                  <td>
                    {editing ? (
                      <input className="form-control" value={line.breakH} onChange={e => updateLine(i, 'breakH', e.target.value)} style={{ width: 70 }} />
                    ) : line.breakH}
                  </td>
                  <td style={{ fontWeight: 500 }}>{line.hours}</td>
                  {editing && (
                    <td>
                      <button className="btn-ghost btn" onClick={() => removeLine(i)}><X size={14} /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', gap: 8, fontSize: 13, fontWeight: 600, borderTop: '1px solid var(--gray-100)' }}>
          <span style={{ color: 'var(--gray-500)' }}>Total Weekly Hours:</span>
          <span>{totalHours}h</span>
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--gray-400)' }}>
        Use this schedule as the employee/contract working pattern.
      </div>
    </div>
  );
}
