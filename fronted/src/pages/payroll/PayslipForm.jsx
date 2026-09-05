import { Fragment } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, CheckCircle2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPayslipById, reviewPayslip, n } from '../../api/payroll';

const CATEGORY_LABELS = {
  basic: 'Basic',
  allowance: 'Allowance',
  deduction: 'Deduction',
};

// GROSS/NET lines are rendered once at the bottom from the payslip's own
// authoritative totals — see PAYROLL_API_REFERENCE.md §11 "Known issues & gaps".
const CATEGORY_ORDER = ['basic', 'allowance', 'deduction'];

const statusBadge = (s) => {
  if (s === 'paid') return 'badge-green';
  if (s === 'validated') return 'badge-blue';
  if (s === 'computed') return 'badge-yellow';
  return 'badge-gray';
};

const severityAlertClass = (severity) => {
  if (severity === 'error') return 'alert-danger';
  if (severity === 'info') return 'alert-info';
  return 'alert-warning';
};

/** Group already-sequence-ordered lines by contract segment, preserving first-seen order. */
function groupByContract(lines) {
  const groups = [];
  const byKey = new Map();
  for (const line of lines) {
    const key = line.contract_id ?? `none-${line.segment_start ?? ''}-${line.segment_end ?? ''}`;
    let group = byKey.get(key);
    if (!group) {
      group = {
        key,
        contract_id: line.contract_id,
        segment_start: line.segment_start,
        segment_end: line.segment_end,
        lines: [],
      };
      byKey.set(key, group);
      groups.push(group);
    }
    group.lines.push(line);
  }
  return groups;
}

