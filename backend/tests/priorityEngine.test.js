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

test('getEffectiveRank is stable with default cfg object', () => {
  assert.strictEqual(engine.getEffectiveRank(make('n', 'NORMAL', 0), now, cfg), 2);
  assert.strictEqual(engine.getEffectiveRank(make('n', 'NORMAL', 45), now, cfg), 1);
});
