import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function TimeOffTypes() {
  const { timeOffTypes } = useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const filtered = timeOffTypes.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-breadcrumb">Time Off ▸ <span>Time Off Types</span></div>
          <h1>Time Off Types</h1>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/timeoff/types/new')}>
          <Plus size={15} /> New
        </button>
      </div>

      <div className="toolbar">
        <div className="search-bar">
          <Search size={14} color="var(--gray-400)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search time off types…" />
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Unit</th>
                <th>Allocation</th>
                <th>Approval</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} onClick={() => navigate(`/timeoff/types/${t.id}`)}>
                  <td style={{ fontWeight: 500 }}>{t.name}</td>
                  <td>{t.unit}</td>
                  <td>{t.requiresAllocation}</td>
                  <td>{t.approval}</td>
                  <td><span className={`badge ${t.status === 'Active' ? 'badge-green' : 'badge-gray'}`}>{t.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 20px', fontSize: 12, color: 'var(--gray-400)' }}>
          This list defines policy rules, not employee transactions.
        </div>
      </div>
    </div>
  );
}
