import { useEffect, useState } from 'react';
import Alert from '../../components/Alert';
import Loader from '../../components/Loader';
import Modal from '../../components/Modal';
import PageHead from '../../components/PageHead';
import { QueueStatusBadge } from '../../components/Badges';
import { servicesApi } from '../../services/endpoints';
import { formatMinutes, getErrorMessage } from '../../utils/format';

const emptyForm = { name: '', code: '', description: '', avgServiceMinutes: 5 };

export default function ServiceManagement() {
  const [services, setServices] = useState(null);
  const [editing, setEditing] = useState(null); // null = closed, {} = new, service = edit
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = async () => {
    try {
      const params = { includeInactive: true };
      if (search.trim()) params.q = search.trim();
      if (statusFilter) params.queueStatus = statusFilter;
      const res = await servicesApi.list(params);
      setServices(res.services);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    load();
  };

  const openForm = (service) => {
    setEditing(service);
    setFormError('');
    setForm(
      service._id
        ? { name: service.name, code: service.code, description: service.description || '', avgServiceMinutes: service.avgServiceMinutes }
        : emptyForm
    );
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!/^[A-Za-z]{2,5}$/.test(form.code.trim())) {
      setFormError('Code must be 2 to 5 letters, for example GEN.');
      return;
    }
    const body = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      description: form.description.trim(),
      avgServiceMinutes: Number(form.avgServiceMinutes),
    };
    setSaving(true);
    try {
      if (editing._id) await servicesApi.update(editing._id, body);
      else await servicesApi.create(body);
      setNotice(editing._id ? `Saved ${body.name}.` : `Added ${body.name}.`);
      setEditing(null);
      load();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (s) => {
    try {
      await servicesApi.setActive(s._id, !s.isActive);
      setNotice(`${s.name} turned ${s.isActive ? 'off' : 'on'}.`);
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleDelete = async (s) => {
    if (!window.confirm(`Delete ${s.name}? This cannot be undone.`)) return;
    try {
      await servicesApi.remove(s._id);
      setNotice(`Deleted ${s.name}.`);
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <>
      <PageHead title="Services" subtitle="The services customers can queue for.">
        <button className="btn btn-primary" onClick={() => openForm({})}>
          Add service
        </button>
      </PageHead>
      <Alert message={error} onClose={() => setError('')} />
      <Alert type="success" message={notice} onClose={() => setNotice('')} />

      <form className="d-flex flex-wrap gap-2 mb-3" onSubmit={handleSearchSubmit}>
        <input
          className="form-control"
          style={{ maxWidth: 280 }}
          placeholder="Search name or code"
          aria-label="Search service name or code"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="form-select"
          style={{ maxWidth: 180 }}
          aria-label="Filter by queue status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="PAUSED">Paused</option>
          <option value="CLOSED">Closed</option>
        </select>
        <button className="btn btn-outline-primary" type="submit">Search</button>
        {(search || statusFilter) && (
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => {
              setSearch('');
              setStatusFilter('');
            }}
          >
            Clear
          </button>
        )}
      </form>

      {!services ? (
        <Loader />
      ) : services.length === 0 ? (
        <div className="pq-panel pq-empty">
          <h2>No services found</h2>
          <p className="mb-0">Try clearing search filters or add a new service.</p>
        </div>
      ) : (
        <div className="pq-table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Code</th>
                <th>Time per person</th>
                <th>Queue</th>
                <th>Waiting</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s._id}>
                  <td>
                    <div className="fw-semibold">{s.name}</div>
                    {s.description && <div className="small text-secondary">{s.description}</div>}
                  </td>
                  <td>{s.code}</td>
                  <td>{formatMinutes(s.avgServiceMinutes)}</td>
                  <td>
                    <QueueStatusBadge status={s.queueStatus} isActive={s.isActive} />
                  </td>
                  <td>{s.waitingCount}</td>
                  <td className="text-end text-nowrap">
                    <button className="btn btn-sm btn-outline-primary me-2" onClick={() => openForm(s)}>
                      Edit
                    </button>
                    <button className="btn btn-sm btn-outline-secondary me-2" onClick={() => toggleActive(s)}>
                      {s.isActive ? 'Turn off' : 'Turn on'}
                    </button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(s)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        show={!!editing}
        title={editing?._id ? `Edit ${editing.name}` : 'Add service'}
        onClose={() => setEditing(null)}
        footer={
          <>
            <button className="btn btn-light" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" type="submit" form="serviceForm" disabled={saving}>
              {saving ? 'Saving...' : editing?._id ? 'Save changes' : 'Add service'}
            </button>
          </>
        }
      >
        <Alert message={formError} />
        <form id="serviceForm" onSubmit={handleSave}>
          <div className="row g-3">
            <div className="col-sm-8">
              <label className="form-label" htmlFor="sf-name">Name</label>
              <input id="sf-name" className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="col-sm-4">
              <label className="form-label" htmlFor="sf-code">Token code</label>
              <input id="sf-code" className="form-control text-uppercase" maxLength={5} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
            </div>
            <div className="col-12">
              <label className="form-label" htmlFor="sf-desc">Description</label>
              <textarea id="sf-desc" className="form-control" rows={2} maxLength={300} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="col-sm-6">
              <label className="form-label" htmlFor="sf-avg">Minutes per person</label>
              <input id="sf-avg" type="number" min={1} step="0.5" className="form-control" value={form.avgServiceMinutes} onChange={(e) => setForm({ ...form, avgServiceMinutes: e.target.value })} required />
              <div className="form-text">Used for waiting time until real data builds up.</div>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
