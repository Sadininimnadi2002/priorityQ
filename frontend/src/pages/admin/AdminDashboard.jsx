import { useState } from 'react';
import Alert from '../../components/Alert';
import Loader from '../../components/Loader';
import PageHead from '../../components/PageHead';
import StatGrid from '../../components/StatGrid';
import { PriorityBadge, QueueStatusBadge } from '../../components/Badges';
import usePolling from '../../hooks/usePolling';
import { adminApi } from '../../services/endpoints';
import { formatDateTime, formatMinutes, getErrorMessage } from '../../utils/format';
import { Link } from 'react-router-dom';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [queues, setQueues] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [error, setError] = useState('');

  usePolling(async () => {
    try {
      const [s, q, activity] = await Promise.all([
        adminApi.stats(),
        adminApi.queues(),
        adminApi.priorityLogs({ page: 1, limit: 5 }).catch(() => ({ logs: [] })),
      ]);
      setStats(s.stats);
      setQueues(q.queues);
      setRecentActivity(activity.logs || []);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, 15000);

  if (!stats && !error) return <Loader />;

  return (
    <div className="pq-admin-dashboard">
      <PageHead title="Admin dashboard" subtitle="Monitor PriorityQ activity and manage the system.">
        <span className="pq-admin-dashboard__refresh">Overview updates every 15 seconds</span>
      </PageHead>
      <Alert message={error} />

      {stats && (
        <section className="pq-admin-stats" aria-label="System statistics">
          <StatGrid
            items={[
              { label: 'Total users', value: stats.totalUsers },
              { label: 'Total staff', value: stats.totalStaff },
              { label: 'Total services', value: stats.totalServices },
              { label: 'Active queues', value: stats.activeQueues },
              { label: 'Users served today', value: stats.usersServedToday },
              { label: 'Average waiting time', value: formatMinutes(stats.avgWaitingMinutes) },
            ]}
          />
        </section>
      )}

      <section className="pq-admin-queues" aria-labelledby="pq-admin-queues-title">
        <div className="pq-admin-section-head">
          <div>
            <span className="pq-admin-eyebrow">Live system snapshot</span>
            <h2 id="pq-admin-queues-title">Queue overview</h2>
          </div>
          <Link to="/admin/services" className="btn btn-sm btn-outline-primary">
            Manage services
          </Link>
        </div>

        {queues.length === 0 ? (
          <div className="pq-panel pq-empty">
            <h3>No services yet</h3>
            <p>Add a service to start tracking queues.</p>
            <Link to="/admin/services" className="btn btn-primary">
              Add service
            </Link>
          </div>
        ) : (
          <div className="pq-admin-queue-grid">
            {queues.map((queue) => (
              <article className="pq-admin-queue" key={queue.service._id}>
                <div className="pq-admin-queue__head">
                  <h3>{queue.service.name}</h3>
                  <QueueStatusBadge status={queue.service.queueStatus} isActive={queue.service.isActive} />
                </div>
                <div className="pq-admin-queue__totals">
                  <div>
                    <span>Waiting</span>
                    <strong>{queue.waiting}</strong>
                  </div>
                  <div>
                    <span>At counter</span>
                    <strong>{queue.called + queue.serving}</strong>
                  </div>
                </div>
                <div className="pq-admin-queue__priorities" aria-label="Waiting by priority">
                  {['EMERGENCY', 'URGENT', 'NORMAL'].map((priority) => (
                    <div key={priority}>
                      <PriorityBadge priority={priority} />
                      <strong>{queue.byPriority[priority]}</strong>
                    </div>
                  ))}
                </div>
                <div className="pq-admin-queue__staff">
                  <span>Assigned staff</span>
                  <strong>
                    {queue.staff.length ? queue.staff.map((member) => member.name).join(', ') : 'None assigned'}
                  </strong>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {stats && (
        <section className="pq-admin-daily" aria-labelledby="pq-admin-daily-title">
          <div className="pq-admin-section-head">
            <div>
              <span className="pq-admin-eyebrow">Today</span>
              <h2 id="pq-admin-daily-title">Daily activity</h2>
            </div>
          </div>
          <div className="pq-admin-daily__grid">
            <div>
              <span>Users served</span>
              <strong>{stats.usersServedToday}</strong>
            </div>
            <div>
              <span>Currently waiting</span>
              <strong>{stats.totalWaiting}</strong>
            </div>
            <div>
              <span>Average wait</span>
              <strong>{formatMinutes(stats.avgWaitingMinutes)}</strong>
            </div>
          </div>
        </section>
      )}

      <section className="pq-admin-management" aria-labelledby="pq-admin-management-title">
        <div className="pq-admin-section-head">
          <div>
            <span className="pq-admin-eyebrow">Administration</span>
            <h2 id="pq-admin-management-title">Quick management</h2>
          </div>
        </div>
        <div className="pq-admin-management__grid">
          <Link to="/admin/users" className="pq-admin-management__item">
            <span className="pq-admin-management__marker" aria-hidden="true" />
            <span className="pq-admin-management__copy">
              <strong>Manage Users</strong>
              <span>View and manage registered users.</span>
            </span>
            <span className="pq-admin-management__arrow" aria-hidden="true">→</span>
          </Link>
          <Link to="/admin/staff" className="pq-admin-management__item">
            <span className="pq-admin-management__marker" aria-hidden="true" />
            <span className="pq-admin-management__copy">
              <strong>Manage Staff</strong>
              <span>Assign staff and manage access.</span>
            </span>
            <span className="pq-admin-management__arrow" aria-hidden="true">→</span>
          </Link>
          <Link to="/admin/services" className="pq-admin-management__item">
            <span className="pq-admin-management__marker" aria-hidden="true" />
            <span className="pq-admin-management__copy">
              <strong>Manage Services</strong>
              <span>Create, edit, and activate services.</span>
            </span>
            <span className="pq-admin-management__arrow" aria-hidden="true">→</span>
          </Link>
          <Link to="/admin/reports" className="pq-admin-management__item">
            <span className="pq-admin-management__marker" aria-hidden="true" />
            <span className="pq-admin-management__copy">
              <strong>View Reports</strong>
              <span>Review queue performance and priority changes.</span>
            </span>
            <span className="pq-admin-management__arrow" aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <section className="pq-admin-activity" aria-labelledby="pq-admin-activity-title">
        <div className="pq-admin-section-head">
          <div>
            <span className="pq-admin-eyebrow">Audit trail</span>
            <h2 id="pq-admin-activity-title">Recent priority changes</h2>
          </div>
          <Link to="/admin/reports" className="btn btn-sm btn-outline-primary">
            View reports
          </Link>
        </div>
        {recentActivity.length === 0 ? (
          <div className="pq-admin-activity__empty">No priority changes recorded yet.</div>
        ) : (
          <div className="pq-admin-activity__list">
            {recentActivity.map((activity) => (
              <article className="pq-admin-activity__item" key={activity._id}>
                <div className="pq-admin-activity__main">
                  <strong>{activity.queueEntry?.tokenLabel || 'Queue token'}</strong>
                  <span>{activity.service?.name || 'Service'} · {activity.changedBy?.name || 'Admin'}</span>
                </div>
                <div className="pq-admin-activity__change">
                  <PriorityBadge priority={activity.oldPriority} />
                  <span aria-hidden="true">to</span>
                  <PriorityBadge priority={activity.newPriority} />
                </div>
                <time dateTime={activity.createdAt}>{formatDateTime(activity.createdAt)}</time>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
