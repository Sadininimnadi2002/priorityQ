import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';
import { BellIcon, CheckIcon, TicketIcon, ClockIcon } from './Icons';
import { formatDateTime } from '../utils/format';

export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, loading } = useNotifications();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'UNREAD'
  const panelRef = useRef(null);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!open) return undefined;
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const displayedNotifications =
    filter === 'UNREAD' ? notifications.filter((n) => !n.isRead) : notifications;

  return (
    <div className="pq-notification-bell-container position-relative" ref={panelRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        className={`btn pq-bell-btn position-relative d-inline-flex align-items-center justify-content-center ${
          open ? 'pq-bell-btn--active' : ''
        }`}
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications (${unreadCount} unread)`}
        aria-expanded={open}
        title="View Notifications"
      >
        <BellIcon size={20} className={unreadCount > 0 ? 'text-primary' : 'text-secondary'} />
        {unreadCount > 0 && (
          <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger pq-bell-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
            <span className="visually-hidden">unread notifications</span>
          </span>
        )}
      </button>

      {/* Notification Dropdown Panel */}
      {open && (
        <div
          className="pq-notification-panel card shadow-lg border rounded-4 position-absolute end-0 mt-2"
          role="region"
          aria-label="Notification center"
        >
          {/* Panel Header */}
          <div className="card-header bg-white py-3 px-3 d-flex align-items-center justify-content-between border-bottom">
            <div className="d-flex align-items-center gap-2">
              <h3 className="h6 fw-bold mb-0">Notifications</h3>
              {unreadCount > 0 && (
                <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                  {unreadCount} unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                className="btn btn-sm btn-link text-decoration-none text-primary p-0 small"
                onClick={markAllAsRead}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="p-2 border-bottom bg-light-subtle d-flex gap-2">
            <button
              type="button"
              className={`btn btn-sm py-1 px-3 rounded-pill ${
                filter === 'ALL' ? 'btn-primary' : 'btn-outline-secondary'
              }`}
              onClick={() => setFilter('ALL')}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              className={`btn btn-sm py-1 px-3 rounded-pill ${
                filter === 'UNREAD' ? 'btn-primary' : 'btn-outline-secondary'
              }`}
              onClick={() => setFilter('UNREAD')}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Panel Body / Notifications List */}
          <div className="pq-notification-list overflow-auto" style={{ maxHeight: '380px' }}>
            {loading && notifications.length === 0 ? (
              <div className="text-center py-4 text-muted small">Loading notifications...</div>
            ) : displayedNotifications.length === 0 ? (
              <div className="text-center py-5 px-3 text-muted">
                <BellIcon size={32} className="text-muted mb-2 opacity-50" />
                <p className="small mb-1 fw-semibold">
                  {filter === 'UNREAD' ? 'No unread notifications' : 'No notifications yet'}
                </p>
                <small className="text-muted">
                  You will receive real-time alerts when your token is called or updated.
                </small>
              </div>
            ) : (
              <div className="list-group list-group-flush">
                {displayedNotifications.map((notif) => (
                  <div
                    key={notif._id}
                    className={`list-group-item p-3 border-bottom pq-notification-item ${
                      !notif.isRead ? 'pq-notification-item--unread' : ''
                    }`}
                  >
                    <div className="d-flex align-items-start justify-content-between gap-2">
                      <div className="flex-grow-1">
                        <div className="d-flex align-items-center gap-2 mb-1">
                          {!notif.isRead && (
                            <span
                              className="pq-unread-dot bg-primary rounded-circle d-inline-block"
                              aria-hidden="true"
                            />
                          )}
                          <h4 className="h6 fw-bold mb-0 text-dark">{notif.title}</h4>
                        </div>

                        <p className="small text-muted mb-2">{notif.message}</p>

                        <div className="d-flex flex-wrap align-items-center gap-2 small">
                          {notif.tokenLabel && (
                            <span className="badge bg-light text-dark border d-inline-flex align-items-center gap-1">
                              <TicketIcon size={12} />
                              <span>{notif.tokenLabel}</span>
                            </span>
                          )}
                          {notif.serviceName && (
                            <span className="badge bg-light text-secondary border">
                              {notif.serviceName}
                            </span>
                          )}
                          <span className="text-muted small d-inline-flex align-items-center gap-1 ms-auto">
                            <ClockIcon size={12} />
                            <span>{formatDateTime(notif.createdAt)}</span>
                          </span>
                        </div>
                      </div>

                      {!notif.isRead && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary p-1 rounded-circle flex-shrink-0"
                          title="Mark as read"
                          aria-label="Mark as read"
                          onClick={() => markAsRead(notif._id)}
                        >
                          <CheckIcon size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Panel Footer */}
          {notifications.length > 0 && (
            <div className="card-footer bg-white text-center py-2 border-top">
              <Link
                to="/token"
                className="small text-primary text-decoration-none fw-semibold"
                onClick={() => setOpen(false)}
              >
                Go to My Active Token →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
