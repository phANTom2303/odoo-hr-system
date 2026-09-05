import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function SalaryRuleForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { salaryRules, setSalaryRules, salaryStructures } = useApp();

  const isNew = id === 'new';
  const existing = isNew ? null : salaryRules.find(r => r.id === Number(id));

  const [form, setForm] = useState(existing || {
    name: '', code: '', category: 'Basic', structure: 'Employee Salary',
    sequence: 10, computation: 'Fixed', value: '', formula: '',
  });
  const [editing, setEditing] = useState(isNew);
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = () => {
    if (isNew) {
      setSalaryRules(prev => [...prev, { ...form, id: Date.now(), sequence: Number(form.sequence) }]);
      navigate('/salary/rules');
    } else {
      setSalaryRules(prev => prev.map(r => r.id === Number(id) ? { ...r, ...form } : r));
      setEditing(false);
    }
  };

  if (!isNew && !existing) return <div><p>Rule not found.</p></div>;

  return (
    <div>
      <div className="page-breadcrumb" style={{ marginBottom: 8 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/salary/rules')}>
          <ArrowLeft size={14} /> Salary Rules
        </button>
        <span> / {isNew ? 'New Rule' : form.name}</span>
      </div>

      <div className="page-header">
        <h1>{isNew ? 'New Salary Rule' : form.name}</h1>
        <div className="d-flex gap-2">
          {!isNew && !editing && <button className="btn btn-secondary" onClick={() => setEditing(true)}>Edit</button>}
          {(editing || isNew) && (
            <>
              <button className="btn btn-secondary" onClick={() => isNew ? navigate('/salary/rules') : setEditing(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>Save</button>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="form-grid">
            <div className="form-group">
              <label>Rule Name <span className="req">*</span></label>
              <input className="form-control" value={form.name} disabled={!editing} onChange={e => setField('name', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Code <span className="req">*</span></label>
              <input className="form-control" value={form.code} disabled={!editing} onChange={e => setField('code', e.target.value.toUpperCase())} placeholder="BASIC" />
            </div>
            <div className="form-group">
              <label>Category</label>
              <select className="form-control" value={form.category} disabled={!editing} onChange={e => setField('category', e.target.value)}>
                {['Basic','Allowance','Gross','Deduction','Net'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Sequence</label>
              <input className="form-control" type="number" value={form.sequence} disabled={!editing} onChange={e => setField('sequence', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Salary Structure</label>
              <select className="form-control" value={form.structure} disabled={!editing} onChange={e => setField('structure', e.target.value)}>
                {salaryStructures.map(s => <option key={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Computation Method</label>
              <select className="form-control" value={form.computation} disabled={!editing} onChange={e => setField('computation', e.target.value)}>
                <option>Fixed</option>
                <option>Percentage</option>
                <option>Formula</option>
              </select>
            </div>
            <div className="form-group span-2">
              <label>Value / Expression</label>
              <input className="form-control" value={form.value} disabled={!editing} onChange={e => setField('value', e.target.value)}
                placeholder={form.computation === 'Fixed' ? 'e.g. ₹ 2,000' : form.computation === 'Percentage' ? 'e.g. 20% of Basic Salary' : 'e.g. BASIC + HRA + SPCL'} />
            </div>
            {form.computation === 'Formula' && (
              <div className="form-group span-2">
                <label>Python Expression</label>
                <textarea className="form-control" value={form.formula} disabled={!editing} onChange={e => setField('formula', e.target.value)}
                  placeholder="result = categories['BASIC'] + categories['HRA']" style={{ fontFamily: 'monospace' }} />
              </div>
            )}
          </div>

          <div className="divider" />
          <div style={{ fontSize: 12, color: 'var(--gray-400)', lineHeight: 1.6 }}>
            <strong>Computation Notes:</strong><br />
            • <strong>Fixed Amount</strong>: uses the exact value entered (e.g. Meal Allowance = ₹2,000).<br />
            • <strong>Percentage</strong>: calculates as a % of a base (e.g. HRA = 20% × Basic Salary).<br />
            • <strong>Formula</strong>: Python code for advanced calculations using rule values.
          </div>
        </div>
      </div>
    </div>
  );
}
