import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getContracts } from '../../api/contracts';

export default function ContractList() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const empFilter = params.get('employee');
    const [search, setSearch] = useState('');

    const { data: contracts = [], isLoading, isError, error } = useQuery({
        queryKey: ['contracts', { empFilter }],
        queryFn: () => getContracts(empFilter ? { employee_id: empFilter } : {}),
    });

    const searchTerm = search.toLowerCase();
    const allContracts = contracts.data ?? [];
    const filtered = allContracts.filter(c => {
        if (searchTerm.length >= 1) {
            return c.employee_name?.toLowerCase().includes(searchTerm) ||
                String(c.id).includes(searchTerm);
        }
        return true;
    });

    const statusBadge = (s) => {
        if (s === 'Running') return 'badge-green';
        if (s === 'Expired') return 'badge-gray';
        return 'badge-yellow';
    };

    if (isLoading) return <div style={{ padding: 20 }}>Loading contracts...</div>;
    if (isError) return <div style={{ padding: 20, color: 'red' }}>Error loading contracts: {error.message}</div>;

    return (
        <div>
            <div className="page-header">
                <div>
                    <div className="page-breadcrumb">Employees ▸ <span>Contracts</span></div>
                    <h1>Contracts</h1>
                </div>
                <button className="btn btn-primary" onClick={() => navigate('/contracts/new')}>
                    <Plus size={15} /> New
                </button>
            </div>

            <div className="toolbar">
                <div className="search-bar">
                    <Search size={14} color="var(--gray-400)" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contracts…" />
                </div>
            </div>

            <div className="card">
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Contract</th>
                                <th>Employee</th>
                                <th>Start</th>
                                <th>End</th>
                                <th>Wage / Month</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(c => (
                                <tr key={c.id} onClick={() => navigate(`/contracts/${c.id}`)}>
                                    <td className="font-mono" style={{ fontWeight: 500 }}>#{c.id}</td>
                                    <td>{c.employee_name}</td>
                                    <td>{c.start_date?.slice(0, 10)}</td>
                                    <td>{c.end_date?.slice(0, 10) || '—'}</td>
                                    <td>—</td>
                                    <td><span className={`badge ${statusBadge(c.status)}`}>{c.status}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div style={{ padding: '10px 20px', fontSize: 12, color: 'var(--gray-400)' }}>
                    Retain contract history, but the active Running contract is used for payroll.
                </div>
            </div>
        </div>
    );
}
