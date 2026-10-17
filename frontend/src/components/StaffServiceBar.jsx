import { Link } from 'react-router-dom';

/**
 * Shows which service the staff pages are working on.
 * Staff: their assigned service. Admin: a dropdown to pick any service.
 */
export default function StaffServiceBar({ staffService }) {
  const { isAdmin, services, serviceId, choose, assignedService } = staffService;

  if (isAdmin) {
    return (
      <div className="d-flex align-items-center gap-2">
        <label htmlFor="svcPick" className="text-secondary small mb-0">
          Service
        </label>
        <select
          id="svcPick"
          className="form-select form-select-sm"
          style={{ minWidth: 200 }}
          value={serviceId || ''}
          onChange={(e) => choose(e.target.value)}
        >
          {services.length === 0 && <option value="">No services yet</option>}
          {services.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (!assignedService) return null;
  return <span className="text-secondary">{assignedService.name}</span>;
}

export function NoServiceAssigned() {
  return (
    <div className="pq-panel pq-empty">
      <h2>You are not assigned to a service yet</h2>
      <p className="mb-0">Ask an admin to assign you to a service. Then refresh this page.</p>
    </div>
  );
}

export function NoServicesExist() {
  return (
    <div className="pq-panel pq-empty">
      <h2>There are no services yet</h2>
      <Link to="/admin/services" className="btn btn-primary mt-2">
        Create a service
      </Link>
    </div>
  );
}
