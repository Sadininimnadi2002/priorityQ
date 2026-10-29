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
                { label: 'Currently Called', value: stats.calledEntries?.length || 0 },
                { label: 'Being Served', value: stats.servingEntries?.length || 0 },
                { label: 'Completed today', value: stats.completedToday },
                { label: 'Skipped today', value: stats.skippedCount },
                { label: 'Emergency waiting', value: stats.emergencyWaitingCount || 0, alert: (stats.emergencyWaitingCount || 0) > 0 },
                { label: 'Urgent waiting', value: stats.urgentWaitingCount || 0, alert: (stats.urgentWaitingCount || 0) > 0 },
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
                {(!stats.calledEntries?.length && !stats.servingEntries?.length && stats.currentServing.length === 0) ? (
                  <div className="pq-staff-counter__ready">
                    <div>
                      <h3>Counter is ready</h3>
                      <p>No customer is currently called or being served.</p>
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
                    {/* Currently Served Customers */}
                    {(stats.servingEntries || []).map((entry) => {
                      const elapsedMinutes = entry.servingStartedAt ? minutesBetween(entry.servingStartedAt, new Date()) : null;
                      return (
                        <article className="pq-staff-counter__entry border-start border-4 border-success" key={entry._id}>
                          <div className="pq-staff-counter__entry-main">
                            <div className="pq-staff-counter__token">{entry.tokenLabel}</div>
                            <div className="pq-staff-counter__customer">
                              {entry.user?.name || 'Customer'}
                              <span className="badge bg-success ms-2">Serving</span>
                            </div>
                          </div>
                          <div className="pq-staff-counter__entry-meta">
                            <PriorityBadge priority={entry.priority} />
                            <StatusBadge status={entry.status} />
                            {elapsedMinutes !== null && (
                              <span className="pq-staff-counter__elapsed">
                                Serving for {formatMinutes(elapsedMinutes)}
                              </span>
                            )}
                          </div>
                        </article>
                      );
                    })}

                    {/* Currently Called Customers */}
                    {(stats.calledEntries || []).map((entry) => {
                      const elapsedMinutes = entry.calledAt ? minutesBetween(entry.calledAt, new Date()) : null;
                      return (
                        <article className="pq-staff-counter__entry border-start border-4 border-primary" key={entry._id}>
                          <div className="pq-staff-counter__entry-main">
                            <div className="pq-staff-counter__token">{entry.tokenLabel}</div>
                            <div className="pq-staff-counter__customer">
                              {entry.user?.name || 'Customer'}
                              <span className="badge bg-primary ms-2">Called - Awaiting arrival</span>
                            </div>
                          </div>
                          <div className="pq-staff-counter__entry-meta">
                            <PriorityBadge priority={entry.priority} />
                            <StatusBadge status={entry.status} />
                            {elapsedMinutes !== null && (
                              <span className="pq-staff-counter__elapsed">
                                Called {formatMinutes(elapsedMinutes)} ago
                              </span>
                            )}
                          </div>
                        </article>
                      );
                    })}

                    <Link to="/staff/controls" className="btn btn-primary pq-staff-counter__action">
                      Open Counter Controls
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
                    <dt>Queue status</dt>
                    <dd><QueueStatusBadge status={stats.queueStatus} /></dd>
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
                    <dt>Emergency waiting</dt>
                    <dd className={stats.emergencyWaitingCount > 0 ? 'text-danger fw-bold' : ''}>
                      {stats.emergencyWaitingCount || 0}
                    </dd>
                  </div>
                  <div>
                    <dt>Urgent waiting</dt>
                    <dd className={stats.urgentWaitingCount > 0 ? 'pq-staff-overview__priority' : ''}>
                      {stats.urgentWaitingCount || 0}
                    </dd>
                  </div>
                  <div>
                    <dt>Completed today</dt>
                    <dd>{stats.completedToday || 0}</dd>
                  </div>
                  <div>
                    <dt>Skipped today</dt>
                    <dd>{stats.skippedCount || 0}</dd>
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
