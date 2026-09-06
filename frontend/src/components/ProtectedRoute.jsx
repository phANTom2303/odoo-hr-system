import { Navigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export default function ProtectedRoute({ allowedRoles = [], ownerIdParam, children }) {
  const { currentUser } = useApp();
  const params = useParams();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  const hasRole  = allowedRoles.includes(currentUser.role);
  const isOwner  = ownerIdParam && params[ownerIdParam] && parseInt(params[ownerIdParam]) === currentUser.id;

  if (!hasRole && !isOwner) {
    // Redirect to their home instead of showing a 403 wall
    const home = currentUser.role === 'employee' ? '/contracts' : '/employees';
    return <Navigate to={home} replace />;
  }

  return children;
}
