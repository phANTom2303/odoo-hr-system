import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Play, CheckCircle, DollarSign, Mail, AlertTriangle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { contracts, salaryRules as allRules } from '../../data/mockData';

function computeLines(employeeId, structure) {
  const contract = contracts.find(c => c.employeeId === employeeId && c.status === 'Running');
  const wage = contract?.wage || 50000;
  const rules = allRules.filter(r => r.structure === structure).sort((a, b) => a.sequence - b.sequence);

  const cats = {};
  const lines = rules.map(rule => {
    let amount = 0;
    if (rule.computation === 'Percentage') {
      const pct = parseFloat(rule.value);
      if (rule.value.includes('Contract Wage') || rule.code === 'BASIC') {
        amount = (pct / 100) * wage;
      } else if (rule.value.includes('Basic')) {
        amount = (pct / 100) * (cats['BASIC'] || 0);
      } else if (rule.value.includes('Gross')) {
        amount = (pct / 100) * (cats['GROSS'] || 0);
      } else {
        amount = (pct / 100) * wage;
      }
    } else if (rule.computation === 'Fixed') {
      amount = parseFloat(rule.value.replace(/[₹,\s]/g, '')) || 0;
    } else if (rule.computation === 'Formula') {
      if (rule.code === 'GROSS') {
        amount = (cats['BASIC'] || 0) + (cats['HRA'] || 0) + (cats['SPCL'] || 0);
      } else if (rule.code === 'NET') {
        amount = (cats['GROSS'] || 0) - (cats['PF'] || 0) - (cats['ESIC'] || 0) - (cats['PT'] || 0);
      }
    }
    if (rule.category === 'Deduction') amount = -Math.abs(amount);
    cats[rule.code] = Math.abs(amount);
    return { name: rule.name, code: rule.code, category: rule.category, amount: Math.round(amount) };
  });
  return lines;
}

export default function PayrunForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { payruns, setPayruns, payslips, setPayslips, employees } = useApp();

  const payrun = payruns.find(p => p.id === Number(id));
  if (!payrun) return <div><p>Pay run not found.</p></div>;

  const runPayslips = payslips.filter(s => s.payrunId === Number(id));

  const compute = () => {
    setPayslips(prev => prev.map(s => {
      if (s.payrunId !== Number(id)) return s;
      return { ...s, lines: computeLines(s.employeeId, payrun.structure), status: 'Computed' };
    }));
    const nets = runPayslips.map(s => {
      const lines = computeLines(s.employeeId, payrun.structure);
      return lines.find(l => l.code === 'NET')?.amount || 0;
    });
    setPayruns(prev => prev.map(p => p.id === Number(id) ? { ...p, status: 'Computed', totalNet: nets.reduce((a, b) => a + b, 0) } : p));
  };

  const validate = () => {
    setPayslips(prev => prev.map(s => s.payrunId === Number(id) ? { ...s, status: 'Validated' } : s));
    setPayruns(prev => prev.map(p => p.id === Number(id) ? { ...p, status: 'Validated' } : p));
  };

  const markPaid = () => {
    setPayslips(prev => prev.map(s => s.payrunId === Number(id) ? { ...s, status: 'Paid' } : s));
    setPayruns(prev => prev.map(p => p.id === Number(id) ? { ...p, status: 'Paid' } : p));
  };

  const statusBadge = (s) => {
    if (s === 'Paid')      return 'badge-green';
    if (s === 'Validated') return 'badge-blue';
    if (s === 'Computed')  return 'badge-yellow';
    if (s === 'Draft')     return 'badge-gray';
    return 'badge-gray';
  };

  const noBank = employees.filter(e => runPayslips.find(s => s.employeeId === e.id) && !e.bankAccount);
  const hasWarnings = noBank.length > 0;

  return (
    <div>
      <div className="page-breadcrumb" style={{ marginBottom: 8 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/payroll/runs')}>
          <ArrowLeft size={14} /> Pay Runs
        </button>
        <span> / {payrun.name}</span>
      </div>

      <div className="page-header">
        <div>
          <h1>{payrun.name}</h1>
          <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
            <span className={`badge ${statusBadge(payrun.status)}`}>{payrun.status}</span>
            <span style={{ fontSize: 13, color: 'var(--gray-400)' }}>{payrun.period} • {payrun.structure}</span>
          </div>
        </div>
        <div className="d-flex gap-2">
          {payrun.status === 'Draft' && (
            <button className="btn btn-primary" onClick={compute}><Play size={14} /> Compute</button>
          )}
          {payrun.status === 'Computed' && (
            <button className="btn btn-primary" onClick={validate}><CheckCircle size={14} /> Validate</button>
          )}
          {payrun.status === 'Validated' && (
            <button className="btn btn-success" onClick={markPaid}><DollarSign size={14} /> Mark as Paid</button>
          )}
          {(payrun.status === 'Validated' || payrun.status === 'Paid') && (
            <button className="btn btn-secondary"><Mail size={14} /> Send Payslips</button>
          )}
        </div>
      </div>

      {hasWarnings && (
        <div className="alert alert-warning" style={{ marginBottom: 16 }}>
          <AlertTriangle size={15} />
          <span>{noBank.length} employee(s) may be missing bank account details. Review before finalizing.</span>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3>Payslips ({runPayslips.length})</h3>
          <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>
            Total Net: <strong>₹ {payrun.totalNet.toLocaleString('en-IN')}</strong>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Structure</th>
                <th>Period</th>
                <th>Worked Days</th>
                <th>Net Salary</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {runPayslips.map(s => {
                const net = s.lines?.find(l => l.code === 'NET')?.amount || 0;
                return (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 500 }}>{s.employeeName}</td>
                    <td>{s.structure}</td>
                    <td>{s.period}</td>
                    <td>{s.workedDays}</td>
                    <td style={{ fontWeight: 600 }}>₹ {net.toLocaleString('en-IN')}</td>
                    <td><span className={`badge ${statusBadge(s.status)}`}>{s.status}</span></td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/payroll/payslips/${s.id}`)}>
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
