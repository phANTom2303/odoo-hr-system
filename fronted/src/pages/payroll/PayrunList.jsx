import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function PayrunList() {
  const { payruns } = useApp();
  const navigate = useNavigate();
  const [showWizard, setShowWizard] = useState(false);

  const statusBadge = (s) => {
    if (s === 'Paid')      return 'badge-green';
    if (s === 'Validated') return 'badge-blue';
    if (s === 'Draft')     return 'badge-gray';
    return 'badge-yellow';
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-breadcrumb">Payroll ▸ <span>Pay Runs</span></div>
          <h1>Pay Runs</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setShowWizard(true)}>
          <Plus size={15} /> New Pay Run
        </button>
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
              {payruns.map(p => (
                <tr key={p.id} onClick={() => navigate(`/payroll/runs/${p.id}`)}>
                  <td className="font-mono" style={{ fontWeight: 600 }}>{p.name}</td>
                  <td>{p.structure}</td>
                  <td>{p.period}</td>
                  <td>{p.employeeCount}</td>
                  <td>₹ {p.totalNet.toLocaleString('en-IN')}</td>
                  <td><span className={`badge ${statusBadge(p.status)}`}>{p.status}</span></td>
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
  const { salaryStructures, employees, setPayruns, setPayslips, payslips, salaryRules } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ structure: 'Employee Salary', period: '2026-10', periodLabel: 'Oct 2026' });
  const [selected, setSelected] = useState([]);

  const toggle = (id) => setSelected(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const create = () => {
    const name = `PR/${form.periodLabel.split(' ')[1]}/${form.periodLabel.split(' ')[0].slice(0,3).toUpperCase()}`;
    const newId = Date.now();
    setPayruns(prev => prev.map(p => p.status === 'Draft' ? { ...p, status: 'Draft' } : p).concat([{
      id: newId,
      name,
      structure: form.structure,
      period: form.periodLabel,
      status: 'Draft',
      employeeCount: selected.length,
      totalNet: 0,
    }]));
    // Create draft payslips
    const newSlips = selected.map(empId => {
      const emp = employees.find(e => e.id === empId);
      return {
        id: Date.now() + empId,
        payrunId: newId,
        payrunName: name,
        employeeId: empId,
        employeeName: emp?.name || '',
        structure: form.structure,
        period: form.periodLabel,
        status: 'Draft',
        workedDays: 22,
        lines: [],
      };
    });
    setPayslips(prev => [...prev, ...newSlips]);
    onClose();
    navigate(`/payroll/runs`);
  };

  const months = [
    'Jan 2026','Feb 2026','Mar 2026','Apr 2026','May 2026','Jun 2026',
    'Jul 2026','Aug 2026','Sep 2026','Oct 2026','Nov 2026','Dec 2026',
  ];

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
                <select className="form-control" value={form.structure} onChange={e => setForm(f => ({ ...f, structure: e.target.value }))}>
                  {salaryStructures.filter(s => s.status === 'Active').map(s => <option key={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Payroll Period <span className="req">*</span></label>
                <select className="form-control" value={form.periodLabel} onChange={e => setForm(f => ({ ...f, periodLabel: e.target.value }))}>
                  {months.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 12 }}>
                Select employees to include in this pay run:
              </p>
              {employees.filter(e => e.status === 'Active').map(emp => (
                <label key={emp.id} className="checkbox-row">
                  <input type="checkbox" checked={selected.includes(emp.id)} onChange={() => toggle(emp.id)} />
                  <div>
                    <div style={{ fontWeight: 500 }}>{emp.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{emp.jobTitle} • {emp.department}</div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          {step === 1 && (
            <button className="btn btn-primary" onClick={() => setStep(2)}>Continue →</button>
          )}
          {step === 2 && (
            <>
              <button className="btn btn-secondary" onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn-primary" disabled={selected.length === 0} onClick={create}>
                Create Pay Run ({selected.length} employees)
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
