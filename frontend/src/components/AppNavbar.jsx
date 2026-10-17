import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { homePathForRole } from '../utils/format';

// Different links for each role = "role-based navigation"
const LINKS = {
  user: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/services', label: 'Services' },
    { to: '/token', label: 'My token' },
    { to: '/history', label: 'History' },
  ],
  staff: [
    { to: '/staff', label: 'Dashboard', end: true },
    { to: '/staff/queue', label: 'Active queue' },
    { to: '/staff/controls', label: 'Counter' },
    { to: '/staff/history', label: 'History' },
  ],
  admin: [
    { to: '/admin', label: 'Dashboard', end: true },
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/staff', label: 'Staff' },
    { to: '/admin/services', label: 'Services' },
    { to: '/admin/reports', label: 'Reports' },
    { to: '/staff/queue', label: 'Queues' },
  ],
};

export default function AppNavbar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    setOpen(false);
    navigate('/login');
  };

  const links = user ? LINKS[user.role] || [] : [];

  return (
    <nav className="navbar navbar-expand-lg navbar-dark pq-navbar">
      <div className="container">
        <Link className="navbar-brand" to={user ? homePathForRole(user.role) : '/'} onClick={() => setOpen(false)}>
          Priority<span>Q</span>
        </Link>
        <button
          className="navbar-toggler"
          type="button"
          aria-controls="mainNav"
          aria-expanded={open}
          aria-label="Toggle navigation"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="navbar-toggler-icon" />
        </button>

        <div className={`collapse navbar-collapse ${open ? 'show' : ''}`} id="mainNav">
          <ul className="navbar-nav me-auto">
            {links.map((link) => (
              <li className="nav-item" key={link.to}>
                <NavLink className="nav-link" to={link.to} end={link.end} onClick={() => setOpen(false)}>
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>

          <ul className="navbar-nav align-items-lg-center gap-lg-2">
            {user ? (
              <>
                <li className="nav-item">
                  <NavLink className="nav-link" to="/profile" onClick={() => setOpen(false)}>
                    {user.name}
                  </NavLink>
                </li>
                <li className="nav-item">
                  <button className="btn btn-sm btn-outline-light" onClick={handleLogout}>
                    Log out
                  </button>
                </li>
              </>
            ) : (
              <>
                <li className="nav-item">
                  <NavLink className="nav-link" to="/login" onClick={() => setOpen(false)}>
                    Log in
                  </NavLink>
                </li>
                <li className="nav-item">
                  <Link className="btn btn-sm btn-light" to="/register" onClick={() => setOpen(false)}>
                    Create account
                  </Link>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
}
