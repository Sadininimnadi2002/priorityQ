import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Alert from '../../components/Alert';
import Loader from '../../components/Loader';
import PageHead from '../../components/PageHead';
import { QueueStatusBadge } from '../../components/Badges';
import {
  SearchIcon,
  ClearIcon,
  FilterIcon,
  SortIcon,
  UsersIcon,
  ClockIcon,
  TimerIcon,
  BuildingIcon,
  CheckCircleIcon,
  TicketIcon,
  ArrowRightIcon,
} from '../../components/Icons';
import { queueApi, servicesApi } from '../../services/endpoints';
import { formatMinutes, getErrorMessage } from '../../utils/format';

export default function Services() {
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState(null);
  const [error, setError] = useState('');

  // Interactive controls state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'OPEN' | 'CLOSED'
  const [sortBy, setSortBy] = useState('NAME_ASC'); // 'NAME_ASC' | 'NAME_DESC' | 'WAIT_ASC' | 'WAIT_DESC'

  const load = async () => {
    try {
      const [svcRes, activeRes] = await Promise.all([servicesApi.list(), queueApi.myActive()]);
      setServices(svcRes.services || []);
      setActive(activeRes.entry);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleJoin = async (serviceId) => {
    setJoiningId(serviceId);
    setError('');
    try {
      await queueApi.join(serviceId);
      navigate('/token');
    } catch (err) {
      setError(getErrorMessage(err));
      load(); // refresh status in case service state changed
    } finally {
      setJoiningId(null);
    }
  };

  const handleClearSearch = () => {
    setSearchTerm('');
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setSortBy('NAME_ASC');
  };

  // Real-time calculated summary statistics from actual service data
  const summary = useMemo(() => {
    const total = services.length;
    const open = services.filter((s) => s.isActive && s.queueStatus === 'OPEN').length;
    const closed = total - open;
    return { total, open, closed };
  }, [services]);

  // Combined search, filter, and sort (client-side only, preserving database records)
  const processedServices = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();

    // 1. Filter by status & search query
    const filtered = services.filter((s) => {
      const isOpen = s.isActive && s.queueStatus === 'OPEN';

      if (statusFilter === 'OPEN' && !isOpen) return false;
      if (statusFilter === 'CLOSED' && isOpen) return false;

      if (normalizedTerm) {
        const nameMatch = s.name ? s.name.toLowerCase().includes(normalizedTerm) : false;
        const descMatch = s.description ? s.description.toLowerCase().includes(normalizedTerm) : false;
        const codeMatch = s.code ? s.code.toLowerCase().includes(normalizedTerm) : false;
        if (!nameMatch && !descMatch && !codeMatch) return false;
      }

      return true;
    });

    // 2. Sort results without mutating original array
    return [...filtered].sort((a, b) => {
      if (sortBy === 'NAME_ASC') {
        return (a.name || '').localeCompare(b.name || '');
      }
      if (sortBy === 'NAME_DESC') {
        return (b.name || '').localeCompare(a.name || '');
      }
      if (sortBy === 'WAIT_ASC') {
        const diff = (a.estimatedWaitMinutes ?? 0) - (b.estimatedWaitMinutes ?? 0);
        return diff !== 0 ? diff : (a.name || '').localeCompare(b.name || '');
      }
      if (sortBy === 'WAIT_DESC') {
        const diff = (b.estimatedWaitMinutes ?? 0) - (a.estimatedWaitMinutes ?? 0);
        return diff !== 0 ? diff : (a.name || '').localeCompare(b.name || '');
      }
      return 0;
    });
  }, [services, searchTerm, statusFilter, sortBy]);

  if (loading) return <Loader />;

  return (
    <div className="pq-services-page">
      <PageHead
        title="Campus Services & Queues"
        subtitle="Explore university service departments, inspect live wait times, and join virtual queues instantly."
      />

      <Alert message={error} onClose={() => setError('')} />

      {/* Active Token Notice */}
      {active && (
        <div className="pq-active-token mb-4" role="status">
          <div className="pq-active-token__message">
            <span className="pq-active-token__marker" aria-hidden="true" />
            <div>
              <strong>Active Queue Notice:</strong> You currently hold token{' '}
              <span className="badge bg-primary text-white ms-1 me-1">{active.tokenLabel}</span> for{' '}
              <strong>{active.service?.name || 'a university service'}</strong>. You can only be in one queue at a time.
            </div>
          </div>
          <Link to="/token" className="btn btn-sm btn-primary d-inline-flex align-items-center gap-2">
            <span>Open My Token</span>
            <ArrowRightIcon size={14} />
          </Link>
        </div>
      )}

      {/* 4. Service Summary Cards */}
      <section className="pq-services-summary mb-4" aria-label="Service Statistics">
        <div className="row g-3">
          <div className="col-12 col-md-4">
            <div className="pq-services-summary__card pq-services-summary__card--total">
              <div className="pq-services-summary__icon-box">
                <BuildingIcon size={22} />
              </div>
              <div className="pq-services-summary__content">
                <span className="pq-services-summary__label">Total Services</span>
                <span className="pq-services-summary__count">{summary.total}</span>
                <span className="pq-services-summary__meta">Campus departments available</span>
              </div>
            </div>
          </div>

          <div className="col-12 col-md-4">
            <div className="pq-services-summary__card pq-services-summary__card--open">
              <div className="pq-services-summary__icon-box">
                <CheckCircleIcon size={22} />
              </div>
              <div className="pq-services-summary__content">
                <div className="d-flex align-items-center justify-content-between">
                  <span className="pq-services-summary__label">Open Services</span>
                  <span className="pq-badge pq-badge--live">Accepting</span>
                </div>
                <span className="pq-services-summary__count text-success">{summary.open}</span>
                <span className="pq-services-summary__meta">Active counters & queues</span>
              </div>
            </div>
          </div>

          <div className="col-12 col-md-4">
            <div className="pq-services-summary__card pq-services-summary__card--closed">
              <div className="pq-services-summary__icon-box">
                <ClockIcon size={22} />
              </div>
              <div className="pq-services-summary__content">
                <span className="pq-services-summary__label">Closed Services</span>
                <span className="pq-services-summary__count text-secondary">{summary.closed}</span>
                <span className="pq-services-summary__meta">Currently paused or offline</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 1, 2, 3: Search, Filter, and Sort Controls Toolbar */}
      <section className="pq-services-toolbar card shadow-sm mb-4" aria-label="Search and Filter Controls">
        <div className="card-body p-3">
          <div className="row g-3 align-items-center">
            {/* Search Services Bar */}
            <div className="col-12 col-lg-5">
              <div className="pq-search-box position-relative">
                <span className="pq-search-box__icon position-absolute top-50 start-0 translate-middle-y ps-3 text-muted pointer-events-none">
                  <SearchIcon size={18} />
                </span>
                <input
                  type="text"
                  id="serviceSearchInput"
                  className="form-control form-control-lg ps-5 pe-5 pq-search-input"
                  placeholder="Search services by name or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  aria-label="Search services by name or description"
                />
                {searchTerm && (
                  <button
                    type="button"
                    className="btn btn-link position-absolute top-50 end-0 translate-middle-y pe-3 text-muted pq-search-clear-btn"
                    onClick={handleClearSearch}
                    aria-label="Clear search text"
                    title="Clear search"
                  >
                    <ClearIcon size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Service Status Filter Dropdown */}
            <div className="col-12 col-sm-6 col-lg-3">
              <div className="input-group">
                <span className="input-group-text bg-white text-muted border-end-0">
                  <FilterIcon size={16} />
                </span>
                <select
                  id="serviceStatusFilter"
                  className="form-select form-select-lg border-start-0"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Filter services by status"
                >
                  <option value="ALL">All Services</option>
                  <option value="OPEN">Open Services</option>
                  <option value="CLOSED">Closed Services</option>
                </select>
              </div>
            </div>

            {/* Sort Services Dropdown */}
            <div className="col-12 col-sm-6 col-lg-4">
              <div className="input-group">
                <span className="input-group-text bg-white text-muted border-end-0">
                  <SortIcon size={16} />
                </span>
                <select
                  id="serviceSortDropdown"
                  className="form-select form-select-lg border-start-0"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  aria-label="Sort services"
                >
                  <option value="NAME_ASC">Sort: Name (A–Z)</option>
                  <option value="NAME_DESC">Sort: Name (Z–A)</option>
                  <option value="WAIT_ASC">Shortest Estimated Wait Time</option>
                  <option value="WAIT_DESC">Longest Estimated Wait Time</option>
                </select>
              </div>
            </div>
          </div>

          {/* Active Filter Indicators & Result Counter */}
          <div className="d-flex flex-wrap align-items-center justify-content-between mt-3 pt-2 border-top gap-2">
            <div className="small text-muted">
              Showing <strong>{processedServices.length}</strong> of <strong>{services.length}</strong> services
              {searchTerm && (
                <span className="ms-1">
                  for query &ldquo;<strong>{searchTerm}</strong>&rdquo;
                </span>
              )}
              {statusFilter !== 'ALL' && (
                <span className="badge bg-light text-dark ms-2 border">
                  Filter: {statusFilter === 'OPEN' ? 'Open Only' : 'Closed Only'}
                </span>
              )}
            </div>

            {(searchTerm || statusFilter !== 'ALL' || sortBy !== 'NAME_ASC') && (
              <button
                type="button"
                className="btn btn-sm btn-link text-decoration-none text-primary p-0"
                onClick={handleResetFilters}
              >
                Reset filters &amp; search
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 5. Service Cards Listing or Empty States */}
      {services.length === 0 ? (
        <div className="pq-panel pq-empty text-center p-5 card shadow-sm">
          <div className="pq-empty__icon-wrapper mb-3">
            <BuildingIcon size={44} className="text-muted" />
          </div>
          <h2 className="h4 fw-bold">No services are available</h2>
          <p className="text-muted mb-0">Please check back later or contact customer administration.</p>
        </div>
      ) : processedServices.length === 0 ? (
        <div className="pq-services-not-found card shadow-sm text-center p-5">
          <div className="pq-empty__icon-wrapper mb-3">
            <SearchIcon size={44} className="text-muted" />
          </div>
          <h2 className="h4 fw-bold">No services match your criteria</h2>
          <p className="text-muted mb-4">
            We couldn&apos;t find any service matching &ldquo;<strong>{searchTerm}</strong>&rdquo;
            {statusFilter !== 'ALL' ? ` with ${statusFilter.toLowerCase()} status filter` : ''}.
          </p>
          <div className="d-flex justify-content-center gap-2">
            {searchTerm && (
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={handleClearSearch}>
                Clear Search
              </button>
            )}
            <button type="button" className="btn btn-primary btn-sm" onClick={handleResetFilters}>
              Reset All Filters
            </button>
          </div>
        </div>
      ) : (
        <div className="row g-4">
          {processedServices.map((s) => {
            const open = s.isActive && s.queueStatus === 'OPEN';
            const isJoiningThis = joiningId === s._id;

            return (
              <div className="col-md-6 col-lg-4" key={s._id}>
                <article className={`pq-service-card-v2 h-100 ${!open ? 'pq-service-card-v2--closed' : ''}`}>
                  {/* Card Header */}
                  <div className="pq-service-card-v2__head">
                    <div className="pq-service-card-v2__identity">
                      {s.code && <span className="pq-service-card-v2__code">{s.code}</span>}
                      <h2 className="pq-service-card-v2__title" title={s.name}>
                        {s.name}
                      </h2>
                    </div>
                    <div className="pq-service-card-v2__status-badge">
                      <QueueStatusBadge status={s.queueStatus} isActive={s.isActive} />
                    </div>
                  </div>

                  {/* Card Description */}
                  <p className="pq-service-card-v2__description">
                    {s.description || 'University department service counter and queue.'}
                  </p>

                  {/* Card Metrics Grid */}
                  <div className="pq-service-card-v2__metrics">
                    <div className="pq-service-card-v2__metric-item">
                      <div className="pq-service-card-v2__metric-label">
                        <UsersIcon size={14} className="text-muted me-1" />
                        <span>People Waiting</span>
                      </div>
                      <div className="pq-service-card-v2__metric-value">
                        <span className="badge bg-light text-dark border px-2 py-1">{s.waitingCount ?? 0}</span>
                      </div>
                    </div>

                    <div className="pq-service-card-v2__metric-item">
                      <div className="pq-service-card-v2__metric-label">
                        <ClockIcon size={14} className="text-muted me-1" />
                        <span>Estimated Wait</span>
                      </div>
                      <div className="pq-service-card-v2__metric-value fw-bold text-primary">
                        {open ? formatMinutes(s.estimatedWaitMinutes) : '—'}
                      </div>
                    </div>

                    <div className="pq-service-card-v2__metric-item">
                      <div className="pq-service-card-v2__metric-label">
                        <TimerIcon size={14} className="text-muted me-1" />
                        <span>Avg Service Time</span>
                      </div>
                      <div className="pq-service-card-v2__metric-value text-secondary">
                        {formatMinutes(s.avgServiceMinutes)}
                      </div>
                    </div>
                  </div>

                  {/* Prominent Action Button */}
                  <div className="pq-service-card-v2__action mt-auto pt-3">
                    <button
                      className="btn btn-primary pq-service-card-v2__join-btn w-100 d-inline-flex align-items-center justify-content-center gap-2"
                      disabled={!open || !!active || isJoiningThis}
                      onClick={() => handleJoin(s._id)}
                      aria-label={
                        isJoiningThis
                          ? `Joining queue for ${s.name}`
                          : !open
                            ? `${s.name} is not accepting new queue entries`
                            : active
                              ? `Already in a queue, cannot join ${s.name}`
                              : `Join queue for ${s.name}`
                      }
                    >
                      {isJoiningThis ? (
                        <>
                          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                          <span>Generating Token...</span>
                        </>
                      ) : !open ? (
                        <span>Queue Closed</span>
                      ) : active ? (
                        <span>Already in a Queue</span>
                      ) : (
                        <>
                          <TicketIcon size={18} />
                          <span>Join Queue</span>
                        </>
                      )}
                    </button>
                  </div>
                </article>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
