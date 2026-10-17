import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Alert from '../../components/Alert';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage, homePathForRole } from '../../utils/format';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // "Controlled form": React state is the single source of truth for each input
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault(); // stop the browser from reloading the page
    setError('');
    setSubmitting(true);
    try {
      const user = await login(form.email.trim(), form.password);
      const from = location.state?.from?.pathname;
      navigate(from || homePathForRole(user.role), { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pq-auth pq-panel p-4">
      <h1>Log in</h1>
      <p className="text-secondary">Welcome back. Log in to see your token.</p>
      <Alert message={error} onClose={() => setError('')} />

      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-3">
          <label htmlFor="email" className="form-label">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            className="form-control"
            autoComplete="email"
            value={form.email}
            onChange={handleChange}
            required
          />
        </div>
        <div className="mb-4">
          <label htmlFor="password" className="form-label">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            className="form-control"
            autoComplete="current-password"
            value={form.password}
            onChange={handleChange}
            required
          />
        </div>
        <button className="btn btn-primary w-100" disabled={submitting || !form.email || !form.password}>
          {submitting ? 'Logging in...' : 'Log in'}
        </button>
      </form>

      <p className="mt-3 mb-0 text-center">
        New here? <Link to="/register">Create an account</Link>
      </p>
    </div>
  );
}
