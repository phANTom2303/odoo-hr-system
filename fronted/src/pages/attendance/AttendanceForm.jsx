import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getAttendanceById } from '../../api/attendance';

export default function AttendanceForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const { data, isLoading } = useQuery({
    queryKey: ['attendance', id],
    queryFn: () => getAttendanceById(id).then(r => r.data),
    enabled: !isNew,
  });

  const rec = data ?? {};

  const statusBadge = (s) => {
    if (s === 'present')  return 'badge-green';
    if (s === 'absent')   return 'badge-red';
    if (s === 'on_leave') return 'badge-yellow';
    if (s === 'holiday')  return 'badge-blue';
    return 'badge-gray';
  };

  if (!isNew && isLoading) return <div><p>Loading…</p></div>;

  return (
    <div>
      <div className="page-breadcrumb" style={{ marginBottom: 8 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/attendance')}>
          <ArrowLeft size={14} /> Attendance
        </button>
        <span> / {isNew ? 'New Record' : `${rec.employee_name} / ${rec.date?.slice(0, 10) || ''}`}</span>
      </div>

      <div className="page-header">
        <div>
          <h1>{isNew ? 'New Attendance' : `Attendance — ${rec.employee_name}`}</h1>
          {!isNew && rec.status && (
            <span className={`badge ${statusBadge(rec.status)}`} style={{ marginTop: 4 }}>{rec.status}</span>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="form-grid">
            <div className="form-group">
              <label>Employee</label>
              <input className="form-control" value={rec.employee_name ?? ''} disabled />
            </div>
            <div className="form-group">
              <label>Department</label>
              <input className="form-control" value={rec.department_name ?? ''} disabled />
            </div>
            <div className="form-group">
              <label>Date</label>
              <input className="form-control" value={rec.date?.slice(0, 10) ?? ''} disabled />
            </div>
            <div className="form-group">
              <label>Status</label>
              <input className="form-control" value={rec.status ?? ''} disabled />
            </div>
            <div className="form-group">
              <label>Check In</label>
              <input className="form-control" value={rec.check_in ? new Date(rec.check_in).toLocaleString() : '—'} disabled />
            </div>
            <div className="form-group">
              <label>Check Out</label>
              <input className="form-control" value={rec.check_out ? new Date(rec.check_out).toLocaleString() : '—'} disabled />
            </div>
            <div className="form-group">
              <label>Worked Hours</label>
              <input className="form-control" value={rec.worked_hours != null ? Number(rec.worked_hours).toFixed(2) : '—'} disabled />
            </div>
            <div className="form-group">
              <label>Overtime Hours</label>
              <input className="form-control" value={rec.overtime_hours != null ? Number(rec.overtime_hours).toFixed(2) : '0.00'} disabled />
            </div>
            <div className="form-group">
              <label>Manual Edit</label>
              <input className="form-control" value={rec.is_manual_edit ? 'Yes' : 'No'} disabled />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
