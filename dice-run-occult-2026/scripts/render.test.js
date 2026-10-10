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

test('separated: 1位との差の信頼区間がすべて0を上回るときだけ真', () => {
  assert.equal(separated(run({ A: { mean: 10, half: 5 }, C: { mean: 60, half: 5 } })), true);
  assert.equal(separated(run({ A: { mean: 3, half: 5 }, C: { mean: 60, half: 5 } })), false);
});

test('結論は1位の使い方と2位との差を計算結果から書く', () => {
  const diffs = { A: { mean: 9.4, half: 5 }, D: { mean: 52.2, half: 5 }, C: { mean: 60.4, half: 5 } };
  const html = renderReport({ main: run(diffs), independent: run(diffs), table: { normal: u, fixed: u, fixedLength: 300 } });
  assert.match(html, /カケラ8個のマスへ進む（B「4をカケラ12のマスで使う」）<\/strong>使い方で/);
  assert.match(html, /2位のA「4でスタートを狙う」より平均9\.4個多く/);
  assert.match(html, /D・Cより52\.2〜60\.4個多く/);
});
