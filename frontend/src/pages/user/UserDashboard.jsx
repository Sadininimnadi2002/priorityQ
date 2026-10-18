import { useState } from 'react';
import { Link } from 'react-router-dom';
import Alert from '../../components/Alert';
import Loader from '../../components/Loader';
import PageHead from '../../components/PageHead';
import { PriorityBadge, QueueStatusBadge, StatusBadge } from '../../components/Badges';
import { useAuth } from '../../context/AuthContext';
import usePolling from '../../hooks/usePolling';
import { queueApi } from '../../services/endpoints';
import { formatDateTime, formatMinutes, getErrorMessage } from '../../utils/format';

export default function UserDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null); // { entry, queueInfo }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Refresh every 10 seconds so the position stays current
  usePolling(async () => {
    try {
      const res = await queueApi.myActive();
      setData(res);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, 10000);

  const entry = data?.entry;
  const info = data?.queueInfo;
  const waiting = entry?.status === 'WAITING';
  const averageMinutes = info?.avgMinutes ?? entry?.service?.avgServiceMinutes;

  return (
    <>
      <PageHead title={`Hello, ${user.name.split(' ')[0]}`} subtitle="Track your current queue status in real time." />
      <Alert message={error} />

      {loading && <Loader />}

      {!loading && !entry && (
        <div className="pq-dashboard-empty">
          <span className="pq-dashboard-empty__mark" aria-hidden="true" />
          <h2>You are not currently in a queue.</h2>
          <p>Choose a service and join its virtual queue to receive a digital token.</p>
          <Link to="/services" className="btn btn-primary">
            Browse Services
          </Link>
        </div>
      )}

      {entry && (
        <section className={`pq-dashboard-card pq-dashboard-card--${entry.status.toLowerCase()}`} aria-live="polite">
          <div className="pq-dashboard-card__topline">
            <span className="pq-dashboard-card__eyebrow">Active token</span>
            <div className="pq-dashboard-card__badges">
              <StatusBadge status={entry.status} />
              <QueueStatusBadge status={info?.queueStatus || entry.service?.queueStatus} />
            </div>
          </div>

          {entry.status === 'CALLED' && (
            <div className="pq-dashboard-card__callout">
              Token {entry.tokenLabel} has been called. Please go to the counter now.
            </div>
          )}

          <div className="pq-dashboard-card__identity">
            <div className="pq-dashboard-card__token">{entry.tokenLabel}</div>
            <h2>{entry.service?.name || 'Service'}</h2>
          </div>

          <dl className="pq-dashboard-metrics">
            <div>
              <dt>Position</dt>
              <dd>{waiting ? info?.position ?? '-' : '-'}</dd>
            </div>
            <div>
              <dt>People ahead</dt>
              <dd>{waiting ? info?.peopleAhead ?? '-' : '-'}</dd>
            </div>
            <div>
              <dt>Estimated wait</dt>
              <dd>{waiting ? formatMinutes(info?.estimatedWaitMinutes) : '-'}</dd>
            </div>
            <div>
              <dt>Average service time</dt>
              <dd>{averageMinutes !== null && averageMinutes !== undefined ? formatMinutes(averageMinutes) : '-'}</dd>
            </div>
          </dl>

          <div className="pq-dashboard-card__footer">
            <div className="pq-dashboard-card__details">
              <div>
                <span>Priority</span>
                <PriorityBadge priority={entry.priority} />
              </div>
              {entry.joinedAt && (
                <div>
                  <span>Joined</span>
                  <strong>{formatDateTime(entry.joinedAt)}</strong>
                </div>
              )}
            </div>
            <Link to="/token" className="btn btn-primary">
              View My Token
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
