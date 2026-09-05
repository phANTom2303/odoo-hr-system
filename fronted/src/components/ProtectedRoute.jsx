import { Navigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export default function ProtectedRoute({ allowedRoles = [], ownerIdParam, children }) {
  const { currentUser } = useApp();
  const params = useParams();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  const hasRole = allowedRoles.includes(currentUser.role);
  const isOwner = ownerIdParam && params[ownerIdParam] && parseInt(params[ownerIdParam]) === currentUser.id;

  if (!hasRole && !isOwner) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <h2 style={{ color: 'var(--danger, #ef4444)', fontSize: '2rem', marginBottom: '1rem' }}>403 Forbidden</h2>
        <p style={{ color: 'var(--gray-500, #6b7280)' }}>You do not have permission to view this page.</p>
      </div>
    );
  }

  return children;
}
