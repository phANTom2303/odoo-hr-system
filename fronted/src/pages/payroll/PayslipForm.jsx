import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function PayslipForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { payslips } = useApp();

  const slip = payslips.find(s => s.id === Number(id));
  if (!slip) return <div><p>Payslip not found.</p></div>;

  const categories = ['Basic', 'Allowance', 'Gross', 'Deduction', 'Net'];

  const net   = slip.lines?.find(l => l.code === 'NET')?.amount || 0;
  const gross = slip.lines?.find(l => l.code === 'GROSS')?.amount || 0;

  const handlePrint = () => window.print();

  const statusBadge = (s) => {
    if (s === 'Paid')      return 'badge-green';
    if (s === 'Validated') return 'badge-blue';
    if (s === 'Computed')  return 'badge-yellow';
    return 'badge-gray';
  };

  return (
    <div>
      <div className="page-breadcrumb" style={{ marginBottom: 8 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/payroll/runs/${slip.payrunId}`)}>
          <ArrowLeft size={14} /> {slip.payrunName}
        </button>
        <span> / {slip.employeeName}</span>
      </div>

      <div className="page-header">
        <div>
          <h1>Payslip — {slip.employeeName}</h1>
          <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
            <span className={`badge ${statusBadge(slip.status)}`}>{slip.status}</span>
            <span style={{ fontSize: 13, color: 'var(--gray-400)' }}>{slip.period} • {slip.structure}</span>
          </div>
        </div>
        <button className="btn btn-secondary" onClick={handlePrint}>
          <Printer size={14} /> Print Payslip
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body">
          <div className="form-grid">
            <div className="form-group">
              <label>Employee</label>
              <input className="form-control" value={slip.employeeName} disabled />
            </div>
            <div className="form-group">
              <label>Pay Run</label>
              <input className="form-control" value={slip.payrunName} disabled />
            </div>
            <div className="form-group">
              <label>Salary Structure</label>
              <input className="form-control" value={slip.structure} disabled />
            </div>
            <div className="form-group">
              <label>Period</label>
              <input className="form-control" value={slip.period} disabled />
            </div>
            <div className="form-group">
              <label>Status</label>
              <input className="form-control" value={slip.status} disabled />
            </div>
            <div className="form-group">
              <label>Worked Days</label>
              <input className="form-control" value={slip.workedDays} disabled />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Salary Computation</h3>
        </div>
        {slip.lines && slip.lines.length > 0 ? (
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
                {categories.map(cat => {
                  const catLines = slip.lines.filter(l => l.category === cat);
                  if (catLines.length === 0) return null;
                  return [
                    <tr key={`cat-${cat}`} className="category-row">
                      <td colSpan={4}>{cat}</td>
                    </tr>,
                    ...catLines.map(line => (
                      <tr key={line.code}>
                        <td style={{ paddingLeft: 28 }}>{line.name}</td>
                        <td className="font-mono" style={{ color: 'var(--gray-500)' }}>{line.code}</td>
                        <td style={{ color: 'var(--gray-500)' }}>{line.category}</td>
                        <td style={{ textAlign: 'right', fontWeight: 500, color: line.amount < 0 ? 'var(--danger)' : 'var(--gray-800)' }}>
                          {line.amount < 0 ? `(${Math.abs(line.amount).toLocaleString('en-IN')})` : line.amount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    )),
                  ];
                })}
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
