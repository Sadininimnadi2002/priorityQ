import { useState } from 'react';
import { Link } from 'react-router-dom';
import Alert from '../../components/Alert';
import Loader from '../../components/Loader';
import PageHead from '../../components/PageHead';
import StatGrid from '../../components/StatGrid';
import StaffServiceBar, { NoServiceAssigned, NoServicesExist } from '../../components/StaffServiceBar';
import { PriorityBadge, QueueStatusBadge, StatusBadge } from '../../components/Badges';
import usePolling from '../../hooks/usePolling';
import useStaffService from '../../hooks/useStaffService';
import { staffApi } from '../../services/endpoints';
import { formatMinutes, getErrorMessage, minutesBetween } from '../../utils/format';

export default function StaffDashboard() {
  const staffService = useStaffService();
  const { serviceId, isAdmin, loaded, services } = staffService;
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const assignedService = staffService.assignedService || services.find((service) => service._id === serviceId);

  usePolling(
    async () => {
      if (!serviceId) return;
      try {
        const res = await staffApi.stats(serviceId);
        setStats(res.stats);
        setError('');
      } catch (err) {
        setError(getErrorMessage(err));
      }
    },
    10000,
    [serviceId]
  );

  if (!loaded) return <Loader />;
  if (!serviceId) return isAdmin && services.length === 0 ? <NoServicesExist /> : <NoServiceAssigned />;

  return (
    <div className="pq-staff-dashboard">
      <PageHead
        title="Staff dashboard"
        subtitle={`Manage the ${assignedService?.name || 'assigned'} queue and serve customers efficiently.`}
      >
        <div className="pq-staff-dashboard__service">
          <div>
            <span>Assigned service</span>
            <strong>{assignedService?.name || 'Selected service'}</strong>
          </div>
          <QueueStatusBadge status={stats?.queueStatus} />
          {isAdmin && <StaffServiceBar staffService={staffService} />}
        </div>
      </PageHead>
      <Alert message={error} />

      {!stats ? (
        <Loader />
      ) : (
        <>
          <div className="pq-staff-dashboard__stats">
            <StatGrid
              items={[
                { label: 'Waiting', value: stats.waitingCount },
                { label: 'Being served', value: stats.currentServing.length },
                { label: 'Completed today', value: stats.completedToday },
                { label: 'Skipped today', value: stats.skippedCount },
                { label: 'Priority waiting', value: stats.urgentEmergencyCount, alert: stats.urgentEmergencyCount > 0 },
              ]}
            />
          </div>

          <div className="row g-3 mt-1">
            <div className="col-lg-7">
              <section className="pq-staff-card pq-staff-counter h-100">
                <div className="pq-staff-card__heading">
                  <div>
                    <span className="pq-staff-card__eyebrow">Current counter</span>
                    <h2>At the counter now</h2>
                  </div>
                  <span className="pq-staff-counter__signal" aria-hidden="true" />
                </div>
                {stats.currentServing.length === 0 ? (
                  <div className="pq-staff-counter__ready">
                    <div>
                      <h3>Counter is ready</h3>
                      <p>No customer is currently being served.</p>
                      <p className="pq-staff-counter__hint">
                        {stats.waitingCount > 0
                          ? `${stats.waitingCount} ${stats.waitingCount === 1 ? 'customer is' : 'customers are'} waiting.`
                          : 'No customers are waiting in the queue.'}
                      </p>
                    </div>
                    <Link to="/staff/controls" className="btn btn-primary">
                      Call Next Token
                    </Link>
                  </div>
                ) : (
                  <div className="pq-staff-counter__list">
                    {stats.currentServing.map((entry) => {
                      const activeSince = entry.status === 'SERVING' ? entry.servingStartedAt : entry.calledAt;
                      const elapsedMinutes = activeSince ? minutesBetween(activeSince, new Date()) : null;

                      return (
                        <article className="pq-staff-counter__entry" key={entry._id}>
                          <div className="pq-staff-counter__entry-main">
                            <div className="pq-staff-counter__token">{entry.tokenLabel}</div>
                            <div className="pq-staff-counter__customer">{entry.user?.name || 'Customer'}</div>
                          </div>
                          <div className="pq-staff-counter__entry-meta">
                            <PriorityBadge priority={entry.priority} />
                            <StatusBadge status={entry.status} />
                            {elapsedMinutes !== null && (
                              <span className="pq-staff-counter__elapsed">
                                {entry.status === 'SERVING' ? 'Serving for' : 'Called'} {formatMinutes(elapsedMinutes)}
                              </span>
                            )}
                          </div>
                        </article>
                      );
                    })}
                    <Link to="/staff/controls" className="btn btn-primary pq-staff-counter__action">
                      Open Counter
                    </Link>
                  </div>
                )}
              </section>
            </div>
            <div className="col-lg-5">
              <section className="pq-staff-card pq-staff-overview h-100">
                <div className="pq-staff-card__heading">
                  <div>
                    <span className="pq-staff-card__eyebrow">Live service snapshot</span>
                    <h2>Queue overview</h2>
                  </div>
                  <QueueStatusBadge status={stats.queueStatus} />
                </div>
                <dl className="pq-staff-overview__metrics">
                  <div>
                    <dt>Assigned service</dt>
                    <dd>{assignedService?.name || 'Selected service'}</dd>
                  </div>
                  <div>
                    <dt>People waiting</dt>
                    <dd>{stats.waitingCount}</dd>
                  </div>
                  <div>
                    <dt>Average service time</dt>
                    <dd>{formatMinutes(stats.avgServiceMinutes)}</dd>
                  </div>
                  <div>
                    <dt>Urgent / emergency waiting</dt>
                    <dd className={stats.urgentEmergencyCount > 0 ? 'pq-staff-overview__priority' : ''}>
                      {stats.urgentEmergencyCount}
                    </dd>
                  </div>
                </dl>
                <div className="pq-staff-overview__actions">
                  <Link to="/staff/queue" className="btn btn-outline-primary">
                    View Full Queue
                  </Link>
                  <Link to="/staff/controls" className="btn btn-outline-secondary">
                    Manage Queue
                  </Link>
                </div>
              </section>
            </div>
          </div>

          <section className="pq-staff-quick-actions" aria-label="Quick actions">
            <h2>Quick actions</h2>
            <div className="pq-staff-quick-actions__links">
              <Link to="/staff/controls" className="pq-staff-quick-action">
                <span className="pq-staff-quick-action__marker" aria-hidden="true" />
                <span>Open Counter</span>
              </Link>
              <Link to="/staff/queue" className="pq-staff-quick-action">
                <span className="pq-staff-quick-action__marker" aria-hidden="true" />
                <span>View Active Queue</span>
              </Link>
              <Link to="/staff/history" className="pq-staff-quick-action">
                <span className="pq-staff-quick-action__marker" aria-hidden="true" />
                <span>View History</span>
              </Link>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
