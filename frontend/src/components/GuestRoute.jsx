import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { homePathForRole } from '../utils/format';
import Loader from './Loader';

// Login and register pages: logged-in people are sent to their dashboard instead
export default function GuestRoute() {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  if (user) return <Navigate to={homePathForRole(user.role)} replace />;
  return <Outlet />;
}
