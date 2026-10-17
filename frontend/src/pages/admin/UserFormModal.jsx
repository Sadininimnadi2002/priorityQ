import { useEffect, useState } from 'react';
import Alert from '../../components/Alert';
import Modal from '../../components/Modal';
import { adminApi } from '../../services/endpoints';
import { PRIORITIES, ROLES } from '../../utils/constants';
import { getErrorMessage, titleCase } from '../../utils/format';

const empty = { name: '', email: '', phone: '', password: '', role: 'user', defaultPriority: 'NORMAL', assignedService: '', isActive: true };

/**
 * Create or edit a user. Pass `user` to edit, or `user={{}}` to create.
 * `fixedRole` hides the role picker (used by Staff management).
 */
export default function UserFormModal({ user, fixedRole, services, currentUserId, onClose, onSaved }) {
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const isEdit = !!user?._id;

  useEffect(() => {
    if (!user) return;
    setError('');
    setForm({
      ...empty,
      ...(isEdit
        ? {
            name: user.name,
            email: user.email,
            phone: user.phone || '',
            role: user.role,
            defaultPriority: user.defaultPriority || 'NORMAL',
            assignedService: user.assignedService?._id || '',
            isActive: user.isActive,
          }
        : {}),
      ...(fixedRole ? { role: fixedRole } : {}),
    });
  }, [user, fixedRole, isEdit]);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!isEdit && form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    const body = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      role: form.role,
      defaultPriority: form.defaultPriority,
      assignedService: form.role === 'staff' && form.assignedService ? form.assignedService : null,
    };
    if (isEdit) body.isActive = form.isActive;
    if (form.password) body.password = form.password;

    setSaving(true);
    try {
      const res = isEdit ? await adminApi.updateUser(user._id, body) : await adminApi.createUser(body);
      onSaved(res.user, isEdit);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const editingSelf = isEdit && user._id === currentUserId;
  const label = fixedRole === 'staff' ? 'staff member' : 'user';

  return (
    <Modal
      show={!!user}
      title={isEdit ? `Edit ${user.name}` : `Add ${label}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-light" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" type="submit" form="userForm" disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Save changes' : `Add ${label}`}
          </button>
        </>
      }
    >
      <Alert message={error} />
      <form id="userForm" onSubmit={handleSubmit}>
        <div className="row g-3">
          <div className="col-sm-6">
            <label className="form-label" htmlFor="uf-name">Name</label>
            <input id="uf-name" className="form-control" value={form.name} onChange={set('name')} required minLength={2} />
          </div>
          <div className="col-sm-6">
            <label className="form-label" htmlFor="uf-phone">Phone</label>
            <input id="uf-phone" className="form-control" value={form.phone} onChange={set('phone')} />
          </div>
          <div className="col-12">
            <label className="form-label" htmlFor="uf-email">Email</label>
            <input id="uf-email" type="email" className="form-control" value={form.email} onChange={set('email')} required />
          </div>
          <div className="col-12">
            <label className="form-label" htmlFor="uf-pass">{isEdit ? 'New password (leave empty to keep)' : 'Password'}</label>
            <input id="uf-pass" type="password" className="form-control" autoComplete="new-password" value={form.password} onChange={set('password')} />
          </div>
          {!fixedRole && (
            <div className="col-sm-6">
              <label className="form-label" htmlFor="uf-role">Role</label>
              <select id="uf-role" className="form-select" value={form.role} onChange={set('role')} disabled={editingSelf}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{titleCase(r)}</option>
                ))}
              </select>
            </div>
          )}
          {form.role === 'user' && (
            <div className="col-sm-6">
              <label className="form-label" htmlFor="uf-prio">Default priority</label>
              <select id="uf-prio" className="form-select" value={form.defaultPriority} onChange={set('defaultPriority')}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{titleCase(p)}</option>
                ))}
              </select>
            </div>
          )}
          {form.role === 'staff' && (
            <div className="col-sm-6">
              <label className="form-label" htmlFor="uf-svc">Assigned service</label>
              <select id="uf-svc" className="form-select" value={form.assignedService} onChange={set('assignedService')}>
                <option value="">Not assigned</option>
                {services.map((s) => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
          {isEdit && !editingSelf && (
            <div className="col-12">
              <div className="form-check">
                <input id="uf-active" type="checkbox" className="form-check-input" checked={form.isActive} onChange={set('isActive')} />
                <label className="form-check-label" htmlFor="uf-active">Account is active</label>
              </div>
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}
