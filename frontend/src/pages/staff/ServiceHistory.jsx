import { useState } from 'react';
import Alert from '../../components/Alert';
import Loader from '../../components/Loader';
import PageHead from '../../components/PageHead';
import StaffServiceBar, { NoServiceAssigned, NoServicesExist } from '../../components/StaffServiceBar';
import { PriorityBadge, StatusBadge } from '../../components/Badges';
import usePolling from '../../hooks/usePolling';
import useStaffService from '../../hooks/useStaffService';
import { staffApi } from '../../services/endpoints';
import { formatDateTime, formatMinutes, getErrorMessage, minutesBetween } from '../../utils/format';

export default function ServiceHistory() {
  const staffService = useStaffService();
  const { serviceId, isAdmin, loaded, services } = staffService;
  const [todayOnly, setTodayOnly] = useState(true);
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState('');

  usePolling(
    async () => {
      if (!serviceId) return;
      try {
        const res = await staffApi.history(serviceId, { today: todayOnly ? 'true' : undefined });
        setEntries(res.entries);
        setError('');
      } catch (err) {
        setError(getErrorMessage(err));
      }
    },
    30000,
    [serviceId, todayOnly]
  );

  if (!loaded) return <Loader />;
  if (!serviceId) return isAdmin && services.length === 0 ? <NoServicesExist /> : <NoServiceAssigned />;

  return (
    <>
      <PageHead title="Service history" subtitle="Tokens that were completed, skipped or cancelled.">
        <StaffServiceBar staffService={staffService} />
        <div className="btn-group" role="group" aria-label="Period">
          <button className={`btn btn-sm ${todayOnly ? 'btn-dark' : 'btn-outline-secondary'}`} onClick={() => setTodayOnly(true)}>
            Today
          </button>
          <button className={`btn btn-sm ${!todayOnly ? 'btn-dark' : 'btn-outline-secondary'}`} onClick={() => setTodayOnly(false)}>
            Last 100
          </button>
        </div>
      </PageHead>
      <Alert message={error} />

      {!entries ? (
        <Loader />
      ) : entries.length === 0 ? (
        <div className="pq-panel pq-empty">
          <p className="mb-0">No finished tokens for this period.</p>
        </div>
      ) : (
        <div className="pq-table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Token</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Joined</th>
                <th>Waited</th>
                <th>Service time</th>
                <th>Handled by</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e._id}>
                  <td className="fw-semibold">{e.tokenLabel}</td>
                  <td>{e.user?.name || '-'}</td>
                  <td>
                    <StatusBadge status={e.status} />
                  </td>
                  <td>
                    <PriorityBadge priority={e.priority} />
                  </td>
                  <td>{formatDateTime(e.joinedAt)}</td>
                  <td>{e.calledAt ? formatMinutes(minutesBetween(e.joinedAt, e.calledAt)) : '-'}</td>
                  <td>{e.completedAt ? formatMinutes(minutesBetween(e.servingStartedAt, e.completedAt)) : '-'}</td>
                  <td>{e.handledBy?.name || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
