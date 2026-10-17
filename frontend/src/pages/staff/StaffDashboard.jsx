import { useState } from 'react';
import { Link } from 'react-router-dom';
import Alert from '../../components/Alert';
import Loader from '../../components/Loader';
import PageHead from '../../components/PageHead';
import StatGrid from '../../components/StatGrid';
import StaffServiceBar, { NoServiceAssigned, NoServicesExist } from '../../components/StaffServiceBar';
import { QueueStatusBadge, StatusBadge } from '../../components/Badges';
import usePolling from '../../hooks/usePolling';
import useStaffService from '../../hooks/useStaffService';
import { staffApi } from '../../services/endpoints';
import { formatMinutes, getErrorMessage } from '../../utils/format';

export default function StaffDashboard() {
  const staffService = useStaffService();
  const { serviceId, isAdmin, loaded, services } = staffService;
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

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
    <>
      <PageHead title="Staff dashboard" subtitle="Today's numbers for your service. Updates every 10 seconds.">
        <StaffServiceBar staffService={staffService} />
      </PageHead>
      <Alert message={error} />

      {!stats ? (
        <Loader />
      ) : (
        <>
          <StatGrid
            items={[
              { label: 'Waiting', value: stats.waitingCount },
              { label: 'Being served', value: stats.currentServing.length },
              { label: 'Completed today', value: stats.completedToday },
              { label: 'Skipped today', value: stats.skippedCount },
              { label: 'Urgent and emergency waiting', value: stats.urgentEmergencyCount, alert: stats.urgentEmergencyCount > 0 },
            ]}
          />

          <div className="row g-3 mt-1">
            <div className="col-lg-7">
              <div className="pq-panel h-100">
                <h2>At the counter now</h2>
                {stats.currentServing.length === 0 ? (
                  <p className="text-secondary mb-0">Nobody is at the counter. Call the next token to start.</p>
                ) : (
                  stats.currentServing.map((e) => (
                    <div className="pq-now" key={e._id}>
                      <div>
                        <div className="pq-now__token">{e.tokenLabel}</div>
                        <div className="text-secondary">{e.user?.name}</div>
                      </div>
                      <StatusBadge status={e.status} />
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="col-lg-5">
              <div className="pq-panel h-100">
                <h2>Queue</h2>
                <p className="mb-2">
                  Status: <QueueStatusBadge status={stats.queueStatus} />
                </p>
                <p className="text-secondary">Average time per person: {formatMinutes(stats.avgServiceMinutes)}</p>
                <div className="d-flex flex-wrap gap-2">
                  <Link to="/staff/controls" className="btn btn-primary">
                    Open counter
                  </Link>
                  <Link to="/staff/queue" className="btn btn-outline-primary">
                    See full queue
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
