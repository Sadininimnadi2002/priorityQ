import { PriorityBadge, StatusBadge } from './Badges';
import { formatMinutes } from '../utils/format';

/**
 * The digital token, styled like a paper queue ticket.
 * Props come from GET /api/queue/my-active  (entry + queueInfo)
 */
export default function TokenTicket({ entry, info }) {
  const status = entry.status;
  const waiting = status === 'WAITING';
  const serviceName = entry.service?.name || 'Service';

  return (
    <article className={`pq-ticket pq-ticket--${status.toLowerCase()}`} aria-live="polite">
      <div className="pq-ticket__head">
        <span>{serviceName}</span>
        <StatusBadge status={status} />
      </div>

      <div className="pq-ticket__number">{entry.tokenLabel}</div>

      {status === 'CALLED' && <p className="pq-ticket__callout">It's your turn. Please go to the counter now.</p>}
      {status === 'SERVING' && (
        <p className="pq-ticket__callout pq-ticket__callout--quiet">You are being served.</p>
      )}

      <div className="pq-ticket__tear" />

      <dl className="pq-ticket__facts">
        <div>
          <dt>Position</dt>
          <dd>{waiting && info ? info.position : '-'}</dd>
        </div>
        <div>
          <dt>People ahead</dt>
          <dd>{waiting && info ? info.peopleAhead : '-'}</dd>
        </div>
        <div>
          <dt>Estimated wait</dt>
          <dd>{waiting && info ? formatMinutes(info.estimatedWaitMinutes) : '-'}</dd>
        </div>
        <div>
          <dt>Priority</dt>
          <dd>
            <PriorityBadge priority={entry.priority} />
            {info?.boosted && <div className="pq-boost mt-1">Moved up for waiting long</div>}
          </dd>
        </div>
      </dl>
    </article>
  );
}
