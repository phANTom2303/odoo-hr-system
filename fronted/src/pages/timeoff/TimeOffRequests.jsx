import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Check, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getLeaveRequests, approveLeaveRequest, refuseLeaveRequest } from '../../api/leaveRequests';
import { useApp } from '../../context/AppContext';

export default function TimeOffRequests() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentUser } = useApp();
  const [searchParams] = useSearchParams();
  const empFilter = searchParams.get('employee');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const isHR = ['admin', 'hr_manager', 'hr_payroll_user', 'hr_payroll_manager'].includes(currentUser?.role);

  // Employees only see their own requests
  const { data, isLoading, isError } = useQuery({
    queryKey: ['leave-requests', { empFilter, statusFilter }],
    queryFn: () => getLeaveRequests({
      employee_id: isHR ? (empFilter || undefined) : currentUser?.id,
      status: statusFilter || undefined,
    }).then(r => r.data),
  });

  const requests = data ?? [];

  const filtered = requests.filter(r =>
    r.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.time_off_type_name?.toLowerCase().includes(search.toLowerCase())
  );

  const approveMutation = useMutation({
    mutationFn: (id) => approveLeaveRequest(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leave-requests'] }),
  });

  const refuseMutation = useMutation({
    mutationFn: (id) => refuseLeaveRequest(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leave-requests'] }),
  });

  const statusBadge = (s) => {
    if (s === 'approved')  return 'badge-green';
    if (s === 'refused')   return 'badge-red';
    if (s === 'pending')   return 'badge-yellow';
    if (s === 'withdrawn') return 'badge-gray';
    return 'badge-gray';
  };

  if (isLoading) return <div className="page-header"><p>Loading requests…</p></div>;
  if (isError)   return <div className="page-header"><p style={{ color: 'var(--danger)' }}>Failed to load requests.</p></div>;

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
        {isHR && (
          <div className="search-bar">
            <Search size={14} color="var(--gray-400)" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search requests…" />
          </div>
        )}
        <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="refused">Refused</option>
          <option value="withdrawn">Withdrawn</option>
        </select>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {isHR && <th>Employee</th>}
                <th>Type</th>
                <th>Start</th>
                <th>End</th>
                <th>Days</th>
                <th>Status</th>
                {isHR && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  {isHR && <td style={{ fontWeight: 500 }} onClick={() => navigate(`/timeoff/requests/${r.id}`)}>{r.employee_name}</td>}
                  <td onClick={() => navigate(`/timeoff/requests/${r.id}`)}>{r.time_off_type_name}</td>
                  <td onClick={() => navigate(`/timeoff/requests/${r.id}`)}>{r.start_date?.slice(0, 10)}</td>
                  <td onClick={() => navigate(`/timeoff/requests/${r.id}`)}>{r.end_date?.slice(0, 10)}</td>
                  <td onClick={() => navigate(`/timeoff/requests/${r.id}`)}>{r.number_of_days ?? '—'}</td>
                  <td><span className={`badge ${statusBadge(r.status)}`}>{r.status}</span></td>
                  {isHR && (
                    <td>
                      {(r.status === 'draft' || r.status === 'pending') && (
                        <div className="d-flex gap-2">
                          <button className="btn btn-success btn-sm" onClick={() => approveMutation.mutate(r.id)}>
                            <Check size={12} /> Approve
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => refuseMutation.mutate(r.id)}>
                            <X size={12} /> Refuse
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={isHR ? 7 : 5} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 24 }}>No requests found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 20px', fontSize: 12, color: 'var(--gray-400)' }}>
          {filtered.length} request{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}
