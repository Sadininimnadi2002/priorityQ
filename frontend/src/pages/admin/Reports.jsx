import { useEffect, useState } from 'react';
import Alert from '../../components/Alert';
import Loader from '../../components/Loader';
import PageHead from '../../components/PageHead';
import { PriorityBadge } from '../../components/Badges';
import { adminApi, servicesApi } from '../../services/endpoints';
import { formatDateTime, formatMinutes, getErrorMessage } from '../../utils/format';

export default function Reports() {
  const [days, setDays] = useState(7);
  const [report, setReport] = useState(null);
  const [logs, setLogs] = useState(null);
  const [logPage, setLogPage] = useState(1);
  const [logService, setLogService] = useState('');
  const [services, setServices] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    setReport(null);
    adminApi.reports(days).then(setReport).catch((err) => setError(getErrorMessage(err)));
  }, [days]);

  useEffect(() => {
    const params = { page: logPage, limit: 10 };
    if (logService) params.serviceId = logService;
    adminApi.priorityLogs(params).then(setLogs).catch((err) => setError(getErrorMessage(err)));
  }, [logPage, logService]);

  useEffect(() => {
    servicesApi.list({ includeInactive: true }).then((res) => setServices(res.services)).catch(() => {});
  }, []);

  const maxCompleted = report ? Math.max(1, ...report.byDay.map((d) => d.completed)) : 1;
  const totalCompleted = report ? report.byDay.reduce((sum, d) => sum + d.completed, 0) : 0;

  return (
    <>
      <PageHead title="Reports" subtitle="How the queues performed, and every priority change.">
        <label htmlFor="days" className="text-secondary small mb-0">Period</label>
        <select id="days" className="form-select form-select-sm" style={{ width: 'auto' }} value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={1}>Today</option>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </PageHead>
      <Alert message={error} onClose={() => setError('')} />

      {!report ? (
        <Loader />
      ) : (
        <div className="row g-3 mb-4">
          <div className="col-lg-8">
            <div className="pq-panel h-100">
              <h2>Customers served per day ({totalCompleted} total)</h2>
              {report.byDay.length === 0 ? (
                <p className="text-secondary mb-0">Nobody was served in this period.</p>
              ) : (
                <div className="pq-bars" role="img" aria-label="Customers served per day">
                  {report.byDay.map((d) => (
                    <div className="pq-bars__col" key={d.date} title={`${d.date}: ${d.completed} served, average wait ${formatMinutes(d.avgWaitMinutes)}`}>
                      <span className="pq-bars__value">{d.completed}</span>
                      <div className="pq-bars__bar" style={{ height: `${(d.completed / maxCompleted) * 100}%` }} />
                      <span>{d.date.slice(5)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="col-lg-4">
            <div className="pq-panel h-100">
              <h2>Tokens by priority</h2>
              {['EMERGENCY', 'URGENT', 'NORMAL'].map((p) => (
                <div className="d-flex justify-content-between align-items-center py-2 border-bottom" key={p}>
                  <PriorityBadge priority={p} />
                  <span className="fw-semibold">{report.byPriority[p] || 0}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="col-12">
            <h2 className="h5 mt-2">By service</h2>
            <div className="pq-table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Total tokens</th>
                    <th>Completed</th>
                    <th>Skipped</th>
                    <th>Cancelled</th>
                    <th>Still active</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byService.map((row) => (
                    <tr key={row.service._id}>
                      <td className="fw-semibold">{row.service.name}</td>
                      <td>{row.total}</td>
                      <td>{row.COMPLETED}</td>
                      <td>{row.SKIPPED}</td>
                      <td>{row.CANCELLED}</td>
                      <td>{row.ACTIVE}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {report.byDay.length > 0 && (
            <div className="col-12">
              <h2 className="h5 mt-2">Average wait per day</h2>
              <div className="pq-table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Served</th>
                      <th>Average wait</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byDay.map((d) => (
                      <tr key={d.date}>
                        <td>{d.date}</td>
                        <td>{d.completed}</td>
                        <td>{formatMinutes(d.avgWaitMinutes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-2">
        <h2 className="h5 mb-0">Priority change history</h2>
        <select
          className="form-select form-select-sm"
          style={{ width: 'auto' }}
          aria-label="Filter priority changes by service"
          value={logService}
          onChange={(e) => {
            setLogService(e.target.value);
            setLogPage(1);
          }}
        >
          <option value="">All services</option>
          {services.map((s) => (
            <option key={s._id} value={s._id}>{s.name}</option>
          ))}
        </select>
      </div>

      {!logs ? (
        <Loader />
      ) : logs.logs.length === 0 ? (
        <div className="pq-panel pq-empty">
          <p className="mb-0">No priority changes yet.</p>
        </div>
      ) : (
        <>
          <div className="pq-table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Token</th>
                  <th>Service</th>
                  <th>Change</th>
                  <th>Reason</th>
                  <th>Changed by</th>
                </tr>
              </thead>
              <tbody>
                {logs.logs.map((log) => (
                  <tr key={log._id}>
                    <td className="text-nowrap">{formatDateTime(log.createdAt)}</td>
                    <td className="fw-semibold">{log.queueEntry?.tokenLabel || '-'}</td>
                    <td>{log.service?.name || '-'}</td>
                    <td className="text-nowrap">
                      <PriorityBadge priority={log.oldPriority} /> to <PriorityBadge priority={log.newPriority} />
                    </td>
                    <td style={{ minWidth: 220 }}>{log.reason}</td>
                    <td>{log.changedBy?.name || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="d-flex justify-content-between align-items-center mt-3">
            <span className="text-secondary small">
              {logs.total} changes, page {logs.page} of {logs.pages}
            </span>
            <div className="btn-group">
              <button className="btn btn-sm btn-outline-secondary" disabled={logs.page <= 1} onClick={() => setLogPage(logPage - 1)}>
                Previous
              </button>
              <button className="btn btn-sm btn-outline-secondary" disabled={logs.page >= logs.pages} onClick={() => setLogPage(logPage + 1)}>
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
