import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, Clock, Calendar, Gift } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const COLORS = ['#4f46e5','#0891b2','#059669','#d97706','#7c3aed','#be185d','#0f766e','#c2410c'];

export default function EmployeeForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { employees, setEmployees, contracts, attendanceRecords, timeOffRequests, allocations, schedules } = useApp();

  const isNew = id === 'new';
  const existing = isNew ? null : employees.find(e => e.id === Number(id));

  const [form, setForm] = useState(existing || {
    name: '', email: '', phone: '', jobTitle: '', department: '',
    manager: '', schedule: '', company: 'OXP Pvt Ltd', status: 'Active',
    initials: '', color: COLORS[0],
  });
  const [tab, setTab] = useState('work');
  const [editing, setEditing] = useState(isNew);

  const empContracts   = contracts.filter(c => c.employeeId === Number(id));
  const empAttendance  = attendanceRecords.filter(a => a.employeeId === Number(id));
  const empTimeOff     = timeOffRequests.filter(r => r.employeeId === Number(id));
  const empAllocations = allocations.filter(a => a.employeeId === Number(id));

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = () => {
    if (isNew) {
      const words = form.name.trim().split(' ');
      const initials = words.length >= 2 ? words[0][0] + words[1][0] : words[0]?.slice(0, 2) || 'EM';
      const newEmp = { ...form, id: Date.now(), initials: initials.toUpperCase(), contracts: 0, timeOff: 0, attendance: 0 };
      setEmployees(prev => [...prev, newEmp]);
      navigate('/employees');
    } else {
      setEmployees(prev => prev.map(e => e.id === Number(id) ? { ...e, ...form } : e));
      setEditing(false);
    }
  };

  if (!isNew && !existing) return <div className="main-content"><p>Employee not found.</p></div>;

  const emp = form;
  const avatarColor = emp.color || COLORS[(Number(id) || 0) % COLORS.length];

  return (
    <div>
      <div className="page-breadcrumb" style={{ marginBottom: 8 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/employees')} style={{ marginRight: 8 }}>
          <ArrowLeft size={14} /> Employees
        </button>
        <span>/ {isNew ? 'New Employee' : emp.name}</span>
      </div>

      <div className="page-header">
        <div className="d-flex gap-2" style={{ alignItems: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, fontWeight: 700 }}>
            {(emp.initials || emp.name?.slice(0, 2) || 'EM').toUpperCase()}
          </div>
          <div>
            <h1 style={{ marginBottom: 2 }}>{isNew ? 'New Employee' : emp.name}</h1>
            <div style={{ fontSize: 13, color: 'var(--gray-400)' }}>{emp.jobTitle} {emp.department ? `• ${emp.department}` : ''}</div>
          </div>
        </div>
        <div className="d-flex gap-2">
          {!isNew && !editing && (
            <button className="btn btn-secondary" onClick={() => setEditing(true)}>Edit</button>
          )}
          {(editing || isNew) && (
            <>
              <button className="btn btn-secondary" onClick={() => isNew ? navigate('/employees') : setEditing(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>Save</button>
            </>
          )}
        </div>
      </div>

      {!isNew && (
        <div className="smart-btns">
          <button className="smart-btn" onClick={() => navigate(`/contracts?employee=${id}`)}>
            <FileText size={14} /> Contracts <span className="count">{empContracts.length}</span>
          </button>
          <button className="smart-btn" onClick={() => navigate(`/attendance?employee=${id}`)}>
            <Clock size={14} /> Attendance <span className="count">{empAttendance.length}</span>
          </button>
          <button className="smart-btn" onClick={() => navigate(`/timeoff/requests?employee=${id}`)}>
            <Calendar size={14} /> Time Off <span className="count">{empTimeOff.length}</span>
          </button>
          <button className="smart-btn" onClick={() => navigate(`/timeoff/allocations?employee=${id}`)}>
            <Gift size={14} /> Allocations <span className="count">{empAllocations.length}</span>
          </button>
        </div>
      )}

      <div className="card">
        <div className="tabs" style={{ padding: '0 20px' }}>
          <button className={`tab-btn ${tab === 'work' ? 'active' : ''}`} onClick={() => setTab('work')}>Work Information</button>
          <button className={`tab-btn ${tab === 'private' ? 'active' : ''}`} onClick={() => setTab('private')}>Private Information</button>
        </div>
        <div className="card-body">
          {tab === 'work' && (
            <div className="form-grid">
              <div className="form-group">
                <label>Full Name <span className="req">*</span></label>
                <input className="form-control" value={emp.name} disabled={!editing} onChange={e => setField('name', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Job Position</label>
                <input className="form-control" value={emp.jobTitle} disabled={!editing} onChange={e => setField('jobTitle', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Department</label>
                <select className="form-control" value={emp.department} disabled={!editing} onChange={e => setField('department', e.target.value)}>
                  {['Finance','HR','Engineering','Sales','IT','Support'].map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Manager</label>
                <input className="form-control" value={emp.manager} disabled={!editing} onChange={e => setField('manager', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Working Schedule</label>
                <select className="form-control" value={emp.schedule} disabled={!editing} onChange={e => setField('schedule', e.target.value)}>
                  <option value="">— Select —</option>
                  {schedules.map(s => <option key={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Work Location</label>
                <input className="form-control" defaultValue="Mumbai" disabled={!editing} />
              </div>
              <div className="form-group">
                <label>Company</label>
                <input className="form-control" value={emp.company} disabled={!editing} onChange={e => setField('company', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Work Email</label>
                <input className="form-control" value={emp.email} disabled={!editing} onChange={e => setField('email', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select className="form-control" value={emp.status} disabled={!editing} onChange={e => setField('status', e.target.value)}>
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </div>
            </div>
          )}
          {tab === 'private' && (
            <div className="form-grid">
              <div className="form-group">
                <label>Phone</label>
                <input className="form-control" value={emp.phone} disabled={!editing} onChange={e => setField('phone', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Personal Email</label>
                <input className="form-control" type="email" disabled={!editing} defaultValue="" />
              </div>
              <div className="form-group">
                <label>Date of Birth</label>
                <input className="form-control" type="date" disabled={!editing} />
              </div>
              <div className="form-group">
                <label>Gender</label>
                <select className="form-control" disabled={!editing}>
                  <option>Male</option><option>Female</option><option>Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Bank Account Number</label>
                <input className="form-control" disabled={!editing} placeholder="Enter bank account" />
              </div>
              <div className="form-group">
                <label>PAN Number</label>
                <input className="form-control" disabled={!editing} placeholder="ABCDE1234F" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
