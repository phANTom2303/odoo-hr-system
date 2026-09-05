import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { getSalaryStructures, getSalaryRulesByStructure } from '../../api/salary';

export default function SalaryRules() {
  const navigate = useNavigate();
  const [search, setSearch]       = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [structureId, setStructureId] = useState('');

  const { data: structures = [] } = useQuery({
    queryKey: ['salary-structures'],
    queryFn: () => getSalaryStructures().then(r => r.data),
  });

  // Default to first structure
  const activeStructureId = structureId || structures[0]?.id;

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['salary-rules', activeStructureId],
    queryFn: () => getSalaryRulesByStructure(activeStructureId).then(r => r.data),
    enabled: !!activeStructureId,
  });

  const filtered = rules
    .filter(r => {
      const matchSearch = r.name.toLowerCase().includes(search.toLowerCase()) || r.code.toLowerCase().includes(search.toLowerCase());
      const matchCat    = filterCat ? r.category === filterCat : true;
      return matchSearch && matchCat;
    })
    .sort((a, b) => a.sequence - b.sequence);

  const cats = [...new Set(rules.map(r => r.category))];

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-breadcrumb">Payroll ▸ <span>Salary Rules</span></div>
          <h1>Salary Rules</h1>
        </div>
        {activeStructureId && (
          <button className="btn btn-primary" onClick={() => navigate(`/salary/rules/new?structure=${activeStructureId}`)}>
            <Plus size={15} /> New Rule
          </button>
        )}
      </div>

      <div className="toolbar">
        <div className="search-bar">
          <Search size={14} color="var(--gray-400)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search rules…" />
        </div>
        <select className="filter-select" value={structureId} onChange={e => setStructureId(e.target.value)}>
          {structures.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="filter-select" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="">All Categories</option>
          {cats.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Seq</th><th>Name</th><th>Code</th><th>Category</th><th>Type</th><th>Value</th></tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-400)' }}>Loading…</td></tr>
              ) : filtered.map(r => (
                <tr key={r.id} onClick={() => navigate(`/salary/rules/${r.id}`)}>
                  <td style={{ color: 'var(--gray-400)' }}>{r.sequence}</td>
                  <td style={{ fontWeight: 500 }}>{r.name}</td>
                  <td className="font-mono">{r.code}</td>
                  <td>
                    <span className={`badge ${
                      r.category === 'net'       ? 'badge-green'  :
                      r.category === 'gross'     ? 'badge-blue'   :
                      r.category === 'deduction' ? 'badge-red'    :
                      r.category === 'allowance' ? 'badge-yellow' : 'badge-gray'
                    }`}>{r.category}</span>
                  </td>
                  <td>{r.rule_type}</td>
                  <td style={{ color: 'var(--gray-500)' }}>
                    {r.rule_type === 'fixed' ? `₹ ${r.fixed_amount}` : `${r.percentage}% of ${r.base_rule_code ?? '—'}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 20px', fontSize: 12, color: 'var(--gray-400)' }}>
          Rule order matters — sequence controls the calculation order.
        </div>
      </div>
    </div>
  );
}
