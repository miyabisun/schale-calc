const test = require('node:test');
const assert = require('node:assert/strict');
const { endValue } = require('./dice-run.js');
const { solve, value, actionValues, best, expectedStart } = require('./optimal.js');

const hand = (...faces) => faces.reduce((c, f) => { c[f]++; return c; }, [0, 0, 0, 0, 0, 0, 0]);
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

const small = solve({ limit: 2, rolls: 1 });

test('残り0回は、手持ちを使い切る期待値の最大値と一致する', () => {
  // 手持ち2個までなら上限2で受取を捨てることはない
  const hands = [hand(), ...[1, 2, 3, 4, 5, 6].map((f) => hand(f))];
  for (let f = 1; f <= 6; f++) for (let g = f; g <= 6; g++) hands.push(hand(f, g));
  for (let pos = 0; pos < 18; pos++) for (const h of hands) close(value(small, 0, pos, h), endValue(pos, h));
});

test('残り1回: 手持ちが無ければ普通のサイコロの期待値', () => {
  // 7から1でマス8(12個)、5でマス12(8個)
  close(value(small, 1, 7, hand()), 20 / 6);
  close(value(small, 1, 2, hand()), 12 / 6);
});

test('残り1回: 先に確定サイコロでカケラ12のマスへ止まる方が得', () => {
  // 7から1でマス8(12個)、その後8から4でマス12(8個)。先に振ると平均6個
  close(value(small, 1, 7, hand(1)), 12 + 8 / 6);
  assert.equal(best(small, 1, 7, hand(1)), 1);
  const q = actionValues(small, 1, 7, hand(1));
  close(q[0], 36 / 6);
  assert.ok(Number.isNaN(q[2]));
  // 2から6でマス8。先に振ると(8+12)/6
  close(value(small, 1, 2, hand(6)), 12 + 8 / 6);
  close(actionValues(small, 1, 2, hand(6))[0], 20 / 6);
});

test('確定サイコロを残して先に振る方が得な場面がある', () => {
  // 0から1を使うとマス1で、振ってもカケラに届かない。先に振って4が出ればマス7から1でマス8(12個)
  close(actionValues(small, 1, 0, hand(1))[1], 0);
  close(value(small, 1, 0, hand(1)), 12 / 6);
  assert.equal(best(small, 1, 0, hand(1)), 0);
});

test('上限の個数を持っているときにスタートで受け取った確定サイコロは捨てる', () => {
  // 17から6を使うとマス5、振って3でマス8。先に振ると1でスタート、3でマス2から6でマス8
  const one = solve({ limit: 1, rolls: 1 });
  close(value(one, 1, 17, hand(6)), 2);
  let extra = 0;
  for (let g = 1; g <= 6; g++) extra += endValue(0, hand(6, g)) / 36;
  close(value(small, 1, 17, hand(6)), 2 + extra);
  assert.throws(() => value(one, 1, 17, hand(1, 6)), /上限/);
});

test('最初の手持ちは1〜6が等確率で、その期待値を返す', () => {
  const none = solve({ limit: 2, rolls: 0 });
  // 0から1個ではカケラに届かない
  close(expectedStart(none, 1), 0);
  let sum = 0;
  for (let f = 1; f <= 6; f++) for (let g = 1; g <= 6; g++) sum += endValue(0, hand(f, g)) / 36;
  close(expectedStart(none, 2), sum);
});

test('policy: 求めた期待値が最大の判断で1パターンを進める', () => {
  const { play } = require('./dice-run.js');
  const { policy } = require('./optimal.js');
  // 0で1を持ち、先に振って4でマス7、最後に1でマス8(12個)
  const { endState, ...result } = play(policy(small), { normal: [4], fixed: [1] }, { initial: 1 });
  assert.deepEqual(result, { kakera: 12, report: 0, credit: 0, fixedUsed: 1, fixedGained: 0 });
});

test('tallyScenes: 判断が分かれた場面を現在地と手持ちで数え、多い順に期待値の差の平均を添える', () => {
  const { tallyScenes } = require('./optimal.js');
  const records = [
    { pos: 9, hand: hand(3), optimal: 3, b: 0, diff: 1 },
    { pos: 9, hand: hand(3), optimal: 3, b: 0, diff: 2 },
    { pos: 14, hand: hand(2), optimal: 2, b: 0, diff: 5 },
  ];
  assert.deepEqual(tallyScenes(records, 1), [{ pos: 9, hand: hand(3), optimal: 3, b: 0, count: 2, diff: 1.5 }]);
  assert.equal(tallyScenes(records, 5).length, 2);
});
