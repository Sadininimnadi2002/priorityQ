import { useState } from 'react';
import Alert from '../../components/Alert';
import Loader from '../../components/Loader';
import PageHead from '../../components/PageHead';
import StatGrid from '../../components/StatGrid';
import { QueueStatusBadge } from '../../components/Badges';
import usePolling from '../../hooks/usePolling';
import { adminApi } from '../../services/endpoints';
import { formatMinutes, getErrorMessage } from '../../utils/format';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [queues, setQueues] = useState([]);
  const [error, setError] = useState('');

  usePolling(async () => {
    try {
      const [s, q] = await Promise.all([adminApi.stats(), adminApi.queues()]);
      setStats(s.stats);
      setQueues(q.queues);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, 15000);

  if (!stats && !error) return <Loader />;

  return (
    <>
      <PageHead title="Admin dashboard" subtitle="The whole system today. Updates every 15 seconds." />
      <Alert message={error} />

      {stats && (
        <StatGrid
          items={[
            { label: 'Customers', value: stats.totalUsers },
            { label: 'Staff', value: stats.totalStaff },
            { label: 'Services', value: stats.totalServices },
            { label: 'Active queues', value: stats.activeQueues },
            { label: 'Served today', value: stats.usersServedToday },
            { label: 'Average wait today', value: formatMinutes(stats.avgWaitingMinutes) },
          ]}
        />
      )}

      <h2 className="h5 mt-4 mb-3">All queues</h2>
      {queues.length === 0 ? (
        <div className="pq-panel pq-empty">
          <p className="mb-0">No services yet. Add one in Services.</p>
        </div>
      ) : (
        <div className="pq-table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Queue</th>
                <th>Waiting</th>
                <th>Emergency</th>
                <th>Urgent</th>
                <th>Normal</th>
                <th>At counter</th>
                <th>Staff</th>
              </tr>
            </thead>
            <tbody>
              {queues.map((q) => (
                <tr key={q.service._id}>
                  <td className="fw-semibold">{q.service.name}</td>
                  <td>
                    <QueueStatusBadge status={q.service.queueStatus} isActive={q.service.isActive} />
                  </td>
                  <td>{q.waiting}</td>
                  <td className={q.byPriority.EMERGENCY ? 'text-danger fw-bold' : ''}>{q.byPriority.EMERGENCY}</td>
                  <td>{q.byPriority.URGENT}</td>
                  <td>{q.byPriority.NORMAL}</td>
                  <td>{q.called + q.serving}</td>
                  <td>{q.staff.length ? q.staff.map((s) => s.name).join(', ') : <span className="text-secondary">None</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
