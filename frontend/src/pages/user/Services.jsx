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
        <div className="alert alert-info d-flex flex-wrap justify-content-between align-items-center gap-2">
          <span>
            You already have token <strong>{active.tokenLabel}</strong>. You can be in one queue at a time.
          </span>
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
                <div className="pq-panel h-100 d-flex flex-column">
                  <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                    <h2 className="h5 mb-0">{s.name}</h2>
                    <QueueStatusBadge status={s.queueStatus} isActive={s.isActive} />
                  </div>
                  {s.description && <p className="text-secondary">{s.description}</p>}
                  <dl className="row small mb-3 mt-auto">
                    <dt className="col-7 fw-normal text-secondary">People waiting</dt>
                    <dd className="col-5 fw-semibold mb-1">{s.waitingCount}</dd>
                    <dt className="col-7 fw-normal text-secondary">Estimated wait</dt>
                    <dd className="col-5 fw-semibold mb-1">{formatMinutes(s.estimatedWaitMinutes)}</dd>
                    <dt className="col-7 fw-normal text-secondary">Time per person</dt>
                    <dd className="col-5 fw-semibold mb-0">{formatMinutes(s.avgServiceMinutes)}</dd>
                  </dl>
                  <button
                    className="btn btn-primary w-100"
                    disabled={!open || !!active || joiningId === s._id}
                    onClick={() => handleJoin(s._id)}
                  >
                    {joiningId === s._id ? 'Joining...' : open ? 'Join queue' : 'Not taking new people'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
