import { Route, Routes } from 'react-router-dom';
import AppNavbar from './components/AppNavbar';
import ProtectedRoute from './components/ProtectedRoute';
import GuestRoute from './components/GuestRoute';

import Home from './pages/public/Home';
import Login from './pages/public/Login';
import Register from './pages/public/Register';
import NotFound from './pages/public/NotFound';

import UserDashboard from './pages/user/UserDashboard';
import Services from './pages/user/Services';
import ActiveToken from './pages/user/ActiveToken';
import QueueHistory from './pages/user/QueueHistory';
import Profile from './pages/user/Profile';

import StaffDashboard from './pages/staff/StaffDashboard';
import ActiveQueue from './pages/staff/ActiveQueue';
import QueueControls from './pages/staff/QueueControls';
import ServiceHistory from './pages/staff/ServiceHistory';

import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
import StaffManagement from './pages/admin/StaffManagement';
import ServiceManagement from './pages/admin/ServiceManagement';
import Reports from './pages/admin/Reports';

export default function App() {
  return (
    <>
      <AppNavbar />
      <main className="pq-main">
        <div className="container">
          <Routes>
            <Route path="/" element={<Home />} />

            <Route element={<GuestRoute />}>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route path="/profile" element={<Profile />} />
            </Route>

            <Route element={<ProtectedRoute roles={['user']} />}>
              <Route path="/dashboard" element={<UserDashboard />} />
              <Route path="/services" element={<Services />} />
              <Route path="/token" element={<ActiveToken />} />
              <Route path="/history" element={<QueueHistory />} />
            </Route>

            <Route element={<ProtectedRoute roles={['staff', 'admin']} />}>
              <Route path="/staff" element={<StaffDashboard />} />
              <Route path="/staff/queue" element={<ActiveQueue />} />
              <Route path="/staff/controls" element={<QueueControls />} />
              <Route path="/staff/history" element={<ServiceHistory />} />
            </Route>

            <Route element={<ProtectedRoute roles={['admin']} />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<UserManagement />} />
              <Route path="/admin/staff" element={<StaffManagement />} />
              <Route path="/admin/services" element={<ServiceManagement />} />
              <Route path="/admin/reports" element={<Reports />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </main>
    </>
  );
}
