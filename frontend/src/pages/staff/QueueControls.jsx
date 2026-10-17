import { useState } from 'react';
import Alert from '../../components/Alert';
import Loader from '../../components/Loader';
import PageHead from '../../components/PageHead';
import StaffServiceBar, { NoServiceAssigned, NoServicesExist } from '../../components/StaffServiceBar';
import { PriorityBadge, QueueStatusBadge, StatusBadge } from '../../components/Badges';
import usePolling from '../../hooks/usePolling';
import useStaffService from '../../hooks/useStaffService';
import { staffApi } from '../../services/endpoints';
import { getErrorMessage } from '../../utils/format';

const STATUS_ACTIONS = [
  { status: 'OPEN', label: 'Open', help: 'People can join. You can call tokens.' },
  { status: 'PAUSED', label: 'Pause', help: 'Nobody can join and no new tokens are called, for example during a break.' },
  { status: 'CLOSED', label: 'Close', help: 'Nobody new can join. You can still call people already waiting.' },
];

export default function QueueControls() {
  const staffService = useStaffService();
  const { serviceId, isAdmin, loaded, services } = staffService;
  const [queue, setQueue] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!serviceId) return;
    try {
      setQueue(await staffApi.queue(serviceId));
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  usePolling(load, 5000, [serviceId]);

  const run = async (action) => {
    setBusy(true);
    setError('');
    try {
      const res = await action();
      setNotice(res.message || 'Done');
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return <Loader />;
  if (!serviceId) return isAdmin && services.length === 0 ? <NoServicesExist /> : <NoServiceAssigned />;
  if (!queue) return <Loader />;

  const { service } = queue;
  const current = STATUS_ACTIONS.find((a) => a.status === service.queueStatus);
  const nextUp = queue.waiting.slice(0, 3);

  return (
    <>
      <PageHead title="Counter" subtitle="Call people and move them through the service.">
        <StaffServiceBar staffService={staffService} />
      </PageHead>
      <Alert message={error} onClose={() => setError('')} />
      <Alert type="success" message={notice} onClose={() => setNotice('')} />

      <div className="row g-3">
        <div className="col-lg-7">
          <div className="pq-panel mb-3">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
              <div>
                <h2 className="h5 mb-1">Next person</h2>
                <p className="text-secondary mb-0">
                  {queue.waiting.length === 0
                    ? 'Nobody is waiting.'
                    : `${queue.waiting.length} waiting. The queue order decides who is next.`}
                </p>
              </div>
              <button
                className="btn btn-primary pq-call-next"
                disabled={busy || queue.waiting.length === 0 || service.queueStatus === 'PAUSED' || !service.isActive}
                onClick={() => run(() => staffApi.callNext(serviceId))}
              >
                Call next token
              </button>
            </div>
            {nextUp.length > 0 && (
              <ol className="list-unstyled d-flex flex-wrap gap-3 mt-3 mb-0">
                {nextUp.map((e) => (
                  <li key={e._id} className="d-flex align-items-center gap-2">
                    <span className="fw-semibold">{e.tokenLabel}</span>
                    <PriorityBadge priority={e.priority} />
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="pq-panel">
            <h2>At the counter</h2>
            {queue.inProgress.length === 0 ? (
              <p className="text-secondary mb-0">Nobody yet. Call the next token.</p>
            ) : (
              queue.inProgress.map((e) => (
                <div className="pq-now" key={e._id}>
                  <div>
                    <div className="pq-now__token">{e.tokenLabel}</div>
                    <div className="text-secondary">
                      {e.user?.name} <StatusBadge status={e.status} />
                    </div>
                  </div>
                  <div className="d-flex gap-2">
                    {e.status === 'CALLED' && (
                      <>
                        <button className="btn btn-primary" disabled={busy} onClick={() => run(() => staffApi.serve(e._id))}>
                          Start serving
                        </button>
                        <button className="btn btn-outline-secondary" disabled={busy} onClick={() => run(() => staffApi.skip(e._id))}>
                          Did not show up
                        </button>
                      </>
                    )}
                    {e.status === 'SERVING' && (
                      <button className="btn btn-primary" disabled={busy} onClick={() => run(() => staffApi.complete(e._id))}>
                        Complete
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="col-lg-5">
          <div className="pq-panel">
            <h2>Queue status</h2>
            <p className="mb-2">
              Now: <QueueStatusBadge status={service.queueStatus} isActive={service.isActive} />
            </p>
            {current && <p className="text-secondary small">{current.help}</p>}
            {!service.isActive ? (
              <p className="text-secondary mb-0">An admin has turned this service off.</p>
            ) : (
              <div className="btn-group w-100" role="group" aria-label="Queue status">
                {STATUS_ACTIONS.map((a) => (
                  <button
                    key={a.status}
                    className={`btn ${service.queueStatus === a.status ? 'btn-dark' : 'btn-outline-secondary'}`}
                    disabled={busy || service.queueStatus === a.status}
                    onClick={() => run(() => staffApi.setQueueStatus(serviceId, a.status))}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
