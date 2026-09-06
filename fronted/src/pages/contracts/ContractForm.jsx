import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getContractById, createContract, updateContract } from '../../api/contracts';
import { getEmployees } from '../../api/employees';
import { getSchedules } from '../../api/schedules';
import { getSalaryStructures } from '../../api/salary';

export default function ContractForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isNew = id === 'new';

  const { data: employeesRes } = useQuery({ queryKey: ['employees'], queryFn: () => getEmployees().then(r => r.data) });
  const { data: schedulesRes } = useQuery({ queryKey: ['schedules'],  queryFn: () => getSchedules().then(r => r.data) });
  const { data: structuresRes } = useQuery({ queryKey: ['salary-structures'], queryFn: () => getSalaryStructures().then(r => r.data) });

  const employees        = employeesRes  ?? [];
  const schedules        = schedulesRes  ?? [];
  const salaryStructures = structuresRes ?? [];

  const { data, isLoading, isError } = useQuery({
    queryFn: () => getContractById(id),
    enabled: !isNew,
  });

  const existing = data?.data;

  const [form, setForm] = useState({
    ref: '', employeeId: '', employeeName: '', department: '', jobPosition: '',
    startDate: '', endDate: '', wage: '', status: 'Draft',
    scheduleId: '', schedule: '', structureId: '', structure: '',
  });
  const [editing, setEditing] = useState(isNew);

  useEffect(() => {
    if (existing) {
      const dbStatusToUI = { 'draft': 'Draft', 'active': 'Running', 'expired': 'Expired', 'cancelled': 'Cancelled' };
      setForm({
        ref: `Contract #${existing.id}`,
        employeeId: existing.employee_id || '',
        employeeName: existing.employee_name || '',
        department: existing.department_name || '',
        jobPosition: existing.job_position_name || '',
        startDate: existing.start_date ? existing.start_date.slice(0, 10) : '',
        endDate: existing.end_date ? existing.end_date.slice(0, 10) : '',
        wage: existing.wage || '',
        status: dbStatusToUI[existing.status] || 'Draft',
        schedule: existing.schedule_name || '',
        structure: existing.salary_structure_name || '',
      });
    }
  }, [existing]);

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: (dataToSave) => isNew ? createContract(dataToSave) : updateContract(dataToSave),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      if (isNew) {
        navigate('/contracts');
      } else {
        setEditing(false);
      }
    },
    onError: (error) => {
      console.error("Failed to save contract", error);
      alert("Failed to save contract");
    }
  });

  const save = () => {
    const uiStatusToDB = { 'Draft': 'draft', 'Running': 'active', 'Expired': 'expired', 'Cancelled': 'cancelled' };

    let dataToSave;
    if (isNew) {
      dataToSave = {
        employee_id:          Number(form.employeeId),
        wage:                 Number(form.wage),
        start_date:           form.startDate,
        end_date:             form.endDate || null,
        status:               uiStatusToDB[form.status] || 'draft',
        schedule_id:          Number(form.scheduleId) || null,
        salary_structure_id:  Number(form.structureId) || null,
      };
    } else {
      dataToSave = {
        id: Number(id),
        wage: Number(form.wage),
        start_date: form.startDate,
        end_date: form.endDate || null,
        status: uiStatusToDB[form.status] || 'draft',
      };
    }

    mutation.mutate(dataToSave);
  };

  if (!isNew && isLoading) return <div><p>Loading...</p></div>;
  if (!isNew && !existing && !isLoading) return <div><p>Contract not found.</p></div>;

  const statusBadge = (s) => {
    if (s === 'Running') return 'badge-green';
    if (s === 'Expired') return 'badge-gray';
    return 'badge-yellow';
  };

  return (
    <div>
      <div className="page-breadcrumb" style={{ marginBottom: 8 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/contracts')}>
          <ArrowLeft size={14} /> Contracts
        </button>
        <span> / {isNew ? 'New Contract' : form.ref}</span>
      </div>

      <div className="page-header">
        <div>
          <h1>{isNew ? 'New Contract' : `Contract / ${form.ref}`}</h1>
          {!isNew && <span className={`badge ${statusBadge(form.status)}`} style={{ marginTop: 4 }}>{form.status}</span>}
        </div>
        <div className="d-flex gap-2">
          {!isNew && !editing && <button className="btn btn-secondary" onClick={() => setEditing(true)}>Edit</button>}
          {(editing || isNew) && (
            <>
              <button className="btn btn-secondary" onClick={() => isNew ? navigate('/contracts') : setEditing(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="form-grid">
            <div className="form-group">
              <label>Employee <span className="req">*</span></label>
              {isNew ? (
                <select className="form-control" value={form.employeeId} onChange={e => {
                  const emp = employees.find(em => em.id === Number(e.target.value));
                  setForm(f => ({ ...f, employeeId: e.target.value, department: emp?.department_name || '', jobPosition: emp?.job_position_title || '' }));
                }}>
                  <option value="">Select employee</option>
                  {employees.map(em => <option key={em.id} value={em.id}>{em.first_name} {em.last_name}</option>)}
                </select>
              ) : (
                <input className="form-control" value={form.employeeName} disabled />
              )}
            </div>
            <div className="form-group">
              <label>Department</label>
              <input className="form-control" value={form.department} disabled={!editing} onChange={e => setField('department', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Start Date <span className="req">*</span></label>
              <input className="form-control" type="date" value={form.startDate} disabled={!editing} onChange={e => setField('startDate', e.target.value)} />
            </div>
            <div className="form-group">
              <label>End Date</label>
              <input className="form-control" type="date" value={form.endDate || ''} disabled={!editing} onChange={e => setField('endDate', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Job Position</label>
              <input className="form-control" value={form.jobPosition} disabled={!editing} onChange={e => setField('jobPosition', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Wage / Month (₹) <span className="req">*</span></label>
              <input className="form-control" type="number" value={form.wage} disabled={!editing} onChange={e => setField('wage', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select className="form-control" value={form.status} disabled={!editing} onChange={e => setField('status', e.target.value)}>
                <option>Draft</option><option>Running</option><option>Expired</option>
              </select>
            </div>
            <div className="form-group">
              <label>Working Schedule</label>
              {isNew ? (
                <select className="form-control" value={form.scheduleId} onChange={e => {
                  const s = schedules.find(sc => sc.id === Number(e.target.value));
                  setForm(f => ({ ...f, scheduleId: e.target.value, schedule: s?.name || '' }));
                }}>
                  <option value="">— Select —</option>
                  {schedules.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              ) : (
                <input className="form-control" value={form.schedule} disabled />
              )}
            </div>
            <div className="form-group">
              <label>Salary Structure</label>
              {isNew ? (
                <select className="form-control" value={form.structureId} onChange={e => {
                  const s = salaryStructures.find(ss => ss.id === Number(e.target.value));
                  setForm(f => ({ ...f, structureId: e.target.value, structure: s?.name || '' }));
                }}>
                  <option value="">— Select —</option>
                  {salaryStructures.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              ) : (
                <input className="form-control" value={form.structure} disabled />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}