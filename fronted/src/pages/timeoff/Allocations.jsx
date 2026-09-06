import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAllocations, approveAllocation, refuseAllocation } from '../../api/allocations';
import { useApp } from '../../context/AppContext';

export default function Allocations() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentUser } = useApp();
  const [searchParams] = useSearchParams();
  const empFilter = searchParams.get('employee');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const isHR = ['admin', 'hr_manager', 'hr_payroll_user', 'hr_payroll_manager'].includes(currentUser?.role);

  // Employees only see their own allocations
  const { data, isLoading, isError } = useQuery({
    queryKey: ['allocations', { empFilter, statusFilter }],
    queryFn: () => getAllocations({
      employee_id: isHR ? (empFilter || undefined) : currentUser?.id,
      status: statusFilter || undefined,
    }).then(r => r.data),
  });

  const allocations = data ?? [];

  const filtered = allocations.filter(a =>
    a.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
    a.time_off_type_name?.toLowerCase().includes(search.toLowerCase())
  );

  const approveMutation = useMutation({
    mutationFn: (id) => approveAllocation(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['allocations'] }),
  });

  const refuseMutation = useMutation({
    mutationFn: (id) => refuseAllocation(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['allocations'] }),
  });

  const statusBadge = (s) => {
    if (s === 'approved') return 'badge-green';
    if (s === 'draft')    return 'badge-yellow';
    if (s === 'refused')  return 'badge-red';
    if (s === 'expired')  return 'badge-gray';
    return 'badge-gray';
  };

  if (isLoading) return <div className="page-header"><p>Loading allocations…</p></div>;
  if (isError)   return <div className="page-header"><p style={{ color: 'var(--danger)' }}>Failed to load allocations.</p></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-breadcrumb">Time Off ▸ <span>Allocations</span></div>
          <h1>Allocations</h1>
        </div>
        {isHR && (
          <button className="btn btn-primary" onClick={() => navigate('/timeoff/allocations/new')}>
            <Plus size={15} /> New
          </button>
        )}
      </div>

      <div className="toolbar">
        <div className="search-bar">
          <Search size={14} color="var(--gray-400)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search allocations…" />
        </div>
        <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="approved">Approved</option>
          <option value="refused">Refused</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {isHR && <th>Employee</th>}
                <th>Type</th>
                <th>Allocated</th>
                <th>Taken</th>
                <th>Remaining</th>
                <th>Valid From</th>
                <th>Valid To</th>
                <th>Status</th>
                {isHR && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id}>
                  {isHR && <td style={{ fontWeight: 500 }} onClick={() => navigate(`/timeoff/allocations/${a.id}`)}>{a.employee_name}</td>}
                  <td onClick={() => navigate(`/timeoff/allocations/${a.id}`)}>{a.time_off_type_name}</td>
                  <td onClick={() => navigate(`/timeoff/allocations/${a.id}`)}>{a.allocated_amount} {a.time_off_unit}</td>
                  <td onClick={() => navigate(`/timeoff/allocations/${a.id}`)}>{a.taken} {a.time_off_unit}</td>
                  <td
                    onClick={() => navigate(`/timeoff/allocations/${a.id}`)}
                    style={{ fontWeight: 600, color: Number(a.remaining) > 3 ? 'var(--success)' : 'var(--warning)' }}>
                    {a.remaining} {a.time_off_unit}
                  </td>
                  <td onClick={() => navigate(`/timeoff/allocations/${a.id}`)}>{a.start_date?.slice(0, 10)}</td>
                  <td onClick={() => navigate(`/timeoff/allocations/${a.id}`)}>{a.end_date?.slice(0, 10)}</td>
                  <td><span className={`badge ${statusBadge(a.status)}`}>{a.status}</span></td>
                  {isHR && (
                    <td>
                      {a.status === 'draft' && (
                        <div className="d-flex gap-2">
                          <button className="btn btn-success btn-sm" onClick={() => approveMutation.mutate(a.id)}>Approve</button>
                          <button className="btn btn-danger btn-sm" onClick={() => refuseMutation.mutate(a.id)}>Refuse</button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={isHR ? 9 : 7} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 24 }}>No allocations found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 20px', fontSize: 12, color: 'var(--gray-400)' }}>
          Approved allocations create available leave balance for employees.
        </div>
      </div>
    </div>
  );
}
