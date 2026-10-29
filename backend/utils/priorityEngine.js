/**
 * PRIORITY ENGINE  (pure functions: no database, easy to test)
 *
 * Ordering rules, in this order:
 *  1. EFFECTIVE RANK  = priority, lowered ("boosted") by waiting time (aging).
 *       EMERGENCY = 0, URGENT = 1, NORMAL = 2. Lower rank is served first.
 *       Every AGING_MINUTES a person waits, their rank improves by 1,
 *       but only down to URGENT (1). Nobody can overtake an EMERGENCY by waiting.
 *  2. JOIN TIME       = earlier joiners first inside the same rank.
 *  3. FAIRNESS STREAK = after MAX_HIGH_STREAK consecutive high-priority calls,
 *       the next person called is the oldest NORMAL one (if any is waiting).
 */
const { PRIORITY_RANK } = require('./constants');

const NORMAL_RANK = PRIORITY_RANK.NORMAL;

const toNumber = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

function getConfig() {
  return {
    agingMinutes: toNumber(process.env.AGING_MINUTES, 20),
    maxHighStreak: toNumber(process.env.MAX_HIGH_STREAK, 3),
  };
}

// Step 1: waiting-time boost
function getEffectiveRank(entry, now = Date.now(), cfg = getConfig()) {
  const base = PRIORITY_RANK[entry.priority];
  if (base === undefined) return NORMAL_RANK;
  if (base === 0 || cfg.agingMinutes <= 0) return base;

  const waitedMinutes = Math.max(0, (now - new Date(entry.joinedAt).getTime()) / 60000);
  const boost = Math.floor(waitedMinutes / cfg.agingMinutes);
  return Math.max(1, base - boost);
}

// Steps 1 + 2: sort by rank, then by join time (then id, so the order is stable)
function sortByRank(entries, now, cfg) {
  const ranked = entries.map((entry) => ({ entry, rank: getEffectiveRank(entry, now, cfg) }));
  ranked.sort(
    (a, b) =>
      a.rank - b.rank ||
      new Date(a.entry.joinedAt) - new Date(b.entry.joinedAt) ||
      String(a.entry._id).localeCompare(String(b.entry._id))
  );
  return ranked;
}

// Step 3: build the full order by SIMULATING the calls, one by one.
// `streak` = how many high-priority people were called in a row so far.
// Returns an array of { entry, rank } in the exact order they will be called.
function orderQueue(entries, streak = 0, now = Date.now(), cfg = getConfig()) {
  const ranked = sortByRank(entries, now, cfg);
  if (cfg.maxHighStreak <= 0) return ranked; // fairness streak switched off

  const high = ranked.filter((item) => item.rank < NORMAL_RANK);
  const normal = ranked.filter((item) => item.rank >= NORMAL_RANK);
  const result = [];
  let counter = streak;

  while (high.length > 0 || normal.length > 0) {
    let next;
    if (high.length > 0 && normal.length > 0) {
      // Preserve emergency handling: EMERGENCY cases (rank 0) are never postponed for fairness.
      // Fairness streak activates when consecutive high calls >= maxHighStreak and the next is not emergency.
      if (counter >= cfg.maxHighStreak && high[0].rank > 0) {
        next = normal.shift(); // fairness: let one normal person through
        counter = 0;
      } else {
        next = high.shift();
        counter += 1;
      }
    } else if (high.length > 0) {
      next = high.shift();
    } else {
      next = normal.shift();
      counter = 0;
    }
    result.push(next);
  }
  return result;
}

// New streak value after someone is called.
// The streak only grows while NORMAL people are actually waiting.
function nextStreak(currentStreak, calledRank, normalPeopleWaiting) {
  if (calledRank >= NORMAL_RANK) return 0;
  return normalPeopleWaiting ? currentStreak + 1 : 0;
}

// Estimated waiting time (minutes).
// peopleAheadWaiting = number of waiting people ahead of you in the queue.
// inProgress = count or array of entries currently CALLED / SERVING.
// avgMinutes = estimated average service duration per customer.
function estimateWait(peopleAheadWaiting, inProgress = 0, avgMinutes = 5, now = Date.now()) {
  const safeAvg = Math.max(1, Number.isFinite(Number(avgMinutes)) ? Number(avgMinutes) : 5);
  const safeWaitingAhead = Math.max(0, Number(peopleAheadWaiting) || 0);

  // If inProgress is a number (legacy count)
  if (typeof inProgress === 'number') {
    if (safeWaitingAhead === 0 && inProgress === 0) return 0;
    return Math.max(0, Math.ceil((safeWaitingAhead + inProgress) * safeAvg));
  }

  // If inProgress is an array of entries currently CALLED / SERVING
  let inProgressRemaining = 0;
  if (Array.isArray(inProgress)) {
    if (inProgress.length === 0 && safeWaitingAhead === 0) return 0;

    for (const item of inProgress) {
      const startTime = item.servingStartedAt || item.calledAt;
      if (startTime) {
        const elapsedMinutes = Math.max(0, (now - new Date(startTime).getTime()) / 60000);
        const remaining = elapsedMinutes < safeAvg ? safeAvg - elapsedMinutes : 1;
        inProgressRemaining += remaining;
      } else {
        inProgressRemaining += safeAvg;
      }
    }
  }

  const totalWait = safeWaitingAhead * safeAvg + inProgressRemaining;
  return Math.max(0, Math.ceil(totalWait));
}

// Use the configured average until we have enough real data,
// then trust real data more (70%) than the configured guess (30%).
function blendAverage(configuredMinutes, durationsInMinutes) {
  const safeConfigured = Math.max(1, Number.isFinite(Number(configuredMinutes)) ? Number(configuredMinutes) : 5);
  if (!durationsInMinutes || durationsInMinutes.length < 5) return safeConfigured;

  const validDurations = durationsInMinutes.filter((d) => Number.isFinite(d) && d > 0);
  if (validDurations.length < 5) return safeConfigured;

  const actual = validDurations.reduce((sum, d) => sum + d, 0) / validDurations.length;
  const blended = 0.3 * safeConfigured + 0.7 * actual;
  return Math.max(1, Math.round(blended * 10) / 10);
}

module.exports = {
  getConfig,
  getEffectiveRank,
  orderQueue,
  nextStreak,
  estimateWait,
  blendAverage,
};
