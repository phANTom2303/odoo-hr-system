import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import {
  getSalaryRuleById, updateSalaryRule, createSalaryRule,
  getSalaryStructures, getSalaryRulesByStructure,
} from '../../api/salary';

export default function SalaryRuleForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = id === 'new';

  const defaultStructureId = searchParams.get('structure') || '';

  const [editing, setEditing] = useState(isNew);
  const EMPTY = { code: '', name: '', category: 'basic', sequence: 10, rule_type: 'fixed', fixed_amount: 0, percentage: null, base_rule_id: null, structure_id: defaultStructureId };
  const [form, setForm] = useState(EMPTY);
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const { data: rule, isLoading } = useQuery({
    queryKey: ['salary-rule', id],
    queryFn: () => getSalaryRuleById(id).then(r => r.data),
    enabled: !isNew,
  });

  useEffect(() => { if (rule) setForm({ ...rule, structure_id: rule.structure_id }); }, [rule]);

  const { data: structures = [] } = useQuery({
    queryKey: ['salary-structures'],
    queryFn: () => getSalaryStructures().then(r => r.data),
  });

  const activeStructureId = form.structure_id || defaultStructureId || structures[0]?.id;

  const { data: siblingRules = [] } = useQuery({
    queryKey: ['salary-rules', activeStructureId],
    queryFn: () => getSalaryRulesByStructure(activeStructureId).then(r => r.data),
    enabled: !!activeStructureId,
  });

  const createMutation = useMutation({
    mutationFn: ({ structure_id, ...data }) => createSalaryRule(structure_id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['salary-rules'] }); navigate('/salary/rules'); },
  });

  const updateMutation = useMutation({
    mutationFn: updateSalaryRule,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['salary-rules'] }); queryClient.invalidateQueries({ queryKey: ['salary-rule', id] }); setEditing(false); },
  });

  const save = () => {
    if (isNew) createMutation.mutate({ ...form, structure_id: activeStructureId });
    else       updateMutation.mutate({ id: Number(id), ...form });
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const error     = createMutation.error?.message || updateMutation.error?.message;

  if (!isNew && isLoading) return <div><p>Loading…</p></div>;

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
              <button className="btn btn-primary" onClick={save} disabled={isPending}>{isPending ? 'Saving…' : 'Save'}</button>
            </>
          )}
        </div>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="card">
        <div className="card-body">
          <div className="form-grid">
            {isNew && (
              <div className="form-group">
                <label>Salary Structure <span className="req">*</span></label>
                <select className="form-control" value={form.structure_id || ''} disabled={!editing}
                  onChange={e => setField('structure_id', e.target.value)}>
                  {structures.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            <div className="form-group">
              <label>Rule Name <span className="req">*</span></label>
              <input className="form-control" value={form.name} disabled={!editing} onChange={e => setField('name', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Code <span className="req">*</span></label>
              <input className="form-control" value={form.code} disabled={!editing}
                onChange={e => setField('code', e.target.value.toUpperCase())} placeholder="BASIC" />
            </div>
            <div className="form-group">
              <label>Category</label>
              <select className="form-control" value={form.category} disabled={!editing} onChange={e => setField('category', e.target.value)}>
                {['basic','allowance','gross','deduction','net'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Sequence</label>
              <input className="form-control" type="number" value={form.sequence} disabled={!editing}
                onChange={e => setField('sequence', Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label>Computation Type</label>
              <select className="form-control" value={form.rule_type} disabled={!editing} onChange={e => setField('rule_type', e.target.value)}>
                <option value="fixed">Fixed</option>
                <option value="percentage">Percentage</option>
              </select>
            </div>
            {form.rule_type === 'fixed' && (
              <div className="form-group">
                <label>Fixed Amount (₹)</label>
                <input className="form-control" type="number" value={form.fixed_amount ?? 0} disabled={!editing}
                  onChange={e => setField('fixed_amount', Number(e.target.value))} />
              </div>
            )}
            {form.rule_type === 'percentage' && (
              <>
                <div className="form-group">
                  <label>Percentage (%)</label>
                  <input className="form-control" type="number" value={form.percentage ?? ''} disabled={!editing}
                    onChange={e => setField('percentage', Number(e.target.value))} />
                </div>
                <div className="form-group">
                  <label>Base Rule</label>
                  <select className="form-control" value={form.base_rule_id ?? ''} disabled={!editing}
                    onChange={e => setField('base_rule_id', Number(e.target.value) || null)}>
                    <option value="">— Select —</option>
                    {siblingRules
                      .filter(r => r.id !== Number(id))
                      .map(r => <option key={r.id} value={r.id}>{r.name} ({r.code})</option>)}
                  </select>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
