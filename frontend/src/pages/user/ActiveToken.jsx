import { useState } from 'react';
import { Link } from 'react-router-dom';
import Alert from '../../components/Alert';
import Loader from '../../components/Loader';
import PageHead from '../../components/PageHead';
import TokenTicket from '../../components/TokenTicket';
import usePolling from '../../hooks/usePolling';
import { queueApi } from '../../services/endpoints';
import { formatTime, getErrorMessage } from '../../utils/format';

export default function ActiveToken() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [leaving, setLeaving] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);

  const load = async () => {
    try {
      const res = await queueApi.myActive();
      setData(res);
      setUpdatedAt(new Date());
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  usePolling(load, 10000);

  const handleLeave = async () => {
    if (!window.confirm(`Leave the queue? Token ${data.entry.tokenLabel} will be cancelled.`)) return;
    setLeaving(true);
    try {
      await queueApi.leave(data.entry._id);
      setMessage('You left the queue. Your token was cancelled.');
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLeaving(false);
    }
  };

  if (loading) return <Loader />;
  const entry = data?.entry;

  return (
    <>
      <PageHead title="My token" subtitle={updatedAt ? `Updated at ${formatTime(updatedAt)}. Refreshes every 10 seconds.` : ''} />
      <Alert message={error} onClose={() => setError('')} />
      <Alert type="success" message={message} onClose={() => setMessage('')} />

      {!entry ? (
        <div className="pq-panel pq-empty">
          <h2>You have no active token</h2>
          <p>Join a queue to get one.</p>
          <Link to="/services" className="btn btn-primary">
            See services
          </Link>
        </div>
      ) : (
        <div className="d-flex flex-column align-items-start gap-3">
          <TokenTicket entry={entry} info={data.queueInfo} />
          {['WAITING', 'CALLED'].includes(entry.status) && (
            <button className="btn btn-outline-danger" onClick={handleLeave} disabled={leaving}>
              {leaving ? 'Leaving...' : 'Leave queue'}
            </button>
          )}
        </div>
      )}
    </>
  );
}
