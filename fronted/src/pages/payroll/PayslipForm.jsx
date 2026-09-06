import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, CheckCircle2, Plus, XCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPayslipById, reviewPayslip, n, addManualLine, cancelPayslip } from '../../api/payroll';
import { useAuth } from '../../context/AppContext';


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

function groupByContractTopLevel(lines) {
  const groups = [];
  const byKey = new Map();
  for (const line of lines) {
    if (line.category === 'gross' || line.category === 'net') continue;
    
    const isSynthetic = line.contract_id == null;
    const key = isSynthetic ? 'synthetic' : `${line.contract_id}-${line.segment_start}-${line.segment_end}`;
    let group = byKey.get(key);
    if (!group) {
      group = {
        key,
        contract_id: line.contract_id,
        segment_start: line.segment_start,
        segment_end: line.segment_end,
        isSynthetic,
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
  const { currentUser } = useAuth();
  
  const [manualName, setManualName] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualCategory, setManualCategory] = useState('allowance');
  const canProcess = ['admin', 'hr_payroll_manager'].includes(currentUser?.role);

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

  const manualLineMutation = useMutation({
    mutationFn: (data) => addManualLine(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payslip', id] });
      setManualName('');
      setManualAmount('');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelPayslip(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pay-runs'] });
      navigate(`/payroll/runs/${slip.pay_run_id}`);
    }
  });

  if (isLoading) return <div style={{ padding: 20 }}>Loading payslip…</div>;
  if (isError) return <div style={{ padding: 20, color: 'var(--danger)' }}>Failed to load payslip: {error.message}</div>;
  if (!slip) return <div style={{ padding: 20 }}><p>Payslip not found.</p></div>;

  const handlePrint = () => window.print();
  
  const handleCancel = () => {
    if (window.confirm("Cancelling this payslip will remove the employee from the pay run and trigger a full recomputation of all other payslips. Proceed?")) {
      cancelMutation.mutate();
    }
  };
  
  const handleAddManualLine = (e) => {
    e.preventDefault();
    if (!manualName || !manualAmount) return;
    manualLineMutation.mutate({ rule_name: manualName, amount: Number(manualAmount), category: manualCategory });
  };

  const lines = slip.lines ?? [];
  const groupedSegments = groupByContractTopLevel(lines);
  const contractSegments = groupedSegments.filter(g => !g.isSynthetic);
  const syntheticSegment = groupedSegments.find(g => g.isSynthetic);

  const gross = n(slip.gross_salary);
  const totalDeductions = n(slip.total_deductions);
  const net = n(slip.net_salary);

  const warnings = slip.warnings ?? [];
  const hasErrorWarning = warnings.some(w => w.severity === 'error');
  const canReview = !slip.is_reviewed && slip.status !== 'paid' && slip.status !== 'cancelled';
  const canCancel = canProcess && (slip.status === 'draft' || slip.status === 'computed');

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
            {slip.is_reviewed && <span className="badge badge-green">Reviewed</span>}
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
          {canCancel && (
            <button className="btn btn-danger" onClick={handleCancel} disabled={cancelMutation.isPending}>
              <XCircle size={14} /> Cancel Payslip
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

      {lines.length > 0 ? (
        <div>
          {contractSegments.map(seg => (
            <div className="card" key={seg.key} style={{ marginBottom: 16 }}>
              <div className="card-header">
                <h3>Segment: {seg.segment_start} to {seg.segment_end}</h3>
                <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>Contract #{seg.contract_id}</div>
              </div>
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
                    {seg.lines.map(line => {
                      const amount = n(line.amount);
                      return (
                        <tr key={line.id}>
                          <td style={{ paddingLeft: 28 }}>{line.rule_name}</td>
                          <td className="font-mono" style={{ color: 'var(--gray-500)' }}>{line.rule_code}</td>
                          <td style={{ color: 'var(--gray-500)' }}>{line.category}</td>
                          <td style={{ textAlign: 'right', fontWeight: 500, color: amount < 0 ? 'var(--danger)' : 'var(--gray-800)' }}>
                            {amount < 0 ? `(${Math.abs(amount).toLocaleString('en-IN')})` : amount.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          <div className="card">
            <div className="card-header">
              <h3>Consolidated Totals {syntheticSegment ? '& Adjustments' : ''}</h3>
            </div>
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
                  {syntheticSegment && syntheticSegment.lines.map(line => {
                    const amount = n(line.amount);
                    return (
                      <tr key={line.id}>
                        <td style={{ paddingLeft: 28 }}>{line.rule_name}</td>
                        <td className="font-mono" style={{ color: 'var(--gray-500)' }}>{line.rule_code}</td>
                        <td style={{ color: 'var(--gray-500)' }}>{line.category}</td>
                        <td style={{ textAlign: 'right', fontWeight: 500, color: amount < 0 ? 'var(--danger)' : 'var(--gray-800)' }}>
                          {amount < 0 ? `(${Math.abs(amount).toLocaleString('en-IN')})` : amount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    );
                  })}
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
          </div>

          {!slip.is_reviewed && canProcess && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-header">
                <h3>Add Manual Line</h3>
              </div>
              <div className="card-body">
                <form onSubmit={handleAddManualLine} style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                  <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label>Rule Name</label>
                    <input type="text" className="form-control" value={manualName} onChange={e => setManualName(e.target.value)} required />
                  </div>
                  <div className="form-group" style={{ width: 150, marginBottom: 0 }}>
                    <label>Category</label>
                    <select className="form-control" value={manualCategory} onChange={e => setManualCategory(e.target.value)}>
                      <option value="allowance">Allowance</option>
                      <option value="deduction">Deduction</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ width: 150, marginBottom: 0 }}>
                    <label>Amount (₹)</label>
                    <input type="number" className="form-control" value={manualAmount} onChange={e => setManualAmount(e.target.value)} required />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={manualLineMutation.isPending}>
                    <Plus size={14} /> Add Line
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card">
          <div className="empty-state">
            <p>No computation yet. Go to the Pay Run and click Compute.</p>
          </div>
        </div>
      )}
    </div>
  );
}
