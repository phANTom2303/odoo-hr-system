import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function SalaryStructureForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { salaryStructures, setSalaryStructures, salaryRules } = useApp();

  const isNew = id === 'new';
  const existing = isNew ? null : salaryStructures.find(s => s.id === Number(id));

  const [form, setForm] = useState(existing || { name: '', rules: 0, employees: 0, status: 'Active' });
  const [editing, setEditing] = useState(isNew);

  const structureRules = salaryRules.filter(r => r.structure === (existing?.name || form.name)).sort((a, b) => a.sequence - b.sequence);

  const save = () => {
    if (isNew) {
      setSalaryStructures(prev => [...prev, { ...form, id: Date.now(), rules: 0, employees: 0 }]);
      navigate('/salary/structures');
    } else {
      setSalaryStructures(prev => prev.map(s => s.id === Number(id) ? { ...s, ...form } : s));
      setEditing(false);
    }
  };

  if (!isNew && !existing) return <div><p>Structure not found.</p></div>;

  return (
    <div>
      <div className="page-breadcrumb" style={{ marginBottom: 8 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/salary/structures')}>
          <ArrowLeft size={14} /> Salary Structures
        </button>
        <span> / {isNew ? 'New' : form.name}</span>
      </div>

      <div className="page-header">
        <h1>{isNew ? 'New Salary Structure' : form.name}</h1>
        <div className="d-flex gap-2">
          {!isNew && !editing && <button className="btn btn-secondary" onClick={() => setEditing(true)}>Edit</button>}
          {(editing || isNew) && (
            <>
              <button className="btn btn-secondary" onClick={() => isNew ? navigate('/salary/structures') : setEditing(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>Save</button>
            </>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body">
          <div className="form-grid">
            <div className="form-group">
              <label>Structure Name <span className="req">*</span></label>
              <input className="form-control" value={form.name} disabled={!editing} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select className="form-control" value={form.status} disabled={!editing} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option>Active</option><option>Inactive</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {!isNew && structureRules.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3>Salary Rules ({structureRules.length})</h3>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Seq</th><th>Name</th><th>Code</th><th>Category</th><th>Computation</th></tr>
              </thead>
              <tbody>
                {structureRules.map(r => (
                  <tr key={r.id} onClick={() => navigate(`/salary/rules/${r.id}`)}>
                    <td style={{ color: 'var(--gray-400)' }}>{r.sequence}</td>
                    <td style={{ fontWeight: 500 }}>{r.name}</td>
                    <td className="font-mono">{r.code}</td>
                    <td>{r.category}</td>
                    <td>{r.computation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
