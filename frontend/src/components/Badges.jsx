import { titleCase } from '../utils/format';

export function PriorityBadge({ priority }) {
  if (!priority) return null;
  return <span className={`pq-badge pq-priority--${priority.toLowerCase()}`}>{titleCase(priority)}</span>;
}

export function StatusBadge({ status }) {
  if (!status) return null;
  return <span className={`pq-badge pq-status--${status.toLowerCase()}`}>{titleCase(status)}</span>;
}

export function QueueStatusBadge({ status, isActive = true }) {
  if (!isActive) return <span className="pq-badge pq-queue--closed">Unavailable</span>;
  if (!status) return null;
  return <span className={`pq-badge pq-queue--${status.toLowerCase()}`}>{titleCase(status)}</span>;
}
