import { useEffect, useState } from 'react';
import Alert from '../../components/Alert';
import Loader from '../../components/Loader';
import PageHead from '../../components/PageHead';
import { PriorityBadge } from '../../components/Badges';
import UserFormModal from './UserFormModal';
import { useAuth } from '../../context/AuthContext';
import { adminApi, servicesApi } from '../../services/endpoints';
import { ROLES } from '../../utils/constants';
import { formatDateTime, getErrorMessage, titleCase } from '../../utils/format';

export default function UserManagement() {
  const { user: me } = useAuth();
  const [filters, setFilters] = useState({ role: '', q: '', page: 1 });
  const [search, setSearch] = useState('');
  const [result, setResult] = useState(null);
  const [services, setServices] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    try {
      const params = { page: filters.page, limit: 15 };
      if (filters.role) params.role = filters.role;
      if (filters.q) params.q = filters.q;
      setResult(await adminApi.listUsers(params));
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    servicesApi.list({ includeInactive: true }).then((res) => setServices(res.services)).catch(() => {});
  }, []);

  const handleDelete = async (u) => {
    if (!window.confirm(`Delete ${u.name}? People with queue history are deactivated instead.`)) return;
    try {
      const res = await adminApi.deleteUser(u._id);
      setNotice(res.message);
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleSaved = (saved, wasEdit) => {
    setEditing(null);
    setNotice(wasEdit ? `Saved ${saved.name}.` : `Added ${saved.name}.`);
    load();
  };

  return (
    <>
      <PageHead title="Users" subtitle="Everyone with an account: customers, staff and admins.">
        <button className="btn btn-primary" onClick={() => setEditing({})}>
          Add user
        </button>
      </PageHead>
      <Alert message={error} onClose={() => setError('')} />
      <Alert type="success" message={notice} onClose={() => setNotice('')} />

      <form
        className="d-flex flex-wrap gap-2 mb-3"
        onSubmit={(e) => {
          e.preventDefault();
          setFilters({ ...filters, q: search.trim(), page: 1 });
        }}
      >
        <input
          className="form-control"
          style={{ maxWidth: 280 }}
          placeholder="Search name or email"
          aria-label="Search name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="form-select"
          style={{ maxWidth: 180 }}
          aria-label="Filter by role"
          value={filters.role}
          onChange={(e) => setFilters({ ...filters, role: e.target.value, page: 1 })}
        >
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{titleCase(r)}</option>
          ))}
        </select>
        <button className="btn btn-outline-primary">Search</button>
      </form>

      {!result ? (
        <Loader />
      ) : result.users.length === 0 ? (
        <div className="pq-panel pq-empty">
          <p className="mb-0">No users match this search.</p>
        </div>
      ) : (
        <>
          <div className="pq-table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Priority / service</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {result.users.map((u) => (
                  <tr key={u._id}>
                    <td className="fw-semibold">{u.name}</td>
                    <td>{u.email}</td>
                    <td>{titleCase(u.role)}</td>
                    <td>
                      {u.role === 'user' && <PriorityBadge priority={u.defaultPriority} />}
                      {u.role === 'staff' && (u.assignedService?.name || <span className="text-secondary">Not assigned</span>)}
                    </td>
                    <td>{u.isActive ? 'Active' : <span className="text-danger">Deactivated</span>}</td>
                    <td>{formatDateTime(u.createdAt)}</td>
                    <td className="text-end text-nowrap">
                      <button className="btn btn-sm btn-outline-primary me-2" onClick={() => setEditing(u)}>
                        Edit
                      </button>
                      {u._id !== me._id && (
                        <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(u)}>
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="d-flex justify-content-between align-items-center mt-3">
            <span className="text-secondary small">
              {result.total} total, page {result.page} of {result.pages}
            </span>
            <div className="btn-group">
              <button className="btn btn-sm btn-outline-secondary" disabled={result.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>
                Previous
              </button>
              <button className="btn btn-sm btn-outline-secondary" disabled={result.page >= result.pages} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>
                Next
              </button>
            </div>
          </div>
        </>
      )}

      <UserFormModal user={editing} services={services} currentUserId={me._id} onClose={() => setEditing(null)} onSaved={handleSaved} />
    </>
  );
}
