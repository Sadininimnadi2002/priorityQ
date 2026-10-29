import { useState } from 'react';
import Alert from '../../components/Alert';
import Loader from '../../components/Loader';
import PageHead from '../../components/PageHead';
import StaffServiceBar, { NoServiceAssigned, NoServicesExist } from '../../components/StaffServiceBar';
import { PriorityBadge, QueueStatusBadge, StatusBadge } from '../../components/Badges';
import usePolling from '../../hooks/usePolling';
import useStaffService from '../../hooks/useStaffService';
import { staffApi } from '../../services/endpoints';
import { formatMinutes, getErrorMessage, minutesBetween } from '../../utils/format';

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
      setNotice(res.message || 'Action completed successfully');
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
  const nextUp = queue.waiting.slice(0, 3);

  const statusActions = [
    {
      status: 'OPEN',
      label: service.queueStatus === 'PAUSED' ? 'Resume Queue' : 'Open Queue',
      help: 'Customers can join the queue and tokens can be called.',
    },
    {
      status: 'PAUSED',
      label: 'Pause Queue',
      help: 'No new customers can join and token calling is paused (e.g. for breaks).',
    },
    {
      status: 'CLOSED',
      label: 'Close Queue',
      help: 'No new customers can join, but you can continue calling customers already waiting.',
    },
  ];

  const currentAction = statusActions.find((a) => a.status === service.queueStatus);

  return (
    <>
      <PageHead title="Counter Controls" subtitle="Manage queue status, call customers, and progress service.">
        <StaffServiceBar staffService={staffService} />
      </PageHead>
      <Alert message={error} onClose={() => setError('')} />
      <Alert type="success" message={notice} onClose={() => setNotice('')} />

      <div className="row g-3">
        <div className="col-lg-7">
          <div className="pq-panel mb-3">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
              <div>
                <h2 className="h5 mb-1">Next customer in line</h2>
                <p className="text-secondary mb-0">
                  {queue.waiting.length === 0
                    ? 'No customers are currently waiting.'
                    : `${queue.waiting.length} waiting. Tokens are called by priority order.`}
                </p>
                {service.queueStatus === 'PAUSED' && (
                  <p className="text-warning small mt-1 mb-0 fw-semibold">
                    Queue is paused. Resume the queue before calling tokens.
                  </p>
                )}
                {service.queueStatus === 'CLOSED' && queue.waiting.length > 0 && (
                  <p className="text-info small mt-1 mb-0">
                    Queue is closed for new joins, but you may call waiting customers.
                  </p>
                )}
              </div>
              <button
                className="btn btn-primary pq-call-next"
                disabled={busy || queue.waiting.length === 0 || service.queueStatus === 'PAUSED' || !service.isActive}
                onClick={() => run(() => staffApi.callNext(serviceId))}
              >
                {busy ? 'Calling...' : 'Call next token'}
              </button>
            </div>
            {nextUp.length > 0 && (
              <ol className="list-unstyled d-flex flex-wrap gap-3 mt-3 mb-0 pt-2 border-top">
                {nextUp.map((e, idx) => (
                  <li key={e._id} className="d-flex align-items-center gap-2">
                    <span className="text-muted small">#{idx + 1}</span>
                    <span className="fw-semibold">{e.tokenLabel}</span>
                    <PriorityBadge priority={e.priority} />
                    <span className="text-secondary small">({e.user?.name})</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="pq-panel">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="h5 mb-0">At the counter</h2>
              <span className="badge bg-light text-dark border">
                {queue.inProgress.length} active at counter
              </span>
            </div>

            {queue.inProgress.length === 0 ? (
              <div className="text-center py-4 text-secondary">
                <p className="mb-2">No customer is currently called or being served.</p>
                {queue.waiting.length > 0 && service.queueStatus !== 'PAUSED' && (
                  <button
                    className="btn btn-sm btn-outline-primary"
                    disabled={busy}
                    onClick={() => run(() => staffApi.callNext(serviceId))}
                  >
                    Call Next Waiting Customer ({queue.waiting[0].tokenLabel})
                  </button>
                )}
              </div>
            ) : (
              queue.inProgress.map((e) => {
                const activeSince = e.status === 'SERVING' ? e.servingStartedAt : e.calledAt;
                const elapsedMinutes = activeSince ? minutesBetween(activeSince, new Date()) : null;

                return (
                  <div className="pq-now mb-3 p-3 border rounded" key={e._id}>
                    <div>
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <span className="pq-now__token fs-4 fw-bold text-primary">{e.tokenLabel}</span>
                        <PriorityBadge priority={e.priority} />
                        <StatusBadge status={e.status} />
                      </div>
                      <div className="text-secondary">
                        <strong>{e.user?.name}</strong>
                        {e.user?.phone && <span className="ms-2">({e.user.phone})</span>}
                      </div>
                      {elapsedMinutes !== null && (
                        <div className="small text-muted mt-1">
                          {e.status === 'SERVING' ? 'Serving for' : 'Called'} {formatMinutes(elapsedMinutes)}
                        </div>
                      )}
                    </div>
                    <div className="d-flex gap-2 align-items-center flex-wrap mt-2 mt-md-0">
                      {e.status === 'CALLED' && (
                        <>
                          <button
                            className="btn btn-success"
                            disabled={busy}
                            onClick={() => run(() => staffApi.serve(e._id))}
                          >
                            Start serving
                          </button>
                          <button
                            className="btn btn-outline-danger"
                            disabled={busy}
                            onClick={() => run(() => staffApi.skip(e._id))}
                          >
                            Skip (No show)
                          </button>
                        </>
                      )}
                      {e.status === 'SERVING' && (
                        <button
                          className="btn btn-primary"
                          disabled={busy}
                          onClick={() => run(() => staffApi.complete(e._id))}
                        >
                          Complete service
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="col-lg-5">
          <div className="pq-panel">
            <h2 className="h5 mb-2">Queue Controls</h2>
            <div className="mb-3 d-flex align-items-center gap-2">
              <span className="text-secondary">Current State:</span>
              <QueueStatusBadge status={service.queueStatus} isActive={service.isActive} />
            </div>

            {currentAction && (
              <div className="alert alert-light border small mb-3">
                {currentAction.help}
              </div>
            )}

            {!service.isActive ? (
              <div className="alert alert-danger mb-0">
                This service has been deactivated by an administrator. Queue actions are disabled.
              </div>
            ) : (
              <div className="d-flex flex-column gap-2" role="group" aria-label="Queue status options">
                {statusActions.map((a) => {
                  const isCurrent = service.queueStatus === a.status;
                  let btnClass = 'btn-outline-secondary';
                  if (isCurrent) {
                    btnClass = a.status === 'OPEN' ? 'btn-success' : a.status === 'PAUSED' ? 'btn-warning' : 'btn-dark';
                  }
                  return (
                    <button
                      key={a.status}
                      className={`btn ${btnClass} d-flex justify-content-between align-items-center p-2 px-3`}
                      disabled={busy || isCurrent}
                      onClick={() => run(() => staffApi.setQueueStatus(serviceId, a.status))}
                    >
                      <span className="fw-semibold">{a.label}</span>
                      {isCurrent && <span className="badge bg-white text-dark ms-2">Active</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
