import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import TokenTicket from '../../components/TokenTicket';
import { QueueStatusBadge } from '../../components/Badges';
import { useAuth } from '../../context/AuthContext';
import { servicesApi } from '../../services/endpoints';
import { formatMinutes, homePathForRole } from '../../utils/format';

// A sample ticket for the hero, so visitors see what they will get
const sampleEntry = { tokenLabel: 'GEN-024', status: 'WAITING', priority: 'NORMAL', service: { name: 'General Enquiry' } };
const sampleInfo = { position: 3, peopleAhead: 3, estimatedWaitMinutes: 15 };

export default function Home() {
  const { user } = useAuth();
  const [services, setServices] = useState([]);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    servicesApi
      .list()
      .then((res) => setServices(res.services))
      .catch(() => setLoadError(true));
  }, []);

  return (
    <>
      <section className="pq-hero">
        <div>
          <h1>Take a number without standing in line.</h1>
          <p>
            Join a queue from your phone, get a digital token, and see your place and waiting time update live. Come
            to the counter when it's your turn.
          </p>
          <div className="d-flex flex-wrap gap-2 mt-4">
            {user ? (
              <Link to={homePathForRole(user.role)} className="btn btn-primary btn-lg">
                Go to my dashboard
              </Link>
            ) : (
              <>
                <Link to="/register" className="btn btn-primary btn-lg">
                  Create an account
                </Link>
                <Link to="/login" className="btn btn-outline-primary btn-lg">
                  Log in
                </Link>
              </>
            )}
          </div>
        </div>
        <TokenTicket entry={sampleEntry} info={sampleInfo} />
      </section>

      <section className="mb-5">
        <h2 className="h4 mb-3">Queues right now</h2>
        {loadError && <p className="text-secondary">Live queue information is unavailable at the moment.</p>}
        {!loadError && services.length === 0 && <p className="text-secondary">No services are open yet.</p>}
        {services.length > 0 && (
          <div className="pq-table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Queue</th>
                  <th>Waiting</th>
                  <th>Estimated wait</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s._id}>
                    <td className="fw-semibold">{s.name}</td>
                    <td>
                      <QueueStatusBadge status={s.queueStatus} isActive={s.isActive} />
                    </td>
                    <td>{s.waitingCount}</td>
                    <td>{formatMinutes(s.estimatedWaitMinutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="pq-panel">
        <h2 className="h4 mb-3">Who is served first</h2>
        <div className="pq-priority-explain">
          <div>
            <span className="pq-badge pq-priority--emergency">Emergency</span>
            <p>Served first, always.</p>
          </div>
          <div>
            <span className="pq-badge pq-priority--urgent">Urgent</span>
            <p>Served before normal tokens, in the order they joined.</p>
          </div>
          <div>
            <span className="pq-badge pq-priority--normal">Normal</span>
            <p>Never left waiting forever: long waits move you up, and normal tokens get regular turns.</p>
          </div>
        </div>
      </section>
    </>
  );
}
