const test = require('node:test');
const assert = require('node:assert');
const engine = require('../utils/priorityEngine');

const MIN = 60000;
const now = Date.now();
const cfg = { agingMinutes: 20, maxHighStreak: 3 };

// helper: make a fake entry that joined `minutesAgo` minutes ago
const make = (id, priority, minutesAgo) => ({
  _id: id,
  priority,
  joinedAt: new Date(now - minutesAgo * MIN),
});
const ids = (ordered) => ordered.map((o) => o.entry._id);

test('orders by priority, then by join time', () => {
  const entries = [
    make('n1', 'NORMAL', 10),
    make('u1', 'URGENT', 5),
    make('e1', 'EMERGENCY', 1),
    make('n2', 'NORMAL', 8),
    make('u2', 'URGENT', 6),
  ];
  const out = engine.orderQueue(entries, 0, now, { agingMinutes: 0, maxHighStreak: 0 });
  assert.deepStrictEqual(ids(out), ['e1', 'u2', 'u1', 'n1', 'n2']);
});

test('aging: a NORMAL who waited 25 min beats a newer URGENT', () => {
  const entries = [make('u1', 'URGENT', 2), make('n1', 'NORMAL', 25)];
  const out = engine.orderQueue(entries, 0, now, { agingMinutes: 20, maxHighStreak: 0 });
  assert.deepStrictEqual(ids(out), ['n1', 'u1']);
});

test('aging never lets anyone overtake an EMERGENCY', () => {
  const entries = [make('e1', 'EMERGENCY', 1), make('n1', 'NORMAL', 500)];
  const out = engine.orderQueue(entries, 0, now, { agingMinutes: 20, maxHighStreak: 0 });
  assert.deepStrictEqual(ids(out), ['e1', 'n1']);
});

test('fairness streak: one NORMAL is served after 3 high-priority calls', () => {
  const entries = [
    make('u1', 'URGENT', 5),
    make('u2', 'URGENT', 4),
    make('u3', 'URGENT', 3),
    make('u4', 'URGENT', 2),
    make('u5', 'URGENT', 1),
    make('n1', 'NORMAL', 0),
  ];
  const out = engine.orderQueue(entries, 0, now, { agingMinutes: 0, maxHighStreak: 3 });
  assert.deepStrictEqual(ids(out), ['u1', 'u2', 'u3', 'n1', 'u4', 'u5']);
});

test('fairness streak respects an existing streak from earlier calls', () => {
  const entries = [make('u1', 'URGENT', 5), make('n1', 'NORMAL', 1)];
  const out = engine.orderQueue(entries, 3, now, { agingMinutes: 0, maxHighStreak: 3 });
  assert.deepStrictEqual(ids(out), ['n1', 'u1']);
});

test('nextStreak grows only while normal people wait, resets on a normal call', () => {
  assert.strictEqual(engine.nextStreak(2, 1, true), 3);
  assert.strictEqual(engine.nextStreak(2, 1, false), 0);
  assert.strictEqual(engine.nextStreak(2, 2, true), 0);
});

test('estimateWait = (people ahead + in service) x average, rounded up', () => {
  assert.strictEqual(engine.estimateWait(0, 0, 5), 0);
  assert.strictEqual(engine.estimateWait(2, 1, 5), 15);
  assert.strictEqual(engine.estimateWait(1, 0, 4.5), 5);
});

test('blendAverage uses configured value until 5 real samples exist', () => {
  assert.strictEqual(engine.blendAverage(5, [10, 10]), 5);
  assert.strictEqual(engine.blendAverage(10, [20, 20, 20, 20, 20]), 17);
});

test('same-priority FIFO: customers with identical priority are ordered strictly by join time', () => {
  const entries = [
    make('n3', 'NORMAL', 2),
    make('n1', 'NORMAL', 15),
    make('n2', 'NORMAL', 7),
  ];
  const out = engine.orderQueue(entries, 0, now, { agingMinutes: 0, maxHighStreak: 0 });
  assert.deepStrictEqual(ids(out), ['n1', 'n2', 'n3']);
});

test('emergency ordering: EMERGENCY always comes before URGENT and NORMAL', () => {
  const entries = [
    make('n1', 'NORMAL', 60),
    make('u1', 'URGENT', 30),
    make('e1', 'EMERGENCY', 0),
  ];
  const out = engine.orderQueue(entries, 0, now, { agingMinutes: 20, maxHighStreak: 0 });
  assert.strictEqual(ids(out)[0], 'e1');
});

test('emergency is preserved even when high-priority streak has reached limit', () => {
  const entries = [
    make('e1', 'EMERGENCY', 1),
    make('u1', 'URGENT', 2),
    make('n1', 'NORMAL', 10),
  ];
  // streak is already 3, but next high priority is EMERGENCY (rank 0)
  const out = engine.orderQueue(entries, 3, now, { agingMinutes: 0, maxHighStreak: 3 });
  assert.strictEqual(ids(out)[0], 'e1', 'EMERGENCY must be served first despite streak');
});

test('empty queue returns empty array safely', () => {
  const out = engine.orderQueue([], 0, now, cfg);
  assert.deepStrictEqual(out, []);
});

test('progress-aware wait estimation: accounts for active service progress and never returns negative', () => {
  // Case 1: First in line, no one in service -> 0 min
  assert.strictEqual(engine.estimateWait(0, [], 5, now), 0);

  // Case 2: 1 person ahead, 1 in service who started 3 min ago (of 5 min avg)
  // Remaining = 2 min. Total wait = (1 ahead * 5) + 2 = 7 min
  const inService = [{ servingStartedAt: new Date(now - 3 * MIN) }];
  assert.strictEqual(engine.estimateWait(1, inService, 5, now), 7);

  // Case 3: In service running longer than avg (6 min on a 5 min avg)
  // Grace buffer of 1 min applies, total = (0 ahead * 5) + 1 = 1 min
  const inServiceLong = [{ servingStartedAt: new Date(now - 6 * MIN) }];
  assert.strictEqual(engine.estimateWait(0, inServiceLong, 5, now), 1);

  // Case 4: Never negative under any negative inputs
  assert.strictEqual(engine.estimateWait(-5, -3, -10, now), 0);
});

test('dynamic priority change: changing NORMAL to EMERGENCY immediately promotes token to head of queue', () => {
  const entryNormal = make('t1', 'NORMAL', 5);
  const entryUrgent = make('t2', 'URGENT', 4);
  const initial = engine.orderQueue([entryNormal, entryUrgent], 0, now, { agingMinutes: 0, maxHighStreak: 0 });
  assert.deepStrictEqual(ids(initial), ['t2', 't1']);

  // Change t1 priority to EMERGENCY
  entryNormal.priority = 'EMERGENCY';
  const updated = engine.orderQueue([entryNormal, entryUrgent], 0, now, { agingMinutes: 0, maxHighStreak: 0 });
  assert.deepStrictEqual(ids(updated), ['t1', 't2']);
});
