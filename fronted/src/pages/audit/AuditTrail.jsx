import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { getAuditLogs } from '../../api/audit';

const ACTION_BADGE = {
  INSERT: 'badge-green',
  UPDATE: 'badge-yellow',
  DELETE: 'badge-red',
};

const formatTimestamp = (ts) =>
  new Date(ts).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  });

/** Diffs two flat JSON objects into { key, before, after } rows for UPDATE rows. */
function diffRows(oldData, newData) {
  const keys = Array.from(new Set([...Object.keys(oldData ?? {}), ...Object.keys(newData ?? {})])).sort();
  return keys.map((key) => ({
    key,
    before: oldData ? oldData[key] : undefined,
    after: newData ? newData[key] : undefined,
    changed: JSON.stringify(oldData?.[key]) !== JSON.stringify(newData?.[key]),
  }));
}

function ChangesModal({ log, onClose }) {
  const isUpdate = log.action === 'UPDATE';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: isUpdate ? 720 : 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            {log.action} — {log.table_name} #{log.record_id}
          </h3>
          <button className="btn-ghost btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 12 }}>
            {formatTimestamp(log.changed_at)}
          </div>

          {isUpdate ? (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Before</th>
                    <th>After</th>
                  </tr>
                </thead>
                <tbody>
                  {diffRows(log.old_data, log.new_data).map((row) => (
                    <tr key={row.key} style={row.changed ? { background: 'var(--warning-light)' } : undefined}>
                      <td style={{ fontWeight: 500 }}>{row.key}</td>
                      <td className="text-muted"><code>{JSON.stringify(row.before) ?? '—'}</code></td>
                      <td className="text-muted"><code>{JSON.stringify(row.after) ?? '—'}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <pre style={{
              background: 'var(--gray-50, #f9fafb)',
              border: '1px solid var(--gray-100)',
              borderRadius: 8,
              padding: 14,
              fontSize: 12.5,
              overflowX: 'auto',
              margin: 0,
            }}>
              <code>{JSON.stringify(log.action === 'DELETE' ? log.old_data : log.new_data, null, 2)}</code>
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AuditTrail() {
  const [selected, setSelected] = useState(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => getAuditLogs().then((r) => r.data),
    refetchInterval: 15000, // keep the demo view fresh without manual refresh
  });

  const logs = data ?? [];

  if (isLoading) return <div className="page-header"><p>Loading audit trail…</p></div>;
  if (isError)   return <div className="page-header"><p style={{ color: 'var(--danger)' }}>Failed to load audit trail.</p></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-breadcrumb">Admin</div>
          <h1>System Audit Trail</h1>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Table</th>
                <th>Record ID</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr><td colSpan={5} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>No changes recorded yet.</td></tr>
              )}
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="text-muted">{formatTimestamp(log.changed_at)}</td>
                  <td><span className={`badge ${ACTION_BADGE[log.action] ?? 'badge-gray'}`}>{log.action}</span></td>
                  <td style={{ fontWeight: 500 }}>{log.table_name}</td>
                  <td>{log.record_id}</td>
                  <td><button className="btn btn-ghost btn-sm" onClick={() => setSelected(log)}>View Changes</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '12px 20px', fontSize: 12, color: 'var(--gray-400)' }}>
          Showing the latest {logs.length} change{logs.length === 1 ? '' : 's'} across users, contracts, attendance, time-off requests, pay runs and payslips.
        </div>
      </div>

      {selected && <ChangesModal log={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
