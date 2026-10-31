import { useState } from 'react';
import Alert from '../../components/Alert';
import Loader from '../../components/Loader';
import PageHead from '../../components/PageHead';
import StaffServiceBar, { NoServiceAssigned, NoServicesExist } from '../../components/StaffServiceBar';
import { PriorityBadge, QueueStatusBadge, StatusBadge } from '../../components/Badges';
import { SearchIcon, ClearIcon, FilterIcon } from '../../components/Icons';
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

  // Feature 3: Staff Token Search and Filtering state
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const isFilterActive = searchTerm.trim() !== '' || priorityFilter !== 'ALL' || statusFilter !== 'ALL';

  const handleResetFilters = () => {
    setSearchTerm('');
    setPriorityFilter('ALL');
    setStatusFilter('ALL');
  };

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

  const savePriority = async (targetId, priority, reason) => {
    // Support both savePriority(id, priority, reason) and savePriority(priority, reason)
    const id = reason !== undefined ? targetId : priorityEntry?._id;
    const prio = reason !== undefined ? priority : targetId;
    const rsn = reason !== undefined ? reason : priority;
    if (!id) return;
    const ok = await run(id, () => staffApi.changePriority(id, prio, rsn));
    if (ok) setPriorityEntry(null);
  };

  // Helper to filter by search term and priority while preserving backend queue order
  const matchesSearchAndPriority = (e) => {
    if (!e) return false;

    // Search filter: token number or customer name (case-insensitive)
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      const tokenMatch = e.tokenLabel && e.tokenLabel.toLowerCase().includes(q);
      const nameMatch = e.user?.name && e.user.name.toLowerCase().includes(q);
      if (!tokenMatch && !nameMatch) return false;
    }

    // Priority filter: stored priority (NORMAL, URGENT, EMERGENCY)
    if (priorityFilter !== 'ALL') {
      if (e.priority !== priorityFilter) return false;
    }

    return true;
  };

  // Filtered slices preserving original backend queue order
  const filteredInProgress =
    !queue
      ? []
      : statusFilter !== 'ALL' && statusFilter !== 'CALLED' && statusFilter !== 'SERVING'
      ? []
      : queue.inProgress.filter((e) => {
          if (statusFilter === 'CALLED' && e.status !== 'CALLED') return false;
          if (statusFilter === 'SERVING' && e.status !== 'SERVING') return false;
          return matchesSearchAndPriority(e);
        });

  const filteredWaiting =
    !queue
      ? []
      : statusFilter !== 'ALL' && statusFilter !== 'WAITING'
      ? []
      : queue.waiting.filter(matchesSearchAndPriority);

  const filteredSkipped =
    !queue
      ? []
      : statusFilter !== 'ALL' && statusFilter !== 'SKIPPED'
      ? []
      : queue.skipped.filter(matchesSearchAndPriority);

  const totalMatching = filteredInProgress.length + filteredWaiting.length + filteredSkipped.length;
  const totalAvailable = queue
    ? queue.inProgress.length + queue.waiting.length + queue.skipped.length
    : 0;

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

          {/* Feature 3: Staff Token Search and Filtering Toolbar */}
          <div className="pq-staff-filter-toolbar card mb-4 p-3 shadow-sm border">
            <div className="row g-2 align-items-center">
              {/* 1. Search Bar */}
              <div className="col-12 col-md-5">
                <div className="position-relative">
                  <span
                    className="position-absolute top-50 start-0 translate-middle-y ps-3 text-muted"
                    style={{ pointerEvents: 'none' }}
                  >
                    <SearchIcon size={16} />
                  </span>
                  <input
                    type="text"
                    className="form-control ps-5 pe-4"
                    placeholder="Search by token number or customer name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    aria-label="Search by token number or customer name"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      className="btn btn-sm btn-link position-absolute top-50 end-0 translate-middle-y pe-3 text-secondary p-0"
                      onClick={() => setSearchTerm('')}
                      aria-label="Clear search input"
                    >
                      <ClearIcon size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* 2. Priority Filter */}
              <div className="col-6 col-md-3">
                <select
                  className="form-select"
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  aria-label="Filter by priority"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="NORMAL">NORMAL</option>
                  <option value="URGENT">URGENT</option>
                  <option value="EMERGENCY">EMERGENCY</option>
                </select>
              </div>

              {/* 3. Status Filter */}
              <div className="col-6 col-md-2">
                <select
                  className="form-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Filter by token status"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="WAITING">WAITING</option>
                  <option value="CALLED">CALLED</option>
                  <option value="SERVING">SERVING</option>
                  <option value="SKIPPED">SKIPPED</option>
                </select>
              </div>

              {/* 4. Reset Filters Button */}
              <div className="col-12 col-md-2 d-flex">
                <button
                  type="button"
                  className={`btn w-100 ${isFilterActive ? 'btn-outline-danger' : 'btn-outline-secondary'}`}
                  onClick={handleResetFilters}
                  disabled={!isFilterActive}
                >
                  Reset Filters
                </button>
              </div>
            </div>

            {/* Active Filters Summary & Badges */}
            {isFilterActive && (
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-2 pt-2 border-top small text-muted">
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <span>Active Filters:</span>
                  {searchTerm && (
                    <span className="badge bg-purple-subtle text-primary border border-primary-subtle d-inline-flex align-items-center gap-1">
                      Search: &quot;{searchTerm}&quot;
                      <button
                        type="button"
                        className="btn-close btn-close-xs"
                        onClick={() => setSearchTerm('')}
                        aria-label="Remove search filter"
                      />
                    </span>
                  )}
                  {priorityFilter !== 'ALL' && (
                    <span className="badge bg-purple-subtle text-primary border border-primary-subtle d-inline-flex align-items-center gap-1">
                      Priority: {priorityFilter}
                      <button
                        type="button"
                        className="btn-close btn-close-xs"
                        onClick={() => setPriorityFilter('ALL')}
                        aria-label="Remove priority filter"
                      />
                    </span>
                  )}
                  {statusFilter !== 'ALL' && (
                    <span className="badge bg-purple-subtle text-primary border border-primary-subtle d-inline-flex align-items-center gap-1">
                      Status: {statusFilter}
                      <button
                        type="button"
                        className="btn-close btn-close-xs"
                        onClick={() => setStatusFilter('ALL')}
                        aria-label="Remove status filter"
                      />
                    </span>
                  )}
                </div>
                <div>
                  Showing <strong>{totalMatching}</strong> of {totalAvailable} tokens
                </div>
              </div>
            )}
          </div>

          {/* Empty state when active filters yield 0 results */}
          {isFilterActive && totalMatching === 0 ? (
            <div className="pq-panel pq-empty text-center p-4 border rounded bg-white shadow-sm my-4">
              <div className="mb-2 text-muted">
                <SearchIcon size={32} />
              </div>
              <h3 className="h6 fw-bold mb-1">
                {searchTerm && priorityFilter === 'EMERGENCY'
                  ? `No waiting emergency tokens match "${searchTerm}".`
                  : priorityFilter === 'EMERGENCY' && (statusFilter === 'WAITING' || statusFilter === 'ALL')
                  ? 'No waiting emergency tokens found.'
                  : priorityFilter === 'EMERGENCY'
                  ? 'No emergency tokens found.'
                  : searchTerm
                  ? 'No tokens match your search.'
                  : priorityFilter !== 'ALL'
                  ? `No ${priorityFilter.toLowerCase()} tokens found.`
                  : statusFilter !== 'ALL'
                  ? `No tokens with status "${statusFilter}" found.`
                  : 'No tokens match your search.'}
              </h3>
              <p className="text-muted small mb-3">
                Try adjusting your search terms or filter selections.
              </p>
              <button type="button" className="btn btn-sm btn-outline-primary" onClick={handleResetFilters}>
                Reset Filters
              </button>
            </div>
          ) : (
            <>
              {/* Section 1: At the Counter */}
              {filteredInProgress.length > 0 && (
                <section className="mb-4">
                  <h2 className="h5">At the counter ({filteredInProgress.length})</h2>
                  <div className="pq-table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Token</th>
                          <th>Customer</th>
                          <th>Priority</th>
                          <th>Status</th>
                          <th>Called at</th>
                          <th className="text-end">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInProgress.map((e) => (
                          <tr key={e._id}>
                            <td className="fw-semibold">{e.tokenLabel}</td>
                            <td>{e.user?.name}</td>
                            <td>
                              <PriorityBadge priority={e.priority} />
                            </td>
                            <td>
                              <StatusBadge status={e.status} />
                            </td>
                            <td>{formatTime(e.calledAt)}</td>
                            <td className="text-end text-nowrap">
                              {e.status === 'CALLED' && (
                                <>
                                  <button
                                    className="btn btn-sm btn-primary me-2"
                                    disabled={busyId === e._id}
                                    onClick={() => run(e._id, () => staffApi.serve(e._id))}
                                  >
                                    Start serving
                                  </button>
                                  <button
                                    className="btn btn-sm btn-outline-secondary"
                                    disabled={busyId === e._id}
                                    onClick={() => run(e._id, () => staffApi.skip(e._id))}
                                  >
                                    Skip
                                  </button>
                                </>
                              )}
                              {e.status === 'SERVING' && (
                                <button
                                  className="btn btn-sm btn-primary"
                                  disabled={busyId === e._id}
                                  onClick={() => run(e._id, () => staffApi.complete(e._id))}
                                >
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

              {/* Section 2: Waiting Queue */}
              {(statusFilter === 'ALL' || statusFilter === 'WAITING') && (
                <section className="mb-4">
                  <h2 className="h5">Waiting ({filteredWaiting.length})</h2>
                  {filteredWaiting.length === 0 ? (
                    <div className="pq-panel pq-empty">
                      <p className="mb-0">
                        {isFilterActive
                          ? 'No waiting tokens match the selected filters.'
                          : 'Nobody is waiting right now.'}
                      </p>
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
                          {filteredWaiting.map((e) => (
                            <tr key={e._id}>
                              <td>{e.position}</td>
                              <td className="fw-semibold">{e.tokenLabel}</td>
                              <td>
                                {e.user?.name}
                                {e.user?.phone && <div className="small text-secondary">{e.user.phone}</div>}
                              </td>
                              <td>
                                <PriorityBadge priority={e.priority} />
                                {e.boosted && (
                                  <div className="pq-boost">
                                    Treated as {titleCase(e.effectivePriority)} after a long wait
                                  </div>
                                )}
                              </td>
                              <td>{formatMinutes(e.waitedMinutes)}</td>
                              <td>{formatMinutes(e.estimatedWaitMinutes)}</td>
                              <td className="text-end text-nowrap">
                                <button
                                  className="btn btn-sm btn-primary me-2"
                                  disabled={busyId === e._id}
                                  onClick={() => run(e._id, () => staffApi.call(e._id))}
                                >
                                  Call
                                </button>
                                <button
                                  className="btn btn-sm btn-outline-primary me-2"
                                  disabled={busyId === e._id}
                                  onClick={() => setPriorityEntry(e)}
                                >
                                  Priority
                                </button>
                                <button
                                  className="btn btn-sm btn-outline-secondary"
                                  disabled={busyId === e._id}
                                  onClick={() => run(e._id, () => staffApi.skip(e._id))}
                                >
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
              )}

              {/* Section 3: Skipped Today */}
              {(statusFilter === 'ALL' || statusFilter === 'SKIPPED') && filteredSkipped.length > 0 && (
                <section>
                  <h2 className="h5">Skipped today ({filteredSkipped.length})</h2>
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
                        {filteredSkipped.map((e) => (
                          <tr key={e._id}>
                            <td className="fw-semibold">{e.tokenLabel}</td>
                            <td>{e.user?.name}</td>
                            <td>
                              <PriorityBadge priority={e.priority} />
                            </td>
                            <td>{formatTime(e.skippedAt)}</td>
                            <td className="text-end">
                              <button
                                className="btn btn-sm btn-outline-primary"
                                disabled={busyId === e._id}
                                onClick={() => run(e._id, () => staffApi.restore(e._id))}
                              >
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
        </>
      )}

      <PriorityModal
        entry={priorityEntry}
        waitingTokens={queue?.waiting || []}
        onClose={() => setPriorityEntry(null)}
        onSave={savePriority}
        saving={!!busyId}
      />
    </>
  );
}
