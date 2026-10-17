import { useState } from 'react';
import { Link } from 'react-router-dom';
import Alert from '../../components/Alert';
import Loader from '../../components/Loader';
import PageHead from '../../components/PageHead';
import StatGrid from '../../components/StatGrid';
import { PriorityBadge, QueueStatusBadge, StatusBadge } from '../../components/Badges';
import { useAuth } from '../../context/AuthContext';
import usePolling from '../../hooks/usePolling';
import { queueApi } from '../../services/endpoints';
import { formatMinutes, getErrorMessage } from '../../utils/format';

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

  return (
    <>
      <PageHead title={`Hello, ${user.name.split(' ')[0]}`} subtitle="Your queue at a glance. This page updates by itself." />
      <Alert message={error} />

      {loading && <Loader />}

      {!loading && !entry && (
        <div className="pq-panel pq-empty">
          <h2>You are not in a queue</h2>
          <p>Pick a service and join its queue to get a token.</p>
          <Link to="/services" className="btn btn-primary">
            See services
          </Link>
        </div>
      )}

      {entry && (
        <>
          {entry.status === 'CALLED' && (
            <div className="alert alert-success fw-semibold">
              Token {entry.tokenLabel} has been called. Please go to the counter now.
            </div>
          )}
          <StatGrid
            items={[
              { label: 'Active token', value: entry.tokenLabel },
              { label: 'Position', value: waiting ? info?.position ?? '-' : '-' },
              { label: 'People ahead', value: waiting ? info?.peopleAhead ?? '-' : '-' },
              { label: 'Estimated wait', value: waiting ? formatMinutes(info?.estimatedWaitMinutes) : '-' },
            ]}
          />
          <div className="pq-panel mt-3 d-flex flex-wrap gap-4 align-items-center">
            <div>
              <div className="text-secondary small">Service</div>
              <div className="fw-semibold">{entry.service?.name}</div>
            </div>
            <div>
              <div className="text-secondary small">Token status</div>
              <StatusBadge status={entry.status} />
            </div>
            <div>
              <div className="text-secondary small">Priority</div>
              <PriorityBadge priority={entry.priority} />
            </div>
            <div>
              <div className="text-secondary small">Queue</div>
              <QueueStatusBadge status={info?.queueStatus || entry.service?.queueStatus} />
            </div>
            <Link to="/token" className="btn btn-outline-primary ms-auto">
              Open my token
            </Link>
          </div>
        </>
      )}
    </>
  );
}
