import { useState } from 'react';
import Alert from '../../components/Alert';
import PageHead from '../../components/PageHead';
import { PriorityBadge } from '../../components/Badges';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../services/endpoints';
import { getErrorMessage, titleCase } from '../../utils/format';

export default function Profile() {
  const { user, setUser } = useAuth();
  const [details, setDetails] = useState({ name: user.name, phone: user.phone || '' });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [message, setMessage] = useState({ type: 'success', text: '' });
  const [saving, setSaving] = useState(false);

  const saveDetails = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await authApi.updateMe({ name: details.name.trim(), phone: details.phone.trim() });
      setUser(res.user); // update the user everywhere in the app (navbar too)
      setMessage({ type: 'success', text: 'Profile saved.' });
    } catch (err) {
      setMessage({ type: 'danger', text: getErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (passwords.newPassword.length < 6) {
      setMessage({ type: 'danger', text: 'New password must be at least 6 characters.' });
      return;
    }
    if (passwords.newPassword !== passwords.confirm) {
      setMessage({ type: 'danger', text: 'The new passwords do not match.' });
      return;
    }
    setSaving(true);
    try {
      await authApi.updateMe({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword });
      setPasswords({ currentPassword: '', newPassword: '', confirm: '' });
      setMessage({ type: 'success', text: 'Password changed.' });
    } catch (err) {
      setMessage({ type: 'danger', text: getErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHead title="Profile" subtitle={`Signed in as ${user.email} (${titleCase(user.role)})`} />
      <Alert type={message.type} message={message.text} onClose={() => setMessage({ ...message, text: '' })} />

      <div className="row g-4">
        <div className="col-lg-6">
          <form className="pq-panel" onSubmit={saveDetails}>
            <h2>Your details</h2>
            <div className="mb-3">
              <label htmlFor="pname" className="form-label">
                Full name
              </label>
              <input
                id="pname"
                className="form-control"
                value={details.name}
                onChange={(e) => setDetails({ ...details, name: e.target.value })}
                required
                minLength={2}
              />
            </div>
            <div className="mb-3">
              <label htmlFor="pphone" className="form-label">
                Phone
              </label>
              <input
                id="pphone"
                className="form-control"
                value={details.phone}
                onChange={(e) => setDetails({ ...details, phone: e.target.value })}
              />
            </div>
            {user.role === 'user' && (
              <p className="small text-secondary">
                Your default priority: <PriorityBadge priority={user.defaultPriority} />. Only staff can change it.
              </p>
            )}
            {user.role === 'staff' && (
              <p className="small text-secondary">Assigned service: {user.assignedService?.name || 'None yet'}</p>
            )}
            <button className="btn btn-primary" disabled={saving}>
              Save details
            </button>
          </form>
        </div>

        <div className="col-lg-6">
          <form className="pq-panel" onSubmit={savePassword}>
            <h2>Change password</h2>
            <div className="mb-3">
              <label htmlFor="cur" className="form-label">
                Current password
              </label>
              <input
                id="cur"
                type="password"
                className="form-control"
                autoComplete="current-password"
                value={passwords.currentPassword}
                onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
                required
              />
            </div>
            <div className="mb-3">
              <label htmlFor="newp" className="form-label">
                New password
              </label>
              <input
                id="newp"
                type="password"
                className="form-control"
                autoComplete="new-password"
                value={passwords.newPassword}
                onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                required
              />
            </div>
            <div className="mb-3">
              <label htmlFor="conf" className="form-label">
                Confirm new password
              </label>
              <input
                id="conf"
                type="password"
                className="form-control"
                autoComplete="new-password"
                value={passwords.confirm}
                onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                required
              />
            </div>
            <button className="btn btn-outline-primary" disabled={saving}>
              Change password
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
