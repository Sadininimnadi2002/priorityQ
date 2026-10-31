import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Alert from '../../components/Alert';
import Loader from '../../components/Loader';
import PageHead from '../../components/PageHead';
import { PriorityBadge, QueueStatusBadge, StatusBadge } from '../../components/Badges';
import {
  TicketIcon,
  CheckCircleIcon,
  ClockIcon,
  UsersIcon,
  ArrowRightIcon,
  BuildingIcon,
  HistoryIcon,
  SparklesIcon,
} from '../../components/Icons';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import usePolling from '../../hooks/usePolling';
import { queueApi, servicesApi } from '../../services/endpoints';
import { formatDateTime, formatMinutes, getErrorMessage } from '../../utils/format';
import NotificationBell from '../../components/NotificationBell';

export default function UserDashboard() {
  const { user } = useAuth();
  const { lastQueueUpdate, connected } = useNotifications();
  const navigate = useNavigate();

  const [activeData, setActiveData] = useState(null); // { entry, queueInfo }
  const [historyEntries, setHistoryEntries] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState(null);
  const [error, setError] = useState('');
  const [lastUpdatedTime, setLastUpdatedTime] = useState(null);

  // Refresh every 10 seconds to keep live queue position, wait times, and history synchronized as a fallback
  usePolling(async () => {
    try {
      const [activeRes, histRes, svcRes] = await Promise.all([
        queueApi.myActive(),
        queueApi.history(),
        servicesApi.list(),
      ]);
      setActiveData(activeRes);
      setHistoryEntries(histRes.entries || []);
      setServices(svcRes.services || []);
      setLastUpdatedTime(new Date());
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, 10000);

  // Real-time queue position tracking via Socket.IO: updates without requiring a manual refresh
  useEffect(() => {
    if (!lastQueueUpdate) return;
    const { entry: incomingEntry, queueInfo: incomingInfo, updatedAt } = lastQueueUpdate;

    if (!incomingEntry || ['COMPLETED', 'SKIPPED', 'CANCELLED'].includes(incomingEntry.status)) {
      setActiveData(null);
      setLastUpdatedTime(new Date(updatedAt || Date.now()));
      // Refresh visit history when an active token is completed or skipped
      queueApi
        .history()
        .then((res) => setHistoryEntries(res.entries || []))
        .catch(() => {});
    } else {
      setActiveData({
        entry: incomingEntry,
        queueInfo: incomingInfo,
      });
      setLastUpdatedTime(new Date(updatedAt || Date.now()));
    }
  }, [lastQueueUpdate]);

  const entry = activeData?.entry;
  const info = activeData?.queueInfo;
  const waiting = entry?.status === 'WAITING';
  const averageMinutes = info?.avgMinutes ?? entry?.service?.avgServiceMinutes;

  // 2. Real Authenticated Customer Statistics
  const totalTokensJoined = (entry ? 1 : 0) + historyEntries.length;
  const completedServices = historyEntries.filter((e) => e.status === 'COMPLETED').length;
  const activeTokensCount = entry ? 1 : 0;

  // 5. Available Services Preview: 3 open services from real data
  const openServicesPreview = services.filter((s) => s.isActive && s.queueStatus === 'OPEN').slice(0, 3);

  // 6. Recent Activity: 3 most recent queue records from real history data
  const recentRecords = historyEntries.slice(0, 3);

  const handleJoinPreview = async (serviceId) => {
    setJoiningId(serviceId);
    setError('');
    try {
      await queueApi.join(serviceId);
      navigate('/token');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <div className="pq-dashboard-page">
      <PageHead
        title={`Welcome, ${user?.name ? user.name.split(' ')[0] : 'Customer'}`}
        subtitle="PriorityQ Smart Digital Queue Dashboard — track your real-time status and access services."
      />

      <Alert message={error} onClose={() => setError('')} />

      {loading && <Loader />}

      {!loading && (
        <>
          {/* 1. Welcome Section */}
          <section className="pq-user-welcome card mb-4 shadow-sm border-0" aria-label="Welcome section">
            <div className="card-body p-4 p-lg-4">
              <div className="row align-items-center g-3">
                <div className="col-lg-8">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1">
                      PriorityQ Customer Portal
                    </span>
                    {user?.defaultPriority && user.defaultPriority !== 'NORMAL' && (
                      <PriorityBadge priority={user.defaultPriority} />
                    )}
                  </div>
                  <h1 className="h3 fw-bold mb-2">
                    Welcome back, {user?.name || 'Customer'}!
                  </h1>
                  <p className="text-muted mb-0 lead-sm" style={{ maxWidth: '640px' }}>
                    Welcome to your PriorityQ queue portal. Monitor your live counter position in real time,
                    join campus service lines with digital tokens, and review your previous visit records.
                  </p>
                </div>
                <div className="col-lg-4 text-lg-end d-flex align-items-center justify-content-lg-end gap-3 flex-wrap">
                  <NotificationBell />
                  <Link
                    to="/services"
                    className="btn btn-primary btn-lg px-4 shadow-sm d-inline-flex align-items-center gap-2"
                  >
                    <SparklesIcon size={18} />
                    <span>Browse Services</span>
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* 2. Customer Statistics Cards */}
          <section className="pq-user-stats mb-4" aria-label="Customer Statistics">
            <div className="row g-3">
              <div className="col-12 col-md-4">
                <div className="pq-stat-card pq-stat-card--joined">
                  <div className="pq-stat-card__icon-box">
                    <TicketIcon size={22} />
                  </div>
                  <div className="pq-stat-card__info">
                    <span className="pq-stat-card__label">Total Tokens Joined</span>
                    <span className="pq-stat-card__value">{totalTokensJoined}</span>
                    <span className="pq-stat-card__meta">All queues entered to date</span>
                  </div>
                </div>
              </div>

              <div className="col-12 col-md-4">
                <div className="pq-stat-card pq-stat-card--completed">
                  <div className="pq-stat-card__icon-box">
                    <CheckCircleIcon size={22} />
                  </div>
                  <div className="pq-stat-card__info">
                    <span className="pq-stat-card__label">Completed Services</span>
                    <span className="pq-stat-card__value">{completedServices}</span>
                    <span className="pq-stat-card__meta">Successfully served visits</span>
                  </div>
                </div>
              </div>

              <div className="col-12 col-md-4">
                <div className="pq-stat-card pq-stat-card--active">
                  <div className="pq-stat-card__icon-box">
                    <ClockIcon size={22} />
                  </div>
                  <div className="pq-stat-card__info">
                    <div className="d-flex align-items-center justify-content-between">
                      <span className="pq-stat-card__label">Active Queue Tokens</span>
                      {activeTokensCount > 0 && <span className="pq-badge pq-badge--live">In Queue</span>}
                    </div>
                    <span className={`pq-stat-card__value ${activeTokensCount > 0 ? 'text-primary' : ''}`}>
                      {activeTokensCount}
                    </span>
                    <span className="pq-stat-card__meta">
                      {activeTokensCount > 0 ? '1 token currently in progress' : 'No active queue at present'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 3. Current Queue Status Section */}
          <section className="pq-active-status-section mb-4" aria-label="Current Queue Status">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h2 className="h5 fw-bold mb-0 d-flex align-items-center gap-2">
                <span>Current Queue Status</span>
                {entry && (
                  <span className="spinner-grow spinner-grow-sm text-primary" role="status" aria-hidden="true" />
                )}
              </h2>
              {entry && (
                <Link to="/token" className="text-decoration-none small fw-semibold text-primary d-inline-flex align-items-center gap-1">
                  <span>Open Full Ticket</span>
                  <ArrowRightIcon size={14} />
                </Link>
              )}
            </div>

            {/* When Customer Has An Active Token */}
            {entry ? (
              <div
                className={`pq-queue-progress-card pq-queue-progress-card--${entry.status.toLowerCase()} shadow-sm`}
                aria-live="polite"
              >
                {/* 1. Header with Live Status & Badges */}
                <div className="pq-queue-progress-card__header d-flex flex-wrap align-items-center justify-content-between gap-2">
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <span className="badge bg-purple-subtle text-primary border border-primary-subtle px-2 py-1 fw-bold">
                      ACTIVE DIGITAL TOKEN
                    </span>
                    {connected ? (
                      <span className="badge bg-success-subtle text-success border border-success-subtle d-inline-flex align-items-center gap-1 py-1">
                        <span className="pq-live-pulse-dot" aria-hidden="true" />
                        <span>LIVE QUEUE TRACKING</span>
                      </span>
                    ) : (
                      <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle py-1">
                        POLLING FALLBACK (10s)
                      </span>
                    )}
                  </div>
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <StatusBadge status={entry.status} />
                    <QueueStatusBadge status={info?.queueStatus || entry.service?.queueStatus} />
                  </div>
                </div>

                {/* 2. Status Alert Banners */}
                <div className="px-4 pt-3">
                  {entry.status === 'CALLED' && (
                    <div className="alert alert-warning border border-warning shadow-sm d-flex align-items-center gap-3 mb-0" role="alert">
                      <div className="fs-3">🚨</div>
                      <div>
                        <strong className="fs-6 d-block">Your Token {entry.tokenLabel} Has Been Called!</strong>
                        <span>Please proceed immediately to the <strong>{entry.service?.name}</strong> counter to be served.</span>
                      </div>
                    </div>
                  )}

                  {entry.status === 'SERVING' && (
                    <div className="alert alert-success border border-success shadow-sm d-flex align-items-center gap-3 mb-0" role="alert">
                      <div className="fs-3">🎉</div>
                      <div>
                        <strong className="fs-6 d-block">Service in Progress</strong>
                        <span>You are currently being served at the <strong>{entry.service?.name}</strong> desk.</span>
                      </div>
                    </div>
                  )}

                  {(info?.queueStatus || entry.service?.queueStatus) === 'PAUSED' && (
                    <div className="alert alert-warning border border-warning shadow-sm d-flex align-items-center gap-3 mb-0 mt-2" role="alert">
                      <div className="fs-2">⚠️</div>
                      <div>
                        <strong className="fs-6 d-block">Queue Paused</strong>
                        <span>This service is temporarily unavailable. Your token remains in the queue.</span>
                      </div>
                    </div>
                  )}

                  {(info?.queueStatus || entry.service?.queueStatus) === 'CLOSED' && (
                    <div className="alert alert-secondary border d-flex align-items-center gap-2 mb-0 mt-2" role="alert">
                      <span>🛑</span>
                      <span><strong>Queue Closed to New Joiners:</strong> Existing waiting customers will continue being served in priority order.</span>
                    </div>
                  )}
                </div>

                {/* 3. Hero Identity */}
                <div className="pq-queue-progress-card__hero">
                  <div className="small text-muted text-uppercase tracking-wider fw-bold mb-1">
                    My Token Number
                  </div>
                  <div className="pq-queue-token-number">
                    {entry.tokenLabel}
                  </div>
                  <h3 className="h5 fw-bold text-dark mt-2 mb-1">
                    {entry.service?.name || 'Campus Service'}
                  </h3>
                  {info?.boosted && (
                    <div className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-2 py-1 mt-1">
                      Promoted for extended waiting time
                    </div>
                  )}
                </div>

                {/* 4. Visual Progress Stepper & Dynamic Fill Track */}
                <div className="pq-queue-stepper-wrap">
                  <div className="pq-queue-stepper">
                    <div className="pq-queue-step pq-queue-step--done">
                      <div className="pq-queue-step__dot">✓</div>
                      <span>Joined</span>
                    </div>
                    <div
                      className={`pq-queue-step ${
                        entry.status === 'WAITING'
                          ? 'pq-queue-step--active'
                          : ['CALLED', 'SERVING'].includes(entry.status)
                          ? 'pq-queue-step--done'
                          : ''
                      }`}
                    >
                      <div className="pq-queue-step__dot">
                        {['CALLED', 'SERVING'].includes(entry.status)
                          ? '✓'
                          : waiting
                          ? (info?.position ?? '2')
                          : '2'}
                      </div>
                      <span>In Queue</span>
                    </div>
                    <div
                      className={`pq-queue-step ${
                        entry.status === 'CALLED'
                          ? 'pq-queue-step--active'
                          : entry.status === 'SERVING'
                          ? 'pq-queue-step--done'
                          : ''
                      }`}
                    >
                      <div className="pq-queue-step__dot">
                        {entry.status === 'SERVING' ? '✓' : '3'}
                      </div>
                      <span>Called</span>
                    </div>
                    <div
                      className={`pq-queue-step ${
                        entry.status === 'SERVING' ? 'pq-queue-step--active' : ''
                      }`}
                    >
                      <div className="pq-queue-step__dot">4</div>
                      <span>Serving</span>
                    </div>
                    <div className="pq-queue-step">
                      <div className="pq-queue-step__dot">5</div>
                      <span>Complete</span>
                    </div>
                  </div>

                  <div className="pq-progress-track">
                    <div
                      className="pq-progress-fill"
                      style={{
                        width: `${
                          entry.status === 'COMPLETED'
                            ? 100
                            : entry.status === 'SERVING'
                            ? 90
                            : entry.status === 'CALLED'
                            ? 75
                            : waiting
                            ? info?.peopleAhead === 0
                              ? 60
                              : Math.max(
                                  20,
                                  Math.min(
                                    60,
                                    Math.round(
                                      (((info?.totalWaiting || 1) - (info?.position || 1) + 1) /
                                        Math.max(1, info?.totalWaiting || 1)) *
                                        55
                                    )
                                  )
                                )
                            : 15
                        }%`,
                      }}
                    />
                  </div>
                </div>

                {/* 5. Four Key Queue Position Metrics */}
                <div className="pq-queue-metrics-grid">
                  {/* Metric 1: Queue Position */}
                  <div className="pq-queue-metric-item">
                    <span className="pq-queue-metric-item__label">
                      <UsersIcon size={14} />
                      <span>Queue Position</span>
                    </span>
                    <span className="pq-queue-metric-item__value">
                      {waiting
                        ? (info?.position ?? '—')
                        : entry.status === 'CALLED'
                        ? 'Called'
                        : entry.status === 'SERVING'
                        ? 'At Desk'
                        : '—'}
                    </span>
                    <span className="pq-queue-metric-item__sub">
                      {waiting ? 'Estimated call position' : 'Currently at counter'}
                    </span>
                  </div>

                  {/* Metric 2: People Ahead */}
                  <div className="pq-queue-metric-item">
                    <span className="pq-queue-metric-item__label">
                      <UsersIcon size={14} />
                      <span>People Ahead</span>
                    </span>
                    <span className="pq-queue-metric-item__value">
                      {waiting ? (info?.peopleAhead ?? 0) : 0}
                    </span>
                    <span className="pq-queue-metric-item__sub">
                      {waiting
                        ? info?.peopleAhead === 0
                          ? 'You are next in line!'
                          : `${info?.peopleAhead} person${info?.peopleAhead === 1 ? '' : 's'} ahead`
                        : 'Counter ready'}
                    </span>
                  </div>

                  {/* Metric 3: Estimated Waiting Time */}
                  <div className="pq-queue-metric-item">
                    <span className="pq-queue-metric-item__label">
                      <ClockIcon size={14} />
                      <span>Estimated Wait</span>
                    </span>
                    <span
                      className={`pq-queue-metric-item__value ${
                        (info?.queueStatus || entry.service?.queueStatus) === 'PAUSED'
                          ? 'fs-6 text-warning-emphasis'
                          : 'text-primary'
                      }`}
                    >
                      {(info?.queueStatus || entry.service?.queueStatus) === 'PAUSED'
                        ? 'Temporarily Unavailable'
                        : entry.status === 'CALLED'
                        ? 'Immediate'
                        : entry.status === 'SERVING'
                        ? 'Now Serving'
                        : waiting && info?.peopleAhead === 0
                        ? '< 1 min'
                        : waiting
                        ? formatMinutes(info?.estimatedWaitMinutes)
                        : '—'}
                    </span>
                    <span className="pq-queue-metric-item__sub">
                      {(info?.queueStatus || entry.service?.queueStatus) === 'PAUSED'
                        ? 'Service queue paused'
                        : averageMinutes
                        ? `~${formatMinutes(averageMinutes)} avg/person`
                        : 'Priority optimized'}
                    </span>
                  </div>

                  {/* Metric 4: Current Token Status */}
                  <div className="pq-queue-metric-item">
                    <span className="pq-queue-metric-item__label">
                      <TicketIcon size={14} />
                      <span>Token Status</span>
                    </span>
                    <span className="pq-queue-metric-item__value text-dark fs-4">
                      {entry.status}
                    </span>
                    <span className="pq-queue-metric-item__sub">
                      Queue: {info?.queueStatus || entry.service?.queueStatus || 'OPEN'}
                    </span>
                  </div>
                </div>

                {/* 6. Card Footer with Metadata & Actions */}
                <div className="pq-queue-progress-card__footer d-flex flex-wrap align-items-center justify-content-between gap-3">
                  <div className="d-flex align-items-center gap-3 flex-wrap small text-muted">
                    <div>
                      <span className="fw-semibold text-secondary me-1">Priority:</span>
                      <PriorityBadge priority={entry.priority} />
                    </div>
                    {entry.joinedAt && (
                      <div>
                        <span className="fw-semibold text-secondary me-1">Joined:</span>
                        <span>{formatDateTime(entry.joinedAt)}</span>
                      </div>
                    )}
                    <div>
                      <span className="fw-semibold text-secondary me-1">Last Updated:</span>
                      <span className="text-dark fw-medium">
                        {lastUpdatedTime
                          ? lastUpdatedTime.toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })
                          : 'Just now'}
                      </span>
                    </div>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <Link to="/token" className="btn btn-primary d-inline-flex align-items-center gap-2 shadow-sm">
                      <TicketIcon size={16} />
                      <span>View My Token Ticket</span>
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              /* When Customer Has NO Active Token (Clean Empty State) */
              <div className="pq-dashboard-empty card shadow-sm text-center p-5 border">
                <span className="pq-dashboard-empty__mark mb-3" aria-hidden="true" />
                <h2 className="h4 fw-bold">You are not currently in a queue.</h2>
                <p className="text-muted mb-4" style={{ maxWidth: '480px' }}>
                  Choose a service and join its virtual queue to receive a digital token.
                </p>
                <div>
                  <Link to="/services" className="btn btn-primary px-4 d-inline-flex align-items-center gap-2">
                    <SparklesIcon size={18} />
                    <span>Browse Services</span>
                  </Link>
                </div>
              </div>
            )}
          </section>

          {/* 4. Quick Actions */}
          <section className="pq-quick-actions mb-4" aria-label="Quick Actions">
            <h2 className="h5 fw-bold mb-3">Quick Actions</h2>
            <div className="row g-3">
              <div className="col-12 col-md-4">
                <Link to="/services" className="pq-action-card card h-100 text-decoration-none shadow-sm">
                  <div className="card-body p-4 d-flex align-items-start gap-3">
                    <div className="pq-action-card__icon bg-primary-subtle text-primary">
                      <BuildingIcon size={24} />
                    </div>
                    <div className="flex-grow-1">
                      <h3 className="h6 fw-bold text-dark mb-1 d-flex align-items-center justify-content-between">
                        <span>Browse Services</span>
                        <ArrowRightIcon size={16} className="text-muted pq-action-card__arrow" />
                      </h3>
                      <p className="small text-muted mb-0">
                        Explore available counters, view live waiting estimates, and enter a queue.
                      </p>
                    </div>
                  </div>
                </Link>
              </div>

              <div className="col-12 col-md-4">
                <Link to="/token" className="pq-action-card card h-100 text-decoration-none shadow-sm">
                  <div className="card-body p-4 d-flex align-items-start gap-3">
                    <div className="pq-action-card__icon bg-info-subtle text-info-emphasis">
                      <TicketIcon size={24} />
                    </div>
                    <div className="flex-grow-1">
                      <h3 className="h6 fw-bold text-dark mb-1 d-flex align-items-center justify-content-between">
                        <span>My Token</span>
                        <ArrowRightIcon size={16} className="text-muted pq-action-card__arrow" />
                      </h3>
                      <p className="small text-muted mb-0">
                        {entry
                          ? `Access token ticket ${entry.tokenLabel} and monitor counter calls.`
                          : 'Check your digital token ticket details or manage queue entry.'}
                      </p>
                    </div>
                  </div>
                </Link>
              </div>

              <div className="col-12 col-md-4">
                <Link to="/history" className="pq-action-card card h-100 text-decoration-none shadow-sm">
                  <div className="card-body p-4 d-flex align-items-start gap-3">
                    <div className="pq-action-card__icon bg-secondary-subtle text-secondary">
                      <HistoryIcon size={24} />
                    </div>
                    <div className="flex-grow-1">
                      <h3 className="h6 fw-bold text-dark mb-1 d-flex align-items-center justify-content-between">
                        <span>Queue History</span>
                        <ArrowRightIcon size={16} className="text-muted pq-action-card__arrow" />
                      </h3>
                      <p className="small text-muted mb-0">
                        Review your completed visits, wait durations, and past token records.
                      </p>
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          </section>

          {/* Lower Grid: 5. Available Services Preview & 6. Recent Activity */}
          <div className="row g-4 mb-4">
            {/* 5. Available Services Preview */}
            <div className="col-12 col-lg-6">
              <section className="pq-services-preview-section h-100 card shadow-sm border" aria-label="Available Services Preview">
                <div className="card-header bg-white py-3 d-flex align-items-center justify-content-between border-bottom">
                  <div>
                    <h2 className="h6 fw-bold mb-0">Available Services</h2>
                    <span className="small text-muted">Currently open university counters</span>
                  </div>
                  <Link to="/services" className="small text-primary fw-semibold text-decoration-none d-inline-flex align-items-center gap-1">
                    <span>View all</span>
                    <ArrowRightIcon size={14} />
                  </Link>
                </div>

                <div className="card-body p-3">
                  {openServicesPreview.length === 0 ? (
                    <div className="text-center py-4 text-muted">
                      <p className="mb-2">No service queues are currently open for joining.</p>
                      <Link to="/services" className="btn btn-sm btn-outline-primary">
                        Check all services
                      </Link>
                    </div>
                  ) : (
                    <div className="d-flex flex-column gap-3">
                      {openServicesPreview.map((s) => (
                        <div
                          key={s._id}
                          className="pq-service-preview-card p-3 rounded border bg-light-subtle d-flex align-items-center justify-content-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="d-flex align-items-center gap-2 mb-1">
                              <span className="fw-bold text-dark text-truncate">{s.name}</span>
                              <QueueStatusBadge status={s.queueStatus} isActive={s.isActive} />
                            </div>
                            <div className="small text-muted d-flex align-items-center gap-3">
                              <span className="d-inline-flex align-items-center gap-1">
                                <ClockIcon size={13} />
                                <span>Wait: <strong>{formatMinutes(s.estimatedWaitMinutes)}</strong></span>
                              </span>
                              <span className="d-inline-flex align-items-center gap-1">
                                <UsersIcon size={13} />
                                <span>Waiting: <strong>{s.waitingCount ?? 0}</strong></span>
                              </span>
                            </div>
                          </div>

                          <div className="flex-shrink-0">
                            {entry ? (
                              <Link to="/services" className="btn btn-sm btn-outline-secondary">
                                View
                              </Link>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1"
                                disabled={joiningId === s._id}
                                onClick={() => handleJoinPreview(s._id)}
                              >
                                {joiningId === s._id ? (
                                  <>
                                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                                    <span>Joining...</span>
                                  </>
                                ) : (
                                  <>
                                    <TicketIcon size={14} />
                                    <span>Join</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* 6. Recent Activity */}
            <div className="col-12 col-lg-6">
              <section className="pq-recent-activity-section h-100 card shadow-sm border" aria-label="Recent Activity">
                <div className="card-header bg-white py-3 d-flex align-items-center justify-content-between border-bottom">
                  <div>
                    <h2 className="h6 fw-bold mb-0">Recent Activity</h2>
                    <span className="small text-muted">Your latest queue tokens</span>
                  </div>
                  <Link to="/history" className="small text-primary fw-semibold text-decoration-none d-inline-flex align-items-center gap-1">
                    <span>Full history</span>
                    <ArrowRightIcon size={14} />
                  </Link>
                </div>

                <div className="card-body p-3">
                  {recentRecords.length === 0 ? (
                    <div className="text-center py-4 text-muted">
                      <p className="mb-0">No recent queue history found.</p>
                      <small>Your completed, skipped, and cancelled tokens will appear here.</small>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-hover align-middle mb-0">
                        <thead className="table-light small text-muted">
                          <tr>
                            <th scope="col">Token</th>
                            <th scope="col">Service</th>
                            <th scope="col">Date</th>
                            <th scope="col">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentRecords.map((item) => (
                            <tr key={item._id}>
                              <td className="fw-semibold text-primary">{item.tokenLabel}</td>
                              <td className="text-truncate" style={{ maxWidth: '140px' }}>
                                {item.service?.name || 'Service'}
                              </td>
                              <td className="small text-muted">{formatDateTime(item.joinedAt)}</td>
                              <td>
                                <StatusBadge status={item.status} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
