// One place for all fixed values, so we never mistype a string like "WAITING".

const ROLES = ['user', 'staff', 'admin'];

const PRIORITIES = ['EMERGENCY', 'URGENT', 'NORMAL'];
// Lower number = served earlier
const PRIORITY_RANK = { EMERGENCY: 0, URGENT: 1, NORMAL: 2 };
const RANK_TO_PRIORITY = ['EMERGENCY', 'URGENT', 'NORMAL'];

const STATUSES = ['WAITING', 'CALLED', 'SERVING', 'COMPLETED', 'SKIPPED', 'CANCELLED'];
const ACTIVE_STATUSES = ['WAITING', 'CALLED', 'SERVING'];

const QUEUE_STATUSES = ['OPEN', 'PAUSED', 'CLOSED'];

// The "state machine": from each status, which statuses are allowed next.
const ALLOWED_TRANSITIONS = {
  WAITING: ['CALLED', 'SKIPPED', 'CANCELLED'],
  CALLED: ['SERVING', 'SKIPPED', 'CANCELLED'],
  SERVING: ['COMPLETED'],
  SKIPPED: ['WAITING'],
  COMPLETED: [],
  CANCELLED: [],
};

module.exports = {
  ROLES,
  PRIORITIES,
  PRIORITY_RANK,
  RANK_TO_PRIORITY,
  STATUSES,
  ACTIVE_STATUSES,
  QUEUE_STATUSES,
  ALLOWED_TRANSITIONS,
};
