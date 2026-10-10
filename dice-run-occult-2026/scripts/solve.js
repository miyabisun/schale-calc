// 最適な使い方を求め、500パターンの表で走らせた結果を data/optimal.json に書き出す。数分かかる。
// 手持ちの上限を広げながら期待値を求め、最後の上限の判断で走らせる。

const fs = require('node:fs');
const path = require('node:path');
const { play, decide } = require('./dice-run.js');
const { solve, actionValues, best, expectedStart, policy, tallyScenes } = require('./optimal.js');

const ROOT = path.join(__dirname, '..');
const LIMITS = [16, 18, 20];
const ROLLS = 200;
const INITIAL = 16;

const digits = (s) => [...s].map(Number);
const table = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'table.json'), 'utf8'))
  .patterns.map((p) => ({ normal: digits(p.normal), fixed: digits(p.fixed) }));

const limits = [];
let solution;
for (const limit of LIMITS) {
  const started = Date.now();
  solution = null;
  solution = solve({ limit, rolls: ROLLS });
  limits.push({ limit, expected: expectedStart(solution, INITIAL) });
  console.log(`limit ${limit}: ${limits.at(-1).expected} (${((Date.now() - started) / 1000).toFixed(0)}s)`);
}

// 最適な使い方で走らせ、Bと判断が分かれた場面を記録する
const records = [];
const optimal = policy(solution);
const watched = {
  ...optimal,
  decide: (pos, hand, left) => {
    const a = optimal.decide(pos, hand, left);
    const b = decide('B', pos, hand, left);
    const q = actionValues(solution, left, pos, hand);
    if (q[a] - q[b] > 1e-9) records.push({ pos, hand: hand.slice(), optimal: a, b, diff: q[a] - q[b] });
    return a;
  },
};
const runs = table.map((p) => play(watched, p));
const pick = (k) => runs.map((r) => r[k]);

const result = {
  rolls: ROLLS,
  initial: INITIAL,
  limits,
  main: { kakera: pick('kakera'), report: pick('report'), credit: pick('credit') },
  divergences: records.length,
  // 残り1回からこの回数まで、最適な使い方はその場面で同じ判断をする
  scenes: tallyScenes(records, 5).map((s) => {
    let upTo = 0;
    while (upTo < ROLLS && best(solution, upTo + 1, s.pos, s.hand) === s.optimal) upTo++;
    return { ...s, upTo };
  }),
};
fs.writeFileSync(path.join(ROOT, 'data', 'optimal.json'), `${JSON.stringify(result)}\n`);
console.log(`wrote dice-run-occult-2026/data/optimal.json (${records.length} divergences)`);
