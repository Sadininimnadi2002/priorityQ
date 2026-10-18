import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Alert from '../../components/Alert';
import Loader from '../../components/Loader';
import PageHead from '../../components/PageHead';
import { QueueStatusBadge } from '../../components/Badges';
import { queueApi, servicesApi } from '../../services/endpoints';
import { formatMinutes, getErrorMessage } from '../../utils/format';

export default function Services() {
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      // Run both requests at the same time
      const [svcRes, activeRes] = await Promise.all([servicesApi.list(), queueApi.myActive()]);
      setServices(svcRes.services);
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
      load(); // the queue may have closed: refresh the list
    } finally {
      setJoiningId(null);
    }
  };

  if (loading) return <Loader />;

  return (
    <>
      <PageHead title="Services" subtitle="Choose a service and join its queue." />
      <Alert message={error} onClose={() => setError('')} />

      {active && (
        <div className="pq-active-token" role="status">
          <div className="pq-active-token__message">
            <span className="pq-active-token__marker" aria-hidden="true" />
            <span>
              You already have token <strong>{active.tokenLabel}</strong>. You can be in one queue at a time.
            </span>
          </div>
          <Link to="/token" className="btn btn-sm btn-primary">
            Open my token
          </Link>
        </div>
      )}

      {services.length === 0 ? (
        <div className="pq-panel pq-empty">
          <h2>No services are available</h2>
          <p className="mb-0">Please check again later.</p>
        </div>
      ) : (
        <div className="row g-3">
          {services.map((s) => {
            const open = s.isActive && s.queueStatus === 'OPEN';
            return (
              <div className="col-md-6 col-lg-4" key={s._id}>
                <article className="pq-service-card h-100">
                  <div className="pq-service-card__head">
                    <div className="pq-service-card__identity">
                      <span className="pq-service-card__mark" aria-hidden="true" />
                      <h2>{s.name}</h2>
                    </div>
                    <QueueStatusBadge status={s.queueStatus} isActive={s.isActive} />
                  </div>
                  <p className="pq-service-card__description">
                    {s.description || 'Service details are not available.'}
                  </p>
                  <dl className="pq-service-card__metrics">
                    <div>
                      <dt>People waiting</dt>
                      <dd>{s.waitingCount}</dd>
                    </div>
                    <div>
                      <dt>Estimated wait</dt>
                      <dd>{formatMinutes(s.estimatedWaitMinutes)}</dd>
                    </div>
                    <div>
                      <dt>Average service time</dt>
                      <dd>{formatMinutes(s.avgServiceMinutes)}</dd>
                    </div>
                  </dl>
                  <button
                    className="btn btn-primary pq-service-card__join"
                    disabled={!open || !!active || joiningId === s._id}
                    onClick={() => handleJoin(s._id)}
                  >
                    {joiningId === s._id
                      ? 'Joining...'
                      : !open
                        ? 'Not taking new people'
                        : active
                          ? 'Already in a queue'
                          : 'Join queue'}
                  </button>
                </article>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
