import { useEffect, useState } from 'react';
import Alert from './Alert';
import Loader from './Loader';
import { adminApi } from '../services/endpoints';
import { formatMinutes, getErrorMessage } from '../utils/format';

/**
 * FEATURE 4: Admin Analytics Dashboard
 * Displays real-time summary cards, responsive SVG charts (Daily Served Customers Bar Chart,
 * Weekly Queue Activity Line Chart, Priority Distribution Donut Chart, Service Performance),
 * and dynamic date range filters (Today, Last 7 Days, Last 30 Days, Custom Range).
 */
export default function AdminAnalytics() {
  const [period, setPeriod] = useState('7days');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAnalytics = async (selectedPeriod, start, end) => {
    setLoading(true);
    setError('');
    try {
      const params = { period: selectedPeriod };
      if (selectedPeriod === 'custom') {
        if (start) params.startDate = start;
        if (end) params.endDate = end;
      }
      const res = await adminApi.analytics(params);
      setAnalytics(res);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (period !== 'custom') {
      fetchAnalytics(period);
    }
  }, [period]);

  const handleApplyCustom = (e) => {
    e.preventDefault();
    if (!customStart || !customEnd) {
      setError('Please select both start and end dates for custom range.');
      return;
    }
    fetchAnalytics('custom', customStart, customEnd);
  };

  const summary = analytics?.summary;
  const filter = analytics?.filter;
  const dailyServed = analytics?.dailyServed || [];
  const dailyActivity = analytics?.dailyActivity || [];
  const priorityDist = analytics?.priorityDistribution || { NORMAL: 0, URGENT: 0, EMERGENCY: 0, total: 0 };
  const servicePerf = analytics?.servicePerformance || [];

  return (
    <section className="pq-analytics-card p-3 p-md-4 mb-4" aria-label="System Analytics Dashboard">
      {/* 1. Header & Date Range Filter Toolbar */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4 pb-3 border-bottom">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="badge bg-purple-subtle text-primary border border-primary-subtle px-2 py-1">
              PriorityQ Analytics Engine
            </span>
            {filter?.displayLabel && (
              <span className="badge bg-light text-dark border">
                Period: {filter.displayLabel}
              </span>
            )}
          </div>
          <h2 className="h4 fw-bold mb-0 text-dark">Queue Performance & Analytics</h2>
          <p className="text-muted small mb-0 mt-1">
            Real-time analytics and historical operational metrics derived from authentic queue lifecycle events.
          </p>
        </div>

        {/* Date Filter Tabs */}
        <div className="d-flex flex-wrap align-items-center gap-2">
          <button
            type="button"
            className={`btn btn-sm ${period === 'today' ? 'btn-primary' : 'btn-outline-secondary'} pq-filter-pill-btn`}
            onClick={() => setPeriod('today')}
          >
            Today
          </button>
          <button
            type="button"
            className={`btn btn-sm ${period === '7days' ? 'btn-primary' : 'btn-outline-secondary'} pq-filter-pill-btn`}
            onClick={() => setPeriod('7days')}
          >
            Last 7 Days
          </button>
          <button
            type="button"
            className={`btn btn-sm ${period === '30days' ? 'btn-primary' : 'btn-outline-secondary'} pq-filter-pill-btn`}
            onClick={() => setPeriod('30days')}
          >
            Last 30 Days
          </button>
          <button
            type="button"
            className={`btn btn-sm ${period === 'custom' ? 'btn-primary' : 'btn-outline-secondary'} pq-filter-pill-btn`}
            onClick={() => setPeriod('custom')}
          >
            Custom Range
          </button>
        </div>
      </div>

      {/* Custom Date Range Picker */}
      {period === 'custom' && (
        <form onSubmit={handleApplyCustom} className="card p-3 mb-4 bg-light border">
          <div className="row g-2 align-items-center">
            <div className="col-12 col-md-4">
              <label className="form-label small fw-bold text-secondary mb-1">Start Date</label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                required
              />
            </div>
            <div className="col-12 col-md-4">
              <label className="form-label small fw-bold text-secondary mb-1">End Date</label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                required
              />
            </div>
            <div className="col-12 col-md-4 d-flex align-items-end">
              <button type="submit" className="btn btn-primary btn-sm w-100 mt-md-4">
                Apply Date Range
              </button>
            </div>
          </div>
        </form>
      )}

      <Alert message={error} onClose={() => setError('')} />

      {loading && <Loader />}

      {!loading && summary && (
        <>
          {/* 2. Dashboard Summary Cards (6 Cards) */}
          <div className="row g-3 mb-4">
            {/* Card 1: Total Tokens Today */}
            <div className="col-12 col-sm-6 col-lg-4 col-xl-2">
              <div className="pq-analytics-stat-card">
                <span className="pq-analytics-stat-card__label">Total Tokens Today</span>
                <span className="pq-analytics-stat-card__value text-primary">{summary.totalTokensToday}</span>
                <span className="pq-analytics-stat-card__sub">
                  {period !== 'today' ? `${summary.totalTokensPeriod} in period` : 'Generated today'}
                </span>
              </div>
            </div>

            {/* Card 2: Customers Served Today */}
            <div className="col-12 col-sm-6 col-lg-4 col-xl-2">
              <div className="pq-analytics-stat-card pq-analytics-stat-card--success">
                <span className="pq-analytics-stat-card__label">Served Today</span>
                <span className="pq-analytics-stat-card__value text-success">{summary.customersServedToday}</span>
                <span className="pq-analytics-stat-card__sub">
                  {period !== 'today' ? `${summary.customersServedPeriod} in period` : 'Completed visits'}
                </span>
              </div>
            </div>

            {/* Card 3: Currently Waiting Customers */}
            <div className="col-12 col-sm-6 col-lg-4 col-xl-2">
              <div className="pq-analytics-stat-card pq-analytics-stat-card--warning">
                <span className="pq-analytics-stat-card__label">Waiting Now</span>
                <span className="pq-analytics-stat-card__value text-warning-emphasis">
                  {summary.currentlyWaitingCustomers}
                </span>
                <span className="pq-analytics-stat-card__sub">In virtual queues</span>
              </div>
            </div>

            {/* Card 4: Average Waiting Time Today */}
            <div className="col-12 col-sm-6 col-lg-4 col-xl-2">
              <div className="pq-analytics-stat-card">
                <span className="pq-analytics-stat-card__label">Avg Wait Today</span>
                <span className="pq-analytics-stat-card__value text-dark fs-3">
                  {summary.averageWaitingTimeToday !== null
                    ? formatMinutes(summary.averageWaitingTimeToday)
                    : 'N/A'}
                </span>
                <span className="pq-analytics-stat-card__sub">
                  {summary.averageWaitingTimePeriod !== null && period !== 'today'
                    ? `Period: ${formatMinutes(summary.averageWaitingTimePeriod)}`
                    : 'Join to call time'}
                </span>
              </div>
            </div>

            {/* Card 5: Active Services */}
            <div className="col-12 col-sm-6 col-lg-4 col-xl-2">
              <div className="pq-analytics-stat-card pq-analytics-stat-card--accent">
                <span className="pq-analytics-stat-card__label">Active Services</span>
                <span className="pq-analytics-stat-card__value text-purple">{summary.activeServices}</span>
                <span className="pq-analytics-stat-card__sub">Operational desks</span>
              </div>
            </div>

            {/* Card 6: Emergency Tokens Today */}
            <div className="col-12 col-sm-6 col-lg-4 col-xl-2">
              <div className="pq-analytics-stat-card pq-analytics-stat-card--danger">
                <span className="pq-analytics-stat-card__label">Emergency Today</span>
                <span className="pq-analytics-stat-card__value text-danger">{summary.emergencyTokensToday}</span>
                <span className="pq-analytics-stat-card__sub">
                  {period !== 'today' ? `${summary.emergencyTokensPeriod} in period` : 'Highest priority'}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Charts Grid */}
          <div className="row g-4 mb-4">
            {/* Chart 1: Daily Served Customers Bar Chart */}
            <div className="col-12 col-lg-6">
              <div className="pq-chart-box shadow-sm">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <h3 className="pq-chart-box__title mb-0">Daily Served Customers</h3>
                  <span className="badge bg-success-subtle text-success border border-success-subtle">
                    Completed Tokens
                  </span>
                </div>
                <p className="pq-chart-box__subtitle">
                  Completed customer visits per day during {filter?.displayLabel || 'the selected period'}.
                </p>

                <DailyServedBarChart data={dailyServed} />
              </div>
            </div>

            {/* Chart 2: Weekly Queue Activity Line Chart */}
            <div className="col-12 col-lg-6">
              <div className="pq-chart-box shadow-sm">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <h3 className="pq-chart-box__title mb-0">Daily Queue Activity</h3>
                  <div className="d-flex align-items-center gap-2 small">
                    <span className="d-flex align-items-center gap-1 text-primary fw-semibold">
                      <span style={{ width: 10, height: 10, background: '#7c3aed', borderRadius: '50%', display: 'inline-block' }} />
                      Generated
                    </span>
                    <span className="d-flex align-items-center gap-1 text-success fw-semibold">
                      <span style={{ width: 10, height: 10, background: '#16a34a', borderRadius: '50%', display: 'inline-block' }} />
                      Completed
                    </span>
                  </div>
                </div>
                <p className="pq-chart-box__subtitle">
                  Comparison between tokens created and successfully served over time.
                </p>

                <QueueActivityLineChart data={dailyActivity} />
              </div>
            </div>

            {/* Chart 3: Priority Distribution Donut Chart */}
            <div className="col-12 col-lg-5">
              <div className="pq-chart-box shadow-sm">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <h3 className="pq-chart-box__title mb-0">Priority Distribution</h3>
                  <span className="badge bg-light text-dark border">Stored Priorities</span>
                </div>
                <p className="pq-chart-box__subtitle">
                  Proportion of customer visits requested by base stored priority level.
                </p>

                <PriorityDonutChart distribution={priorityDist} />
              </div>
            </div>

            {/* Chart 4: Service Performance Chart */}
            <div className="col-12 col-lg-7">
              <div className="pq-chart-box shadow-sm">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <h3 className="pq-chart-box__title mb-0">Service Performance</h3>
                  <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                    Served by Department
                  </span>
                </div>
                <p className="pq-chart-box__subtitle">
                  Total completed visits served across campus departments during {filter?.displayLabel || 'selected period'}.
                </p>

                <ServicePerformanceChart services={servicePerf} />
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

// --------------------------------------------------------------------------
// Sub-component: Daily Served Bar Chart (Responsive SVG)
// --------------------------------------------------------------------------
function DailyServedBarChart({ data }) {
  if (!data || data.length === 0) {
    return <div className="text-center text-muted p-4">No completion data available.</div>;
  }

  const maxVal = Math.max(5, ...data.map((d) => d.completed));
  const height = 180;
  const barWidth = Math.max(12, Math.min(36, Math.floor(380 / data.length) - 8));
  const gap = Math.max(4, Math.floor((480 - data.length * barWidth) / (data.length + 1)));

  return (
    <div className="pq-chart-container" style={{ width: '100%', overflowX: 'auto' }}>
      <svg
        viewBox="0 0 500 200"
        style={{ width: '100%', minWidth: '320px', height: '200px' }}
        aria-label="Bar chart of daily served customers"
      >
        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
        </defs>

        {/* Baseline */}
        <line x1="10" y1="160" x2="490" y2="160" stroke="#e5e7eb" strokeWidth="1.5" />

        {data.map((d, i) => {
          const x = 20 + i * (barWidth + gap);
          const barH = Math.max(2, Math.round((d.completed / maxVal) * 120));
          const y = 160 - barH;

          return (
            <g key={d.date} className="pq-chart-bar-group">
              <title>{`${d.label}: ${d.completed} customers served`}</title>
              {/* Bar Value on Top */}
              <text
                x={x + barWidth / 2}
                y={y - 6}
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fill={d.completed > 0 ? '#5b21b6' : '#9ca3af'}
              >
                {d.completed}
              </text>
              {/* Bar Rect */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                rx="4"
                fill="url(#barGrad)"
                opacity={d.completed > 0 ? 0.95 : 0.3}
              />
              {/* X Axis Label */}
              <text
                x={x + barWidth / 2}
                y="180"
                textAnchor="middle"
                fontSize="10"
                fill="#6b7280"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// --------------------------------------------------------------------------
// Sub-component: Queue Activity Line Chart (Responsive SVG)
// --------------------------------------------------------------------------
function QueueActivityLineChart({ data }) {
  if (!data || data.length === 0) {
    return <div className="text-center text-muted p-4">No queue activity data available.</div>;
  }

  const maxVal = Math.max(5, ...data.map((d) => Math.max(d.created, d.completed)));
  const width = 500;
  const height = 180;
  const plotY = (val) => 150 - Math.round((val / maxVal) * 110);
  const stepX = data.length > 1 ? 440 / (data.length - 1) : 440;

  const createdPoints = data.map((d, i) => `${30 + i * stepX},${plotY(d.created)}`).join(' ');
  const completedPoints = data.map((d, i) => `${30 + i * stepX},${plotY(d.completed)}`).join(' ');

  return (
    <div className="pq-chart-container" style={{ width: '100%', overflowX: 'auto' }}>
      <svg
        viewBox="0 0 500 200"
        style={{ width: '100%', minWidth: '320px', height: '200px' }}
        aria-label="Line chart of weekly queue activity"
      >
        {/* Horizontal gridlines */}
        <line x1="20" y1="40" x2="480" y2="40" stroke="#f3f4f6" strokeDasharray="3 3" />
        <line x1="20" y1="95" x2="480" y2="95" stroke="#f3f4f6" strokeDasharray="3 3" />
        <line x1="20" y1="150" x2="480" y2="150" stroke="#e5e7eb" strokeWidth="1.5" />

        {/* Line 1: Created Tokens */}
        <polyline
          fill="none"
          stroke="#7c3aed"
          strokeWidth="2.5"
          points={createdPoints}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Line 2: Completed Tokens */}
        <polyline
          fill="none"
          stroke="#16a34a"
          strokeWidth="2.5"
          points={completedPoints}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points & X-axis labels */}
        {data.map((d, i) => {
          const cx = 30 + i * stepX;
          const cyCreated = plotY(d.created);
          const cyCompleted = plotY(d.completed);

          return (
            <g key={d.date}>
              <title>{`${d.label}: ${d.created} Generated, ${d.completed} Completed`}</title>
              {/* Dot Created */}
              <circle cx={cx} cy={cyCreated} r="4" fill="#7c3aed" stroke="#ffffff" strokeWidth="1.5" />
              {/* Dot Completed */}
              <circle cx={cx} cy={cyCompleted} r="4" fill="#16a34a" stroke="#ffffff" strokeWidth="1.5" />
              {/* X Axis Label */}
              <text x={cx} y="175" textAnchor="middle" fontSize="10" fill="#6b7280">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// --------------------------------------------------------------------------
// Sub-component: Priority Distribution Donut Chart (Responsive SVG)
// --------------------------------------------------------------------------
function PriorityDonutChart({ distribution }) {
  const { NORMAL = 0, URGENT = 0, EMERGENCY = 0, total = 0 } = distribution;

  if (total === 0) {
    return (
      <div className="text-center p-4">
        <div className="text-muted small mb-2">No priority records found for this period.</div>
        <div className="badge bg-light text-dark border">Total: 0 tokens</div>
      </div>
    );
  }

  const radius = 60;
  const circum = 2 * Math.PI * radius; // ~376.99

  const pNormal = NORMAL / total;
  const pUrgent = URGENT / total;
  const pEmerg = EMERGENCY / total;

  const strokeNormal = pNormal * circum;
  const strokeUrgent = pUrgent * circum;
  const strokeEmerg = pEmerg * circum;

  const offsetNormal = 0;
  const offsetUrgent = -strokeNormal;
  const offsetEmerg = -(strokeNormal + strokeUrgent);

  return (
    <div className="row align-items-center g-3">
      <div className="col-12 col-sm-6 text-center">
        <svg width="170" height="170" viewBox="0 0 170 170" className="mx-auto">
          <g transform="rotate(-90 85 85)">
            {/* Background ring */}
            <circle cx="85" cy="85" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="22" />

            {/* Normal arc */}
            {NORMAL > 0 && (
              <circle
                cx="85"
                cy="85"
                r={radius}
                fill="none"
                stroke="#6b7280"
                strokeWidth="22"
                strokeDasharray={`${strokeNormal} ${circum}`}
                strokeDashoffset={offsetNormal}
              />
            )}

            {/* Urgent arc */}
            {URGENT > 0 && (
              <circle
                cx="85"
                cy="85"
                r={radius}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="22"
                strokeDasharray={`${strokeUrgent} ${circum}`}
                strokeDashoffset={offsetUrgent}
              />
            )}

            {/* Emergency arc */}
            {EMERGENCY > 0 && (
              <circle
                cx="85"
                cy="85"
                r={radius}
                fill="none"
                stroke="#dc2626"
                strokeWidth="22"
                strokeDasharray={`${strokeEmerg} ${circum}`}
                strokeDashoffset={offsetEmerg}
              />
            )}
          </g>

          {/* Center Text */}
          <text x="85" y="80" textAnchor="middle" fontSize="22" fontWeight="800" fill="#1f1b2d">
            {total}
          </text>
          <text x="85" y="98" textAnchor="middle" fontSize="11" fill="#6b7280">
            Tokens
          </text>
        </svg>
      </div>

      <div className="col-12 col-sm-6">
        <div className="d-flex flex-column gap-2 small">
          <div className="d-flex align-items-center justify-content-between p-2 rounded bg-light border">
            <div className="d-flex align-items-center gap-2">
              <span style={{ width: 10, height: 10, background: '#6b7280', borderRadius: '50%' }} />
              <span className="fw-semibold">NORMAL</span>
            </div>
            <span>
              <strong>{NORMAL}</strong> ({(pNormal * 100).toFixed(1)}%)
            </span>
          </div>

          <div className="d-flex align-items-center justify-content-between p-2 rounded bg-light border">
            <div className="d-flex align-items-center gap-2">
              <span style={{ width: 10, height: 10, background: '#f59e0b', borderRadius: '50%' }} />
              <span className="fw-semibold">URGENT</span>
            </div>
            <span>
              <strong>{URGENT}</strong> ({(pUrgent * 100).toFixed(1)}%)
            </span>
          </div>

          <div className="d-flex align-items-center justify-content-between p-2 rounded bg-light border">
            <div className="d-flex align-items-center gap-2">
              <span style={{ width: 10, height: 10, background: '#dc2626', borderRadius: '50%' }} />
              <span className="fw-semibold">EMERGENCY</span>
            </div>
            <span>
              <strong>{EMERGENCY}</strong> ({(pEmerg * 100).toFixed(1)}%)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Sub-component: Service Performance Chart
// --------------------------------------------------------------------------
function ServicePerformanceChart({ services }) {
  if (!services || services.length === 0) {
    return <div className="text-center text-muted p-4">No service data available.</div>;
  }

  const maxVal = Math.max(1, ...services.map((s) => s.completed));

  return (
    <div className="d-flex flex-column gap-3">
      {services.map((s) => {
        const pct = Math.round((s.completed / maxVal) * 100);

        return (
          <div key={s.serviceId} className="pq-service-perf-item">
            <div className="d-flex align-items-center justify-content-between small">
              <div className="d-flex align-items-center gap-2">
                <span className="fw-bold text-dark">{s.name}</span>
                <span className="badge bg-light text-secondary border">{s.code}</span>
              </div>
              <span className="fw-bold text-primary">
                {s.completed} <span className="text-muted fw-normal">served</span>
              </span>
            </div>
            <div className="pq-service-perf-track">
              <div
                className="pq-service-perf-bar"
                style={{ width: `${s.completed > 0 ? Math.max(4, pct) : 0}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
