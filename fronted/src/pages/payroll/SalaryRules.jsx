import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function SalaryRules() {
  const { salaryRules } = useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');

  const filtered = salaryRules.filter(r => {
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase()) || r.code.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat ? r.category === filterCat : true;
    return matchSearch && matchCat;
  }).sort((a, b) => a.sequence - b.sequence);

  const cats = [...new Set(salaryRules.map(r => r.category))];

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-breadcrumb">Payroll ▸ <span>Salary Rules</span></div>
          <h1>Salary Rules</h1>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/salary/rules/new')}>
          <Plus size={15} /> New Rule
        </button>
      </div>

      <div className="toolbar">
        <div className="search-bar">
          <Search size={14} color="var(--gray-400)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search rules…" />
        </div>
        <select className="filter-select" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="">All Categories</option>
          {cats.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Seq</th>
                <th>Name</th>
                <th>Code</th>
                <th>Category</th>
                <th>Structure</th>
                <th>Computation</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} onClick={() => navigate(`/salary/rules/${r.id}`)}>
                  <td style={{ color: 'var(--gray-400)' }}>{r.sequence}</td>
                  <td style={{ fontWeight: 500 }}>{r.name}</td>
                  <td className="font-mono">{r.code}</td>
                  <td>
                    <span className={`badge ${
                      r.category === 'Net'       ? 'badge-green'  :
                      r.category === 'Gross'     ? 'badge-blue'   :
                      r.category === 'Deduction' ? 'badge-red'    :
                      r.category === 'Allowance' ? 'badge-yellow' :
                      'badge-gray'
                    }`}>{r.category}</span>
                  </td>
                  <td>{r.structure}</td>
                  <td>{r.computation}</td>
                  <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--gray-500)' }}>{r.value}</td>
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
