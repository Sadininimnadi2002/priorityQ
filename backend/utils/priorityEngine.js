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
      if (counter >= cfg.maxHighStreak) {
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
// index = how many WAITING people are before you, inService = people already called/being served.
function estimateWait(index, inServiceCount, avgMinutes) {
  return Math.ceil((index + inServiceCount) * avgMinutes);
}

// Use the configured average until we have enough real data,
// then trust real data more (70%) than the configured guess (30%).
function blendAverage(configuredMinutes, durationsInMinutes) {
  if (durationsInMinutes.length < 5) return configuredMinutes;
  const actual = durationsInMinutes.reduce((sum, d) => sum + d, 0) / durationsInMinutes.length;
  const blended = 0.3 * configuredMinutes + 0.7 * actual;
  return Math.max(0.5, Math.round(blended * 10) / 10);
}

module.exports = {
  getConfig,
  getEffectiveRank,
  orderQueue,
  nextStreak,
  estimateWait,
  blendAverage,
};
