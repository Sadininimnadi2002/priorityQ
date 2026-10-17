import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { homePathForRole } from '../utils/format';
import Loader from './Loader';

/**
 * Wraps routes that need login. `roles` limits them to certain roles.
 * NOTE: this only hides pages in the browser. The real security is the backend's
 * protect + authorize middleware, which checks every request.
 */
export default function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homePathForRole(user.role)} replace />;

  return <Outlet />; // render the child route
}
