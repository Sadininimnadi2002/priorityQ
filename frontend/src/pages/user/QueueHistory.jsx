import { useEffect, useState } from 'react';
import Alert from '../../components/Alert';
import Loader from '../../components/Loader';
import PageHead from '../../components/PageHead';
import { PriorityBadge, StatusBadge } from '../../components/Badges';
import { queueApi } from '../../services/endpoints';
import { formatDateTime, formatMinutes, getErrorMessage, minutesBetween } from '../../utils/format';

export default function QueueHistory() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    queueApi
      .history()
      .then((res) => setEntries(res.entries))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader />;

  return (
    <>
      <PageHead title="Queue history" subtitle="Your finished, skipped and cancelled tokens." />
      <Alert message={error} />

      {entries.length === 0 ? (
        <div className="pq-panel pq-empty">
          <h2>No history yet</h2>
          <p className="mb-0">Tokens appear here after they are completed, skipped or cancelled.</p>
        </div>
      ) : (
        <div className="pq-table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Token</th>
                <th>Service</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Joined</th>
                <th>Waited</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e._id}>
                  <td className="fw-semibold">{e.tokenLabel}</td>
                  <td>{e.service?.name || 'Removed service'}</td>
                  <td>
                    <StatusBadge status={e.status} />
                  </td>
                  <td>
                    <PriorityBadge priority={e.priority} />
                  </td>
                  <td>{formatDateTime(e.joinedAt)}</td>
                  <td>{e.calledAt ? formatMinutes(minutesBetween(e.joinedAt, e.calledAt)) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