export default function PayslipForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: slip, isLoading, isError, error } = useQuery({
    queryKey: ['payslip', id],
    queryFn: () => getPayslipById(id).then(r => r.data),
  });

  const reviewMutation = useMutation({
    mutationFn: () => reviewPayslip(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payslip', id] });
      if (slip?.pay_run_id) {
        queryClient.invalidateQueries({ queryKey: ['pay-run', slip.pay_run_id] });
      }
    },
  });

  if (isLoading) return <div style={{ padding: 20 }}>Loading payslip…</div>;
  if (isError) return <div style={{ padding: 20, color: 'var(--danger)' }}>Failed to load payslip: {error.message}</div>;
  if (!slip) return <div style={{ padding: 20 }}><p>Payslip not found.</p></div>;

  const handlePrint = () => window.print();

  const lines = slip.lines ?? [];
  // GROSS/NET rows repeat per contract segment on a prorated payslip and both
  // show the whole-payslip total, so they're rendered once at the bottom instead.
  const breakdownLines = lines.filter(l => l.category !== 'gross' && l.category !== 'net');

  const distinctSegments = new Set(
    breakdownLines.map(l => `${l.contract_id ?? ''}|${l.segment_start ?? ''}|${l.segment_end ?? ''}`)
  );
  const isProrated = slip.contract_id === null && distinctSegments.size > 1;

  const gross = n(slip.gross_salary);
  const totalDeductions = n(slip.total_deductions);
  const net = n(slip.net_salary);

  const warnings = slip.warnings ?? [];
  const hasErrorWarning = warnings.some(w => w.severity === 'error');
  const canReview = !slip.is_reviewed && slip.status !== 'paid';

  return (
    <div>
      <div className="page-breadcrumb" style={{ marginBottom: 8 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/payroll/runs/${slip.pay_run_id}`)}>
          <ArrowLeft size={14} /> {slip.pay_run_name}
        </button>
        <span> / {slip.employee_name}</span>
      </div>

      <div className="page-header">
        <div>
          <h1>Payslip — {slip.employee_name}</h1>
          <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
            <span className={`badge ${statusBadge(slip.status)}`}>{slip.status}</span>
            <span style={{ fontSize: 13, color: 'var(--gray-400)' }}>
              {slip.start_date} – {slip.end_date}{slip.structure_name ? ` • ${slip.structure_name}` : ''}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {canReview && (
            <button
              className={hasErrorWarning ? 'btn btn-danger' : 'btn btn-secondary'}
              onClick={() => reviewMutation.mutate()}
              disabled={reviewMutation.isPending}
            >
              <CheckCircle2 size={14} /> {reviewMutation.isPending ? 'Reviewing…' : 'Review'}
            </button>
          )}
          <button className="btn btn-secondary" onClick={handlePrint}>
            <Printer size={14} /> Print Payslip
          </button>
        </div>
      </div>

      {reviewMutation.isError && (
        <div className="alert alert-danger" style={{ marginBottom: 16 }}>
          {reviewMutation.error.message}
        </div>
      )}

      {warnings.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {warnings.map((w, idx) => (
            <div key={idx} className={`alert ${severityAlertClass(w.severity)}`}>
              {w.message}
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body">
          <div className="form-grid">
            <div className="form-group">
              <label>Employee</label>
              <input className="form-control" value={slip.employee_name} disabled />
            </div>
            <div className="form-group">
              <label>Pay Run</label>
              <input className="form-control" value={slip.pay_run_name} disabled />
            </div>
            <div className="form-group">
              <label>Salary Structure</label>
              <input className="form-control" value={slip.structure_name || '—'} disabled />
            </div>
            <div className="form-group">
              <label>Period</label>
              <input className="form-control" value={`${slip.start_date} – ${slip.end_date}`} disabled />
            </div>
            <div className="form-group">
              <label>Status</label>
              <input className="form-control" value={slip.status} disabled />
            </div>
            <div className="form-group">
              <label>Worked Days</label>
              <input className="form-control" value={n(slip.worked_days)} disabled />
            </div>
            <div className="form-group">
              <label>Worked Hours</label>
              <input className="form-control" value={n(slip.worked_hours)} disabled />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Salary Computation</h3>
        </div>
        {breakdownLines.length > 0 ? (
          <div className="table-wrap">
            <table className="salary-table">
              <thead>
                <tr>
                  <th>Rule Name</th>
                  <th>Code</th>
                  <th>Category</th>
                  <th style={{ textAlign: 'right' }}>Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {CATEGORY_ORDER.map(cat => {
                  const catLines = breakdownLines.filter(l => l.category === cat);
                  if (catLines.length === 0) return null;

                  const segments = isProrated ? groupByContract(catLines) : [{ key: cat, lines: catLines }];

                  return (
                    <Fragment key={`cat-${cat}`}>
                      <tr className="category-row">
                        <td colSpan={4}>{CATEGORY_LABELS[cat] ?? cat}</td>
                      </tr>
                      {segments.map(seg => (
                        <Fragment key={`seg-${cat}-${seg.key}`}>
                          {isProrated && (
                            <tr>
                              <td colSpan={4} style={{ paddingLeft: 20, fontSize: 12, color: 'var(--gray-500)', fontStyle: 'italic' }}>
                                {seg.contract_id != null
                                  ? `Contract #${seg.contract_id} — ${seg.segment_start} → ${seg.segment_end}`
                                  : 'Unassigned'}
                              </td>
                            </tr>
                          )}
                          {seg.lines.map(line => {
                            const amount = n(line.amount);
                            const factor = n(line.proration_factor);
                            const isProratedLine = factor !== null && factor < 1;
                            return (
                              <tr key={line.id}>
                                <td style={{ paddingLeft: isProrated ? 40 : 28 }}>
                                  {line.rule_name}
                                  {isProratedLine && (
                                    <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--gray-400)' }}>
                                      ({Math.round(factor * 100)}% of period)
                                    </span>
                                  )}
                                </td>
                                <td className="font-mono" style={{ color: 'var(--gray-500)' }}>{line.rule_code}</td>
                                <td style={{ color: 'var(--gray-500)' }}>{line.category}</td>
                                <td style={{ textAlign: 'right', fontWeight: 500, color: amount < 0 ? 'var(--danger)' : 'var(--gray-800)' }}>
                                  {amount < 0 ? `(${Math.abs(amount).toLocaleString('en-IN')})` : amount.toLocaleString('en-IN')}
                                </td>
                              </tr>
                            );
                          })}
                        </Fragment>
                      ))}
                    </Fragment>
                  );
                })}
                <tr className="category-row">
                  <td colSpan={4}>Gross / Net</td>
                </tr>
                <tr>
                  <td style={{ paddingLeft: 28 }}>Gross Salary</td>
                  <td className="font-mono" style={{ color: 'var(--gray-500)' }}>GROSS</td>
                  <td style={{ color: 'var(--gray-500)' }}>gross</td>
                  <td style={{ textAlign: 'right', fontWeight: 500 }}>{gross.toLocaleString('en-IN')}</td>
                </tr>
                <tr>
                  <td style={{ paddingLeft: 28 }}>Total Deductions</td>
                  <td className="font-mono" style={{ color: 'var(--gray-500)' }}>—</td>
                  <td style={{ color: 'var(--gray-500)' }}>deduction</td>
                  <td style={{ textAlign: 'right', fontWeight: 500, color: 'var(--danger)' }}>
                    ({totalDeductions.toLocaleString('en-IN')})
                  </td>
                </tr>
                <tr className="total-row">
                  <td colSpan={3} style={{ paddingTop: 12 }}>NET SALARY</td>
                  <td style={{ textAlign: 'right', fontSize: 16, color: 'var(--success)', paddingTop: 12 }}>
                    ₹ {net.toLocaleString('en-IN')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>No computation yet. Go to the Pay Run and click Compute.</p>
          </div>
        )}
      </div>
    </div>
  );
}
