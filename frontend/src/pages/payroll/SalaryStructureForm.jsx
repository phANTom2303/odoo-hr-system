import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { getSalaryStructureById, createSalaryStructure, updateSalaryStructure } from '../../api/salary';

export default function SalaryStructureForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = id === 'new';

  const [editing, setEditing] = useState(isNew);
  const [form, setForm] = useState({ name: '', status: 'active' });

  const { data: structure, isLoading } = useQuery({
    queryKey: ['salary-structure', id],
    queryFn: () => getSalaryStructureById(id).then(r => r.data),
    enabled: !isNew,
  });

  useEffect(() => { if (structure) setForm({ name: structure.name, status: structure.status }); }, [structure]);

  const createMutation = useMutation({
    mutationFn: createSalaryStructure,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['salary-structures'] }); navigate('/salary/structures'); },
  });

  const updateMutation = useMutation({
    mutationFn: updateSalaryStructure,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['salary-structures'] }); queryClient.invalidateQueries({ queryKey: ['salary-structure', id] }); setEditing(false); },
  });

  const save = () => {
    if (isNew) createMutation.mutate(form);
    else       updateMutation.mutate({ id: Number(id), ...form });
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const error     = createMutation.error?.message || updateMutation.error?.message;

  if (!isNew && isLoading) return <div><p>Loading…</p></div>;

  const rules = structure?.rules ?? [];

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
              <button className="btn btn-primary" onClick={save} disabled={isPending}>{isPending ? 'Saving…' : 'Save'}</button>
            </>
          )}
        </div>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body">
          <div className="form-grid">
            <div className="form-group">
              <label>Structure Name <span className="req">*</span></label>
              <input className="form-control" value={form.name} disabled={!editing}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select className="form-control" value={form.status} disabled={!editing}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="active">Active</option><option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {!isNew && rules.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3>Salary Rules ({rules.length})</h3>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Seq</th><th>Name</th><th>Code</th><th>Category</th><th>Type</th></tr>
              </thead>
              <tbody>
                {rules.map(r => (
                  <tr key={r.id} onClick={() => navigate(`/salary/rules/${r.id}`)}>
                    <td style={{ color: 'var(--gray-400)' }}>{r.sequence}</td>
                    <td style={{ fontWeight: 500 }}>{r.name}</td>
                    <td className="font-mono">{r.code}</td>
                    <td>{r.category}</td>
                    <td>{r.rule_type}</td>
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
