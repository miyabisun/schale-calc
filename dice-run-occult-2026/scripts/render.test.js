const test = require('node:test');
const assert = require('node:assert/strict');
const { renderReport, separated } = require('./render.js');

const s = (kakera) => ({ kakera: { mean: kakera, half: 4 }, report: { mean: 180, half: 2 }, credit: { mean: 6000, half: 90 }, endGap: 0.1, maxFixedReceived: 60 });
const run = (diffs) => ({
  patterns: 500,
  strategies: { A: s(580), B: s(590), C: s(530), D: s(540) },
  ranking: ['B', 'A', 'D', 'C'],
  diffs,
});
const u = { counts: [1, 1, 1, 1, 1, 1], chi2: 0, critical: 11.07, uniform: true };
const v = (mean) => ({ mean, half: 1 });
const hand = (...faces) => faces.reduce((c, f) => { c[f]++; return c; }, [0, 0, 0, 0, 0, 0, 0]);
const optimal = {
  expected: 602.695, limits: [{ limit: 16, expected: 602.62 }, { limit: 18, expected: 602.694 }, { limit: 20, expected: 602.695 }],
  kakera: v(601), report: v(187), credit: v(5606), diffs: { B: { mean: 8.6, half: 2.1 }, A: v(18) }, divergences: 1552,
  scenes: [{ pos: 7, hand: hand(5), optimal: 5, b: 0, count: 37, diff: 2.4, upTo: 8 }],
};
const table = { normal: u, fixed: u, fixedLength: 300 };

test('separated: 1位との差の信頼区間がすべて0を上回るときだけ真', () => {
  assert.equal(separated(run({ A: { mean: 10, half: 5 }, C: { mean: 60, half: 5 } })), true);
  assert.equal(separated(run({ A: { mean: 3, half: 5 }, C: { mean: 60, half: 5 } })), false);
});

test('結論は1位の使い方と2位との差を計算結果から書く', () => {
  const diffs = { A: { mean: 9.4, half: 5 }, D: { mean: 52.2, half: 5 }, C: { mean: 60.4, half: 5 } };
  const html = renderReport({ main: run(diffs), independent: run(diffs), table, optimal });
  assert.match(html, /カケラ8個のマスへ進む（B「4をカケラ12のマスで使う」）<\/strong>使い方で/);
  assert.match(html, /2位のA「4でスタートを狙う」より平均9\.4個多く/);
  assert.match(html, /D・Cより52\.2〜60\.4個多く/);
});

test('最適な使い方の期待値は下限として、上限ごとの値と500パターンの結果・Bとの差を添えて書く', () => {
  const diffs = { A: { mean: 9.4, half: 5 }, D: { mean: 52.2, half: 5 }, C: { mean: 60.4, half: 5 } };
  const html = renderReport({ main: run(diffs), independent: run(diffs), table, optimal });
  assert.match(html, /期待値は<strong>602\.7個<\/strong>/);
  assert.match(html, /下限/);
  assert.match(html, /16個<\/td><td>602\.62個/);
  assert.match(html, /<th class="text">参考：最適な使い方<\/th><td>601\.0<span class="sub">±1\.0/);
  assert.match(html, /Bより平均\+8\.6個（95%信頼区間 \+6\.5〜\+10\.7個）/);
});

test('判断が分かれた場面は、現在地・手持ち・両者の判断・期待値の差と説明を書く', () => {
  const diffs = { A: { mean: 9.4, half: 5 }, D: { mean: 52.2, half: 5 }, C: { mean: 60.4, half: 5 } };
  const html = renderReport({ main: run(diffs), independent: run(diffs), table, optimal });
  assert.match(html, /マス7（オーパーツ4）、手持ちは5が1個/);
  assert.match(html, /最適：5を使う（マス12（神名のカケラ8）に止まる）/);
  assert.match(html, /B：普通のサイコロを振る/);
  assert.match(html, /期待値の差 \+2\.4個（37回）/);
  assert.match(html, /残りが8回以下/);
  const unknown = { ...optimal, scenes: [{ pos: 1, hand: hand(1), optimal: 1, b: 0, count: 1, diff: 1, upTo: 1 }] };
  assert.throws(() => renderReport({ main: run(diffs), independent: run(diffs), table, optimal: unknown }), /説明/);
});
