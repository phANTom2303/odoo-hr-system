import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Check, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function TimeOffRequests() {
  const { timeOffRequests, approveRequest, refuseRequest } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const empFilter = params.get('employee');
  const [search, setSearch] = useState('');

  const filtered = timeOffRequests.filter(r => {
    const matchEmp = empFilter ? r.employeeId === Number(empFilter) : true;
    const matchSearch = r.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      r.typeName.toLowerCase().includes(search.toLowerCase());
    return matchEmp && matchSearch;
  });

  const statusBadge = (s) => {
    if (s === 'Approved')   return 'badge-green';
    if (s === 'Refused')    return 'badge-red';
    if (s === 'To Approve') return 'badge-yellow';
    return 'badge-gray';
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-breadcrumb">Time Off ▸ <span>Requests</span></div>
          <h1>Time Off Requests</h1>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/timeoff/requests/new')}>
          <Plus size={15} /> New
        </button>
      </div>

      <div className="toolbar">
        <div className="search-bar">
          <Search size={14} color="var(--gray-400)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search requests…" />
        </div>
        <button className="btn btn-secondary btn-sm">My Team</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th>Start</th>
                <th>End</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 500 }} onClick={() => navigate(`/timeoff/requests/${r.id}`)}>{r.employeeName}</td>
                  <td onClick={() => navigate(`/timeoff/requests/${r.id}`)}>{r.typeName}</td>
                  <td onClick={() => navigate(`/timeoff/requests/${r.id}`)}>{r.startDate}</td>
                  <td onClick={() => navigate(`/timeoff/requests/${r.id}`)}>{r.endDate}</td>
                  <td onClick={() => navigate(`/timeoff/requests/${r.id}`)}>{r.duration} Day{r.duration > 1 ? 's' : ''}</td>
                  <td><span className={`badge ${statusBadge(r.status)}`}>{r.status}</span></td>
                  <td>
                    {r.status === 'To Approve' || r.status === 'Draft' ? (
                      <div className="d-flex gap-2">
                        <button className="btn btn-success btn-sm" onClick={() => approveRequest(r.id)}>
                          <Check size={12} /> Approve
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => refuseRequest(r.id)}>
                          <X size={12} /> Refuse
                        </button>
                      </div>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 20px', fontSize: 12, color: 'var(--gray-400)' }}>
          Request status shows the approval lifecycle clearly.
        </div>
      </div>
    </div>
  );
}
