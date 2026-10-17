import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Alert from '../../components/Alert';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../utils/format';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  // Quick checks in the browser for a faster message. The backend checks again.
  const validate = () => {
    if (form.name.trim().length < 2) return 'Enter your name (at least 2 characters).';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return 'Enter a valid email address.';
    if (form.password.length < 6) return 'Password must be at least 6 characters.';
    if (form.password !== form.confirm) return 'The two passwords do not match.';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
      });
      navigate('/services', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pq-auth pq-panel p-4">
      <h1>Create an account</h1>
      <p className="text-secondary">You need an account to join a queue.</p>
      <Alert message={error} onClose={() => setError('')} />

      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-3">
          <label htmlFor="name" className="form-label">
            Full name
          </label>
          <input id="name" name="name" className="form-control" autoComplete="name" value={form.name} onChange={handleChange} />
        </div>
        <div className="mb-3">
          <label htmlFor="email" className="form-label">
            Email
          </label>
          <input id="email" name="email" type="email" className="form-control" autoComplete="email" value={form.email} onChange={handleChange} />
        </div>
        <div className="mb-3">
          <label htmlFor="phone" className="form-label">
            Phone <span className="text-secondary fw-normal">(optional)</span>
          </label>
          <input id="phone" name="phone" type="tel" className="form-control" autoComplete="tel" value={form.phone} onChange={handleChange} />
        </div>
        <div className="row g-3 mb-4">
          <div className="col-sm-6">
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <input id="password" name="password" type="password" className="form-control" autoComplete="new-password" value={form.password} onChange={handleChange} />
          </div>
          <div className="col-sm-6">
            <label htmlFor="confirm" className="form-label">
              Confirm password
            </label>
            <input id="confirm" name="confirm" type="password" className="form-control" autoComplete="new-password" value={form.confirm} onChange={handleChange} />
          </div>
        </div>
        <button className="btn btn-primary w-100" disabled={submitting}>
          {submitting ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p className="mt-3 mb-0 text-center">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}
