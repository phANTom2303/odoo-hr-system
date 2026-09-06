import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Play, CheckCircle, DollarSign, Mail, AlertTriangle, Trash2, X, Edit2 } from 'lucide-react';
import { useAuth } from '../../context/AppContext';
import {
  getPayRunById,
  computePayRun,
  validatePayRun,
  markPayRunPaid,
  deletePayRun,
  reviewPayslip,
  updatePayRunMeta,
  getEligibleEmployees,
  n,
} from '../../api/payroll';

const STATUS_BADGE = {
  paid: 'badge-green',
  validated: 'badge-blue',
  computed: 'badge-yellow',
  draft: 'badge-gray',
  cancelled: 'badge-red',
};

const WARNING_BADGE = {
  error: 'badge-red',
  warning: 'badge-yellow',
  info: 'badge-blue',
};

const hasUnreviewedError = (p) => !p.is_reviewed && p.warnings.some((w) => w.severity === 'error');


function PayrunEditModal({ run, onClose }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [name, setName] = useState(run.name);
  const [startDate, setStartDate] = useState(run.start_date);
  const [endDate, setEndDate] = useState(run.end_date);
  const [deptFilter, setDeptFilter] = useState('');
  const [selected, setSelected] = useState(run.employee_ids ?? []);

  const { data: eligibleData, isLoading: eligibleLoading } = useQuery({
    queryKey: ['eligible-employees', { startDate, endDate }],
    queryFn: () => getEligibleEmployees({ start_date: startDate, end_date: endDate }).then(r => r.data),
    enabled: step === 2 && !!startDate && !!endDate,
  });

  const employees = useMemo(() => {
    const rows = eligibleData ?? [];
    return Object.values(
      rows.reduce((acc, r) => {
        (acc[r.id] ??= { ...r, contracts: [] }).contracts.push(r);
        return acc;
      }, {})
    );
  }, [eligibleData]);

  const departments = [...new Set(employees.map(e => e.department_name).filter(Boolean))];
  const visibleEmployees = deptFilter ? employees.filter(e => e.department_name === deptFilter) : employees;

  const toggle = (id) => setSelected(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const canContinue = !!startDate && !!endDate && endDate >= startDate;
  const updateMutation = useMutation({
    mutationFn: async () => {
      await updatePayRunMeta(run.id, { name, start_date: startDate, end_date: endDate, employee_ids: selected });
      if (run.status === 'computed') {
        await computePayRun(run.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pay-run', run.id] });
      onClose();
    },
    onError: (error) => alert(error.message)
  });

  const handleUpdate = () => {
    if (run.status === 'computed') {
      if (!window.confirm("This will delete all current payslips and recompute the pay run. Proceed?")) return;
    }
    updateMutation.mutate();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Pay Run</h3>
          <button className="btn-ghost btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="wizard-steps" style={{ marginBottom: 24 }}>
            {['Details', 'Select Employees'].map((label, i) => (
              <div key={i} className={`wizard-step ${step === i + 1 ? 'active' : step > i + 1 ? 'done' : ''}`}>
                <div className="wizard-step-dot">{step > i + 1 ? '✓' : i + 1}</div>
                <div className="wizard-step-label">{label}</div>
              </div>
            ))}
          </div>
          {step === 1 && (
            <div className="form-grid cols-1" style={{ gap: 14 }}>
              <div className="form-group">
                <label>Name</label>
                <input className="form-control" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Start Date <span className="req">*</span></label>
                <input type="date" className="form-control" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label>End Date <span className="req">*</span></label>
                <input type="date" className="form-control" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
              {endDate && startDate && endDate < startDate && (
                <p style={{ fontSize: 12, color: 'var(--danger)' }}>End date must be on or after the start date.</p>
              )}
            </div>
          )}
          {step === 2 && (
            <div>
              {departments.length > 0 && (
                <select className="filter-select" style={{ marginBottom: 12 }} value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
                  <option value="">All Departments</option>
                  {departments.map(d => <option key={d}>{d}</option>)}
                </select>
              )}
              {eligibleLoading && <p>Loading eligible employees…</p>}
              {visibleEmployees.map(emp => (
                <label key={emp.id} className="checkbox-row">
                  <input type="checkbox" checked={selected.includes(emp.id)} onChange={() => toggle(emp.id)} />
                  <div>
                    <div style={{ fontWeight: 500 }}>{emp.first_name} {emp.last_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{emp.job_position_title} • {emp.department_name}</div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          {step === 1 && (
            <button className="btn btn-primary" disabled={!canContinue} onClick={() => setStep(2)}>Continue →</button>
          )}
          {step === 2 && (
            <>
              <button className="btn btn-secondary" onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn-primary" disabled={selected.length === 0 || updateMutation.isPending} onClick={handleUpdate}>
                {updateMutation.isPending ? 'Updating…' : 'Update Pay Run'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PayrunForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();

  const canProcess = ['admin', 'hr_payroll_manager'].includes(currentUser?.role);

  const [banner, setBanner] = useState(null); // { type: 'info' | 'danger', text }
  const [showEdit, setShowEdit] = useState(false);
  const [validateError, setValidateError] = useState(null);

  const { data: run, isLoading, isError } = useQuery({
    queryKey: ['pay-run', id],
    queryFn: () => getPayRunById(id).then((r) => r.data),
  });

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 8000);
    return () => clearTimeout(t);
  }, [banner]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['pay-run', id] });

  const computeMutation = useMutation({
    mutationFn: () => computePayRun(id),
    onSuccess: (result) => {
      const s = result.data;
      invalidate();
      setBanner({
        type: s.warning_counts.error > 0 ? 'danger' : 'info',
        text: `${s.payslips_generated} payslip(s) generated — ${s.warning_counts.warning} warning(s), ${s.warning_counts.error} error(s).`,
      });
    },
    onError: (error) => setBanner({ type: 'danger', text: error.message }),
  });

  const validateMutation = useMutation({
    mutationFn: () => validatePayRun(id),
    onSuccess: () => {
      invalidate();
      setValidateError(null);
    },
    onError: (error) => setValidateError(error.message),
  });

  const markPaidMutation = useMutation({
    mutationFn: () => markPayRunPaid(id),
    onSuccess: invalidate,
    onError: (error) => setBanner({ type: 'danger', text: error.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deletePayRun(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pay-runs'] });
      navigate('/payroll/runs');
    },
    onError: (error) => setBanner({ type: 'danger', text: error.message }),
  });

  const reviewMutation = useMutation({
    mutationFn: (payslipId) => reviewPayslip(payslipId),
    onSuccess: invalidate,
    onError: (error) => setBanner({ type: 'danger', text: error.message }),
  });

  if (isLoading) return <div><p>Loading…</p></div>;
  if (isError || !run) return <div><p>Pay run not found.</p></div>;

  const payslips = run.payslips ?? [];
  const status = run.status;

  const canValidate =
    status === 'computed' && !payslips.some((p) => hasUnreviewedError(p));

  const errorSlipCount = payslips.filter((p) => hasUnreviewedError(p)).length;
  const warningSlipCount = payslips.filter(
    (p) => !hasUnreviewedError(p) && p.warnings.some((w) => w.severity === 'warning')
  ).length;

  const handleDelete = () => {
    if (window.confirm(`Delete pay run "${run.name}"? This cannot be undone.`)) {
      deleteMutation.mutate();
    }
  };

  const handleValidate = () => {
    setValidateError(null);
    validateMutation.mutate();
  };

  return (
    <div>
      <div className="page-breadcrumb" style={{ marginBottom: 8 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/payroll/runs')}>
          <ArrowLeft size={14} /> Pay Runs
        </button>
        <span> / {run.name}</span>
      </div>

      <div className="page-header">
        <div>
          <h1>{run.name}</h1>
          <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className={`badge ${STATUS_BADGE[status] || 'badge-gray'}`}>{status}</span>
            <span style={{ fontSize: 13, color: 'var(--gray-400)' }}>
              {run.start_date} – {run.end_date} • {run.employee_count} employee(s)
            </span>
          </div>
        </div>
        <div className="d-flex gap-2">
          {canProcess && (status === 'draft' || status === 'computed') && (
            <button className="btn btn-secondary" onClick={() => setShowEdit(true)}>
              <Edit2 size={14} /> Edit
            </button>
          )}
          {canProcess && status === 'draft' && (
            <button
              className="btn btn-primary"
              onClick={() => computeMutation.mutate()}
              disabled={computeMutation.isPending}
            >
              <Play size={14} /> {computeMutation.isPending ? 'Computing…' : 'Compute'}
            </button>
          )}
          {canProcess && status === 'computed' && (
            <button
              className="btn btn-primary"
              onClick={handleValidate}
              disabled={!canValidate || validateMutation.isPending}
              title={!canValidate ? 'Resolve unreviewed error warnings before validating' : undefined}
            >
              <CheckCircle size={14} /> {validateMutation.isPending ? 'Validating…' : 'Validate'}
            </button>
          )}
          {canProcess && status === 'validated' && (
            <button
              className="btn btn-success"
              onClick={() => markPaidMutation.mutate()}
              disabled={markPaidMutation.isPending}
            >
              <DollarSign size={14} /> {markPaidMutation.isPending ? 'Marking…' : 'Mark as Paid'}
            </button>
          )}
          {canProcess && (status === 'validated' || status === 'paid') && (
            <button className="btn btn-secondary" disabled title="Bulk email delivery isn't available yet">
              <Mail size={14} /> Send Payslips
            </button>
          )}
          {canProcess && (status === 'draft' || status === 'computed' || status === 'validated') && (
            <button
              className="btn btn-secondary"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              <Trash2 size={14} /> {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </button>
          )}
        </div>
      </div>

      {banner && (
        <div className={`alert alert-${banner.type === 'danger' ? 'danger' : 'info'}`} style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={15} /> {banner.text}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => setBanner(null)}><X size={14} /></button>
        </div>
      )}

      {validateError && (
        <div className="alert alert-danger" style={{ marginBottom: 12 }}>
          <AlertTriangle size={15} /> <span>{validateError} — use the Review action on the flagged row(s) below, then try Validate again.</span>
        </div>
      )}

      {errorSlipCount > 0 && (
        <div className="alert alert-danger" style={{ marginBottom: 12 }}>
          <AlertTriangle size={15} />
          <span>{errorSlipCount} payslip(s) have unreviewed errors and are blocking validation.</span>
        </div>
      )}
      {warningSlipCount > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: 16 }}>
          <AlertTriangle size={15} />
          <span>{warningSlipCount} payslip(s) have warnings worth reviewing.</span>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3>Payslips ({payslips.length})</h3>
          <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>
            Total Net: <strong>₹ {n(run.total_net ?? 0).toLocaleString('en-IN')}</strong>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th>Gross</th>
                <th>Net</th>
                <th>Status</th>
                <th>Warnings</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {payslips.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '24px 0' }}>
                    {status === 'draft' ? 'No payslips yet — compute this run to generate them.' : 'No payslips.'}
                  </td>
                </tr>
              )}
              {payslips.map((p) => {
                const showReview = canProcess && hasUnreviewedError(p);
                return (
                  <tr key={p.id} onClick={() => navigate(`/payroll/payslips/${p.id}`)} style={{ cursor: 'pointer' }}>
                    <td style={{ fontWeight: 500 }}>{p.employee_name}</td>
                    <td>{p.department_name}</td>
                    <td>₹ {n(p.gross_salary).toLocaleString('en-IN')}</td>
                    <td style={{ fontWeight: 600 }}>₹ {n(p.net_salary).toLocaleString('en-IN')}</td>
                    <td><span className={`badge ${STATUS_BADGE[p.status] || 'badge-gray'}`}>{p.status}</span></td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {p.warnings.map((w, i) => (
                          <span
                            key={i}
                            className={`badge ${WARNING_BADGE[w.severity] || 'badge-gray'}`}
                            title={w.message}
                          >
                            {w.code}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="d-flex gap-2">
                        {showReview && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => reviewMutation.mutate(p.id)}
                            disabled={reviewMutation.isPending}
                          >
                            Review
                          </button>
                        )}
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => navigate(`/payroll/payslips/${p.id}`)}
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {showEdit && <PayrunEditModal run={run} onClose={() => setShowEdit(false)} />}
    </div>
  );
}