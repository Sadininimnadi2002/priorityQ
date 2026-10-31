import { Link } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';
import { BellIcon, ClearIcon, ArrowRightIcon } from './Icons';
import { formatTime } from '../utils/format';

export default function NotificationToast() {
  const { activeToast, dismissToast, markAsRead } = useNotifications();

  if (!activeToast) return null;

  const handleAction = () => {
    markAsRead(activeToast._id);
    dismissToast();
  };

  return (
    <aside
      className="pq-notification-toast shadow-lg rounded-4 p-3 border"
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
        <div className="d-flex align-items-center gap-2">
          <div className="pq-toast-icon-box bg-primary text-white rounded-circle p-2 d-grid place-items-center">
            <BellIcon size={16} />
          </div>
          <div>
            <span className="badge bg-primary-subtle text-primary border border-primary-subtle me-1">
              Live Alert
            </span>
            {activeToast.tokenLabel && (
              <span className="badge bg-dark text-white me-1">{activeToast.tokenLabel}</span>
            )}
            <small className="text-muted">
              {activeToast.createdAt ? formatTime(activeToast.createdAt) : 'Just now'}
            </small>
          </div>
        </div>
        <button
          type="button"
          className="btn-close btn-close-sm"
          aria-label="Close notification"
          onClick={dismissToast}
        />
      </div>

      <h4 className="h6 fw-bold mb-1 text-dark">{activeToast.title}</h4>
      <p className="small text-muted mb-2">{activeToast.message}</p>

      {activeToast.serviceName && (
        <div className="small text-secondary mb-2">
          Service: <strong>{activeToast.serviceName}</strong>
        </div>
      )}

      <div className="d-flex align-items-center justify-content-between pt-1 border-top mt-2">
        <button
          type="button"
          className="btn btn-sm btn-link text-decoration-none text-muted p-0 small"
          onClick={handleAction}
        >
          Dismiss
        </button>
        <Link
          to="/token"
          className="btn btn-sm btn-primary py-1 px-3 d-inline-flex align-items-center gap-1"
          onClick={handleAction}
        >
          <span>View My Token</span>
          <ArrowRightIcon size={14} />
        </Link>
      </div>
    </aside>
  );
}
