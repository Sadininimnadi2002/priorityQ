import { useEffect, useState } from 'react';
import Alert from '../../components/Alert';
import Loader from '../../components/Loader';
import PageHead from '../../components/PageHead';
import UserFormModal from './UserFormModal';
import { useAuth } from '../../context/AuthContext';
import { adminApi, servicesApi } from '../../services/endpoints';
import { getErrorMessage } from '../../utils/format';

export default function StaffManagement() {
  const { user: me } = useAuth();
  const [staff, setStaff] = useState(null);
  const [services, setServices] = useState([]);
  const [editing, setEditing] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    try {
      const [staffRes, svcRes] = await Promise.all([
        adminApi.listUsers({ role: 'staff', limit: 100 }),
        servicesApi.list({ includeInactive: true }),
      ]);
      setStaff(staffRes.users);
      setServices(svcRes.services);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const assign = async (member, serviceId) => {
    setBusyId(member._id);
    try {
      const res = await adminApi.assignStaff(member._id, serviceId || null);
      setNotice(res.user.assignedService ? `${member.name} now works on ${res.user.assignedService.name}.` : `${member.name} is no longer assigned.`);
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (member) => {
    setBusyId(member._id);
    try {
      await adminApi.updateUser(member._id, { isActive: !member.isActive });
      setNotice(`${member.name} ${member.isActive ? 'deactivated' : 'activated'}.`);
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleSaved = (saved, wasEdit) => {
    setEditing(null);
    setNotice(wasEdit ? `Saved ${saved.name}.` : `Added ${saved.name}.`);
    load();
  };

  return (
    <>
      <PageHead title="Staff" subtitle="Assign each staff member to the service they work on.">
        <button className="btn btn-primary" onClick={() => setEditing({})}>
          Add staff member
        </button>
      </PageHead>
      <Alert message={error} onClose={() => setError('')} />
      <Alert type="success" message={notice} onClose={() => setNotice('')} />

      {!staff ? (
        <Loader />
      ) : staff.length === 0 ? (
        <div className="pq-panel pq-empty">
          <h2>No staff yet</h2>
          <p className="mb-0">Add a staff member, then assign them to a service.</p>
        </div>
      ) : (
        <div className="pq-table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Assigned service</th>
                <th>Status</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((m) => (
                <tr key={m._id}>
                  <td className="fw-semibold">{m.name}</td>
                  <td>{m.email}</td>
                  <td>
                    <select
                      className="form-select form-select-sm"
                      style={{ minWidth: 180 }}
                      aria-label={`Service for ${m.name}`}
                      value={m.assignedService?._id || ''}
                      disabled={busyId === m._id}
                      onChange={(e) => assign(m, e.target.value)}
                    >
                      <option value="">Not assigned</option>
                      {services.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.name}
                          {!s.isActive ? ' (off)' : ''}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{m.isActive ? 'Active' : <span className="text-danger">Deactivated</span>}</td>
                  <td className="text-end text-nowrap">
                    <button className="btn btn-sm btn-outline-primary me-2" onClick={() => setEditing(m)}>
                      Edit
                    </button>
                    <button className="btn btn-sm btn-outline-secondary" disabled={busyId === m._id} onClick={() => toggleActive(m)}>
                      {m.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <UserFormModal user={editing} fixedRole="staff" services={services} currentUserId={me._id} onClose={() => setEditing(null)} onSaved={handleSaved} />
    </>
  );
}
