import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { getSalaryStructures } from '../../api/salary';

export default function SalaryStructures() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['salary-structures'],
    queryFn: () => getSalaryStructures().then(r => r.data),
  });

  const structures = (data ?? []).filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  if (isLoading) return <div className="page-header"><p>Loading…</p></div>;
  if (isError)   return <div className="page-header"><p style={{ color: 'var(--danger)' }}>Failed to load salary structures.</p></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-breadcrumb">Payroll ▸ <span>Salary Structures</span></div>
          <h1>Salary Structures</h1>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/salary/structures/new')}>
          <Plus size={15} /> New Structure
        </button>
      </div>

      <div className="toolbar">
        <div className="search-bar">
          <Search size={14} color="var(--gray-400)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search structures…" />
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Structure Name</th><th>Rules</th><th>Active Employees</th><th>Status</th></tr>
            </thead>
            <tbody>
              {structures.map(s => (
                <tr key={s.id} onClick={() => navigate(`/salary/structures/${s.id}`)}>
                  <td style={{ fontWeight: 500 }}>{s.name}</td>
                  <td>{s.rule_count}</td>
                  <td>{s.employee_count}</td>
                  <td><span className={`badge ${s.status === 'active' ? 'badge-green' : 'badge-gray'}`}>{s.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 20px', fontSize: 12, color: 'var(--gray-400)' }}>
          Structures group salary rules. The selected structure on a Pay Run determines which rules calculate each payslip.
        </div>
      </div>
    </div>
  );
}
