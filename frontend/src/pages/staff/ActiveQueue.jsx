import { useState } from 'react';
import Alert from '../../components/Alert';
import Loader from '../../components/Loader';
import PageHead from '../../components/PageHead';
import StaffServiceBar, { NoServiceAssigned, NoServicesExist } from '../../components/StaffServiceBar';
import { PriorityBadge, QueueStatusBadge, StatusBadge } from '../../components/Badges';
import PriorityModal from './PriorityModal';
import usePolling from '../../hooks/usePolling';
import useStaffService from '../../hooks/useStaffService';
import { staffApi } from '../../services/endpoints';
import { formatMinutes, formatTime, getErrorMessage, titleCase } from '../../utils/format';

export default function ActiveQueue() {
  const staffService = useStaffService();
  const { serviceId, isAdmin, loaded, services } = staffService;
  const [queue, setQueue] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [priorityEntry, setPriorityEntry] = useState(null);

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

  // Run any staff action, show the result, then reload the queue
  const run = async (id, action) => {
    setBusyId(id);
    setError('');
    try {
      const res = await action();
      setNotice(res.message || 'Done');
      await load();
      return true;
    } catch (err) {
      setError(getErrorMessage(err));
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const savePriority = async (priority, reason) => {
    const ok = await run(priorityEntry._id, () => staffApi.changePriority(priorityEntry._id, priority, reason));
    if (ok) setPriorityEntry(null);
  };

  if (!loaded) return <Loader />;
  if (!serviceId) return isAdmin && services.length === 0 ? <NoServicesExist /> : <NoServiceAssigned />;

  return (
    <>
      <PageHead title="Active queue" subtitle="Everyone waiting, in the order they will be called. Updates every 5 seconds.">
        <StaffServiceBar staffService={staffService} />
      </PageHead>
      <Alert message={error} onClose={() => setError('')} />
      <Alert type="success" message={notice} onClose={() => setNotice('')} />

      {!queue ? (
        <Loader />
      ) : (
        <>
          <div className="d-flex flex-wrap gap-3 align-items-center mb-3">
            <span>
              Queue: <QueueStatusBadge status={queue.service.queueStatus} isActive={queue.service.isActive} />
            </span>
            <span className="text-secondary">
              {queue.waiting.length} waiting, about {formatMinutes(queue.avgMinutes)} per person
            </span>
          </div>

          {queue.inProgress.length > 0 && (
            <section className="mb-4">
              <h2 className="h5">At the counter</h2>
              <div className="pq-table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Token</th>
                      <th>Customer</th>
                      <th>Status</th>
                      <th>Called at</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.inProgress.map((e) => (
                      <tr key={e._id}>
                        <td className="fw-semibold">{e.tokenLabel}</td>
                        <td>{e.user?.name}</td>
                        <td>
                          <StatusBadge status={e.status} />
                        </td>
                        <td>{formatTime(e.calledAt)}</td>
                        <td className="text-end text-nowrap">
                          {e.status === 'CALLED' && (
                            <>
                              <button className="btn btn-sm btn-primary me-2" disabled={busyId === e._id} onClick={() => run(e._id, () => staffApi.serve(e._id))}>
                                Start serving
                              </button>
                              <button className="btn btn-sm btn-outline-secondary" disabled={busyId === e._id} onClick={() => run(e._id, () => staffApi.skip(e._id))}>
                                Skip
                              </button>
                            </>
                          )}
                          {e.status === 'SERVING' && (
                            <button className="btn btn-sm btn-primary" disabled={busyId === e._id} onClick={() => run(e._id, () => staffApi.complete(e._id))}>
                              Complete
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="mb-4">
            <h2 className="h5">Waiting</h2>
            {queue.waiting.length === 0 ? (
              <div className="pq-panel pq-empty">
                <p className="mb-0">Nobody is waiting right now.</p>
              </div>
            ) : (
              <div className="pq-table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Token</th>
                      <th>Customer</th>
                      <th>Priority</th>
                      <th>Waited</th>
                      <th>Estimated wait</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.waiting.map((e) => (
                      <tr key={e._id}>
                        <td>{e.position}</td>
                        <td className="fw-semibold">{e.tokenLabel}</td>
                        <td>
                          {e.user?.name}
                          {e.user?.phone && <div className="small text-secondary">{e.user.phone}</div>}
                        </td>
                        <td>
                          <PriorityBadge priority={e.priority} />
                          {e.boosted && <div className="pq-boost">Treated as {titleCase(e.effectivePriority)} after a long wait</div>}
                        </td>
                        <td>{formatMinutes(e.waitedMinutes)}</td>
                        <td>{formatMinutes(e.estimatedWaitMinutes)}</td>
                        <td className="text-end text-nowrap">
                          <button className="btn btn-sm btn-primary me-2" disabled={busyId === e._id} onClick={() => run(e._id, () => staffApi.call(e._id))}>
                            Call
                          </button>
                          <button className="btn btn-sm btn-outline-primary me-2" disabled={busyId === e._id} onClick={() => setPriorityEntry(e)}>
                            Priority
                          </button>
                          <button className="btn btn-sm btn-outline-secondary" disabled={busyId === e._id} onClick={() => run(e._id, () => staffApi.skip(e._id))}>
                            Skip
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {queue.skipped.length > 0 && (
            <section>
              <h2 className="h5">Skipped today ({queue.skipped.length})</h2>
              <div className="pq-table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Token</th>
                      <th>Customer</th>
                      <th>Priority</th>
                      <th>Skipped at</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.skipped.map((e) => (
                      <tr key={e._id}>
                        <td className="fw-semibold">{e.tokenLabel}</td>
                        <td>{e.user?.name}</td>
                        <td>
                          <PriorityBadge priority={e.priority} />
                        </td>
                        <td>{formatTime(e.skippedAt)}</td>
                        <td className="text-end">
                          <button className="btn btn-sm btn-outline-primary" disabled={busyId === e._id} onClick={() => run(e._id, () => staffApi.restore(e._id))}>
                            Put back in queue
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      <PriorityModal entry={priorityEntry} onClose={() => setPriorityEntry(null)} onSave={savePriority} saving={!!busyId} />
    </>
  );
}
