const test = require('node:test');
const assert = require('node:assert/strict');
const { summarize, faceCounts, chiSquare, rng, makePattern } = require('./stats.js');

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-4, `${a} != ${b}`);

test('summarize: 平均と95%信頼区間の幅(1.96×標準誤差)', () => {
  const s = summarize([1, 2, 3, 4]);
  near(s.mean, 2.5);
  near(s.half, (1.96 * Math.sqrt(5 / 3)) / 2);
});

test('faceCounts: 1〜6の面ごとの回数', () => {
  assert.deepEqual(faceCounts([1, 1, 6, 3]), [2, 0, 1, 0, 0, 1]);
});

test('chiSquare: 一様からのずれの適合度統計量', () => {
  assert.equal(chiSquare([10, 10, 10, 10, 10, 10]), 0);
  assert.equal(chiSquare([20, 10, 10, 10, 10, 0]), 20);
});

test('rng: 同じseedなら同じ目の列を返し、目は1〜6', () => {
  const a = rng(42), b = rng(42);
  const xs = Array.from({ length: 1000 }, a);
  assert.deepEqual(xs.slice(0, 20), Array.from({ length: 20 }, b));
  assert.ok(xs.every((x) => Number.isInteger(x) && x >= 1 && x <= 6));
});

test('makePattern: 普通のサイコロと確定サイコロの目の列を作る', () => {
  let i = 0;
  const p = makePattern(() => (i++ % 6) + 1, 3, 4);
  assert.deepEqual(p, { normal: [1, 2, 3], fixed: [4, 5, 6, 1] });
});
