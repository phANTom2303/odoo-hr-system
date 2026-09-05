import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPayRuns, getEligibleEmployees, createPayRun, n } from '../../api/payroll';
import { getSalaryStructures } from '../../api/salary';
import { useAuth } from '../../context/AppContext';

const CAN_MANAGE_RUNS = ['hr_payroll_user', 'hr_payroll_manager', 'admin'];

const STATUS_BADGE = {
  paid: 'badge-green',
  validated: 'badge-blue',
  computed: 'badge-yellow',
  draft: 'badge-gray',
  cancelled: 'badge-red',
};

export default function PayrunList() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [showWizard, setShowWizard] = useState(false);

  const canManageRuns = CAN_MANAGE_RUNS.includes(currentUser?.role);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['pay-runs', { status }],
    queryFn: () => getPayRuns(status ? { status } : {}).then(r => r.data),
  });

  const payruns = data ?? [];
  const filtered = payruns.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()));

  if (isLoading) return <div className="page-header"><p>Loading pay runs…</p></div>;
  if (isError)   return <div className="page-header"><p style={{ color: 'var(--danger)' }}>Failed to load pay runs: {error.message}</p></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-breadcrumb">Payroll ▸ <span>Pay Runs</span></div>
          <h1>Pay Runs</h1>
        </div>
        {canManageRuns && (
          <button className="btn btn-primary" onClick={() => setShowWizard(true)}>
            <Plus size={15} /> New Pay Run
          </button>
        )}
      </div>

      <div className="toolbar">
        <div className="search-bar">
          <Search size={14} color="var(--gray-400)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search pay runs…" />
        </div>
        <select className="filter-select" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="computed">Computed</option>
          <option value="validated">Validated</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Salary Structure</th>
                <th>Period</th>
                <th>Employees</th>
                <th>Total Net</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} onClick={() => navigate(`/payroll/runs/${p.id}`)}>
                  <td className="font-mono" style={{ fontWeight: 600 }}>{p.name}</td>
                  <td>{p.structure_name}</td>
                  <td>{p.start_date} → {p.end_date}</td>
                  <td>{p.employee_count}</td>
                  <td>₹ {n(p.total_net).toLocaleString('en-IN')}</td>
                  <td><span className={`badge ${STATUS_BADGE[p.status] || 'badge-gray'}`}>{p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showWizard && <PayrunWizard onClose={() => setShowWizard(false)} />}
    </div>
  );
}

function PayrunWizard({ onClose }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [structureId, setStructureId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [selected, setSelected] = useState([]);

  const { data: structuresData, isLoading: structuresLoading } = useQuery({
    queryKey: ['salary-structures'],
    queryFn: () => getSalaryStructures().then(r => r.data),
  });
  const activeStructures = (structuresData ?? []).filter(s => s.status === 'active');

  const { data: eligibleData, isLoading: eligibleLoading, isError: eligibleError } = useQuery({
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

  const canContinue = !!structureId && !!startDate && !!endDate && endDate >= startDate;

  const mutation = useMutation({
    mutationFn: () => createPayRun({
      salary_structure_id: Number(structureId),
      start_date: startDate,
      end_date: endDate,
      employee_ids: selected,
    }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['pay-runs'] });
      onClose();
      navigate(`/payroll/runs/${res.data.id}`);
    },
    onError: (error) => {
      alert(error.message || 'Failed to create pay run');
    },
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Create New Pay Run</h3>
          <button className="btn-ghost btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="wizard-steps" style={{ marginBottom: 24 }}>
            {['Scope & Period', 'Select Employees'].map((label, i) => (
              <div key={i} className={`wizard-step ${step === i + 1 ? 'active' : step > i + 1 ? 'done' : ''}`}>
                <div className="wizard-step-dot">{step > i + 1 ? '✓' : i + 1}</div>
                <div className="wizard-step-label">{label}</div>
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="form-grid cols-1" style={{ gap: 14 }}>
              <div className="form-group">
                <label>Salary Structure <span className="req">*</span></label>
                <select
                  className="form-control"
                  value={structureId}
                  onChange={e => setStructureId(e.target.value)}
                  disabled={structuresLoading}
                >
                  <option value="">Select a structure…</option>
                  {activeStructures.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Start Date <span className="req">*</span></label>
                <input
                  type="date"
                  className="form-control"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>End Date <span className="req">*</span></label>
                <input
                  type="date"
                  className="form-control"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                />
              </div>
              {endDate && startDate && endDate < startDate && (
                <p style={{ fontSize: 12, color: 'var(--danger)' }}>End date must be on or after the start date.</p>
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 12 }}>
                Select employees to include in this pay run:
              </p>

              {departments.length > 0 && (
                <select className="filter-select" style={{ marginBottom: 12 }} value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
                  <option value="">All Departments</option>
                  {departments.map(d => <option key={d}>{d}</option>)}
                </select>
              )}

              {eligibleLoading && <p>Loading eligible employees…</p>}
              {eligibleError && <p style={{ color: 'var(--danger)' }}>Failed to load eligible employees.</p>}
              {!eligibleLoading && !eligibleError && visibleEmployees.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>No eligible employees found for this period.</p>
              )}

              {visibleEmployees.map(emp => (
                <label key={emp.id} className="checkbox-row">
                  <input type="checkbox" checked={selected.includes(emp.id)} onChange={() => toggle(emp.id)} />
                  <div>
                    <div style={{ fontWeight: 500 }}>{emp.first_name} {emp.last_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{emp.job_position_title} • {emp.department_name}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      {emp.contract_count > 1 && (
                        <span className="badge badge-blue">will be prorated</span>
                      )}
                      {emp.has_overlapping_payslip && (
                        <span className="badge badge-red">already has a payslip this period</span>
                      )}
                    </div>
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
              <button
                className="btn btn-primary"
                disabled={selected.length === 0 || mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending ? 'Creating…' : `Create Payrun (${selected.length} employees)`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
