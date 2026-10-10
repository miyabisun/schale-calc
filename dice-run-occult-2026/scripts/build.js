// 保存済みの乱数テーブルで全戦略を走らせ、data/results.json と公開ページ index.html を書き出す。
// 最適な使い方の結果は solve.js が書き出した data/optimal.json を読む。

const fs = require('node:fs');
const path = require('node:path');
const { play, endValue, chooseAtEnd, STRATEGIES } = require('./dice-run.js');
const { summarize, faceCounts, chiSquare, rng, makePattern } = require('./stats.js');
const { renderReport } = require('./render.js');

const ROOT = path.join(__dirname, '..');
const CHI2_CRITICAL = 11.07; // 自由度5、有意水準5%
const INDEPENDENT = { patterns: 10000, seed: 20261007 };

const digits = (s) => [...s].map(Number);
const table = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'table.json'), 'utf8'))
  .patterns.map((p) => ({ normal: digits(p.normal), fixed: digits(p.fixed) }));

const round = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
const brief = ({ mean, half }) => ({ mean: round(mean), half: round(half) });

function run(patterns, withEndGap) {
  const runs = Object.fromEntries(STRATEGIES.map((name) => [name, patterns.map((p) => play(name, p))]));
  const strategies = Object.fromEntries(STRATEGIES.map((name) => {
    const rs = runs[name];
    const pick = (k) => brief(summarize(rs.map((r) => r[k])));
    const result = {
      kakera: pick('kakera'), report: pick('report'), credit: pick('credit'),
      fixedUsed: pick('fixedUsed'), fixedGained: pick('fixedGained'),
      maxFixedReceived: Math.max(...rs.map((r) => r.fixedGained)) + 16,
    };
    if (withEndGap) {
      // 最後の消費の手順と、期待値が最大になる使い方(厳密計算)との差
      result.endGap = round(rs.reduce((a, { endState: { pos, hand } }) =>
        a + endValue(pos, hand) - endValue(pos, hand, chooseAtEnd), 0) / rs.length, 3);
    }
    return [name, result];
  }));
  const ranking = [...STRATEGIES].sort((a, b) => strategies[b].kakera.mean - strategies[a].kakera.mean);
  // 1位と各戦略のカケラの差(同じパターン同士で引き算)
  const diffs = Object.fromEntries(ranking.slice(1).map((name) => [name,
    brief(summarize(patterns.map((_, i) => runs[ranking[0]][i].kakera - runs[name][i].kakera)))]));
  return { patterns: patterns.length, strategies, ranking, diffs };
}

const uniformity = (faces) => {
  const counts = faceCounts(faces);
  const chi2 = round(chiSquare(counts));
  return { counts, chi2, critical: CHI2_CRITICAL, uniform: chi2 < CHI2_CRITICAL };
};

const roll = rng(INDEPENDENT.seed);
const independent = Array.from({ length: INDEPENDENT.patterns }, () => makePattern(roll, 200, 300));

// 最適な使い方: 500パターンの集計と、同じパターン同士で比べた各戦略との差
const solved = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'optimal.json'), 'utf8'));
const optimal = {
  expected: round(solved.limits.at(-1).expected, 3),
  limits: solved.limits.map(({ limit, expected }) => ({ limit, expected: round(expected, 4) })),
  ...Object.fromEntries(['kakera', 'report', 'credit'].map((k) => [k, brief(summarize(solved.main[k]))])),
  diffs: Object.fromEntries(STRATEGIES.map((name) => [name,
    brief(summarize(table.map((p, i) => solved.main.kakera[i] - play(name, p).kakera)))])),
  divergences: solved.divergences,
  scenes: solved.scenes.map((s) => ({ ...s, diff: round(s.diff, 3) })),
};

const results = {
  main: run(table, true),
  independent: { seed: INDEPENDENT.seed, ...run(independent, false) },
  table: {
    normal: uniformity(table.flatMap((p) => p.normal)),
    fixed: uniformity(table.flatMap((p) => p.fixed)),
    fixedLength: table[0].fixed.length,
  },
  optimal,
};

fs.writeFileSync(path.join(ROOT, 'data', 'results.json'), `${JSON.stringify(results, null, 2)}\n`);
fs.writeFileSync(path.join(ROOT, 'index.html'), renderReport(results));
console.log(`wrote dice-run-occult-2026/data/results.json and index.html (best: ${results.main.ranking[0]})`);
