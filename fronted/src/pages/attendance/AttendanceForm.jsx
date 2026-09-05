import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function AttendanceForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { attendanceRecords, setAttendanceRecords, employees } = useApp();

  const isNew = id === 'new';
  const existing = isNew ? null : attendanceRecords.find(a => a.id === Number(id));

  const [form, setForm] = useState(existing || {
    employeeId: '', employeeName: '', department: '', manager: '',
    checkIn: '', checkOut: '', workedHours: 0, overtime: 0, status: 'Present', notes: '',
  });
  const [editing, setEditing] = useState(isNew);

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = () => {
    if (isNew) {
      const emp = employees.find(e => e.id === Number(form.employeeId));
      const newRec = { ...form, id: Date.now(), employeeName: emp?.name || '', department: emp?.department || '', manager: emp?.manager || '' };
      setAttendanceRecords(prev => [...prev, newRec]);
      navigate('/attendance');
    } else {
      setAttendanceRecords(prev => prev.map(a => a.id === Number(id) ? { ...a, ...form } : a));
      setEditing(false);
    }
  };

  if (!isNew && !existing) return <div><p>Record not found.</p></div>;

  const statusBadge = (s) => {
    if (s === 'Present') return 'badge-green';
    if (s === 'Absent')  return 'badge-red';
    if (s === 'Late')    return 'badge-yellow';
    return 'badge-gray';
  };

  return (
    <div>
      <div className="page-breadcrumb" style={{ marginBottom: 8 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/attendance')}>
          <ArrowLeft size={14} /> Attendance
        </button>
        <span> / {isNew ? 'New Record' : `${form.employeeName} / ${form.checkIn?.slice(0, 10) || ''}`}</span>
      </div>

      <div className="page-header">
        <div>
          <h1>{isNew ? 'New Attendance' : `Attendance / ${form.employeeName}`}</h1>
          {!isNew && <span className={`badge ${statusBadge(form.status)}`} style={{ marginTop: 4 }}>{form.status}</span>}
        </div>
        <div className="d-flex gap-2">
          {!isNew && !editing && <button className="btn btn-secondary" onClick={() => setEditing(true)}>Edit</button>}
          {(editing || isNew) && (
            <>
              <button className="btn btn-secondary" onClick={() => isNew ? navigate('/attendance') : setEditing(false)}>Cancel</button>
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
              ) : (
                <input className="form-control" value={form.employeeName} disabled />
              )}
            </div>
            <div className="form-group">
              <label>Department</label>
              <input className="form-control" value={form.department} disabled />
            </div>
            <div className="form-group">
              <label>Check In</label>
              <input className="form-control" type="datetime-local" value={form.checkIn?.replace(' ', 'T') || ''} disabled={!editing}
                onChange={e => setField('checkIn', e.target.value.replace('T', ' '))} />
            </div>
            <div className="form-group">
              <label>Check Out</label>
              <input className="form-control" type="datetime-local" value={form.checkOut?.replace(' ', 'T') || ''} disabled={!editing}
                onChange={e => setField('checkOut', e.target.value.replace('T', ' '))} />
            </div>
            <div className="form-group">
              <label>Worked Hours</label>
              <input className="form-control" type="number" value={form.workedHours} disabled={!editing} onChange={e => setField('workedHours', parseFloat(e.target.value))} />
            </div>
            <div className="form-group">
              <label>Overtime</label>
              <input className="form-control" type="number" value={form.overtime} disabled={!editing} onChange={e => setField('overtime', parseFloat(e.target.value))} />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select className="form-control" value={form.status} disabled={!editing} onChange={e => setField('status', e.target.value)}>
                <option>Present</option><option>Absent</option><option>Late</option>
              </select>
            </div>
            <div className="form-group">
              <label>Manager</label>
              <input className="form-control" value={form.manager} disabled />
            </div>
            <div className="form-group span-2">
              <label>Notes</label>
              <textarea className="form-control" value={form.notes} disabled={!editing} onChange={e => setField('notes', e.target.value)}
                placeholder="System-generated from check in/out or manually corrected by an authorized user." />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
