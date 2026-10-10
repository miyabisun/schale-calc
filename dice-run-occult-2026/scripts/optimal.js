// 未来視なしで神名のカケラの期待値が最大になる使い方を、残り回数の少ない方から逆算して求める。副作用なし。
// 状態は「残りの普通のサイコロの回数・現在地・手持ちの目ごとの個数」。手持ちは合計 limit 個までとし、
// 上限の個数を持っているときに受け取った確定サイコロは捨てる。捨てる遊び方は実際にも取れるので、
// 求めた値は真の最適値の下限になる。

const { SIZE, FACES, move } = require('./dice-run.js');

const MOVES = Array.from({ length: SIZE }, (_, pos) => [null, ...FACES.map((f) => move(pos, f))]);
const EPS = 1e-9;

function handSpace(limit) {
  // 手持ちを合計の個数の少ない順に並べて番号を振る
  const hands = [];
  const walk = (hand, f, left) => {
    if (f > 6) { if (!left) hands.push(hand.slice()); return; }
    for (let c = left; c >= 0; c--) { hand[f] = c; walk(hand, f + 1, left - c); }
  };
  for (let n = 0; n <= limit; n++) walk([0, 0, 0, 0, 0, 0, 0], 1, n);
  const size = hands.length;
  const key = (hand) => hand.reduce((a, c) => a * (limit + 1) + c, 0);
  const lookup = new Map(hands.map((h, i) => [key(h), i]));
  const total = Uint8Array.from(hands, (h) => h.reduce((a, b) => a + b, 0));
  const index = (hand) => {
    const i = lookup.get(key(hand));
    if (i === undefined) throw new Error(`手持ちが上限${limit}個を超えています`);
    return i;
  };
  // 目fを1個使った後・目gを1個受け取った後の手持ちの番号。上限の個数なら受け取った目を捨てる
  const useTable = new Int32Array(size * 7).fill(-1);
  const addTable = new Int32Array(size * 7);
  hands.forEach((h, i) => {
    for (const f of FACES) {
      const next = h.slice();
      if (h[f]) { next[f]--; useTable[i * 7 + f] = index(next); next[f]++; }
      next[f]++;
      addTable[i * 7 + f] = total[i] < limit ? index(next) : i;
    }
  });
  return { limit, size, total, index, useTable, addTable };
}

// 状態(r, pos, idx)で各行動を取ったときの期待値。行動0は普通のサイコロ、1〜6はその目の確定サイコロ。
function actionValuesAt(space, layers, r, pos, idx, out) {
  const { size, useTable, addTable } = space;
  const cur = layers[r];
  const moves = MOVES[pos];
  // スタートに止まって目gを受け取る(マス0の行に並ぶ)
  const receive = (layer, i) => {
    let s = 0;
    for (let g = 1; g <= 6; g++) s += layer[addTable[i * 7 + g]];
    return s / 6;
  };
  for (let f = 1; f <= 6; f++) {
    const rest = useTable[idx * 7 + f];
    if (rest < 0) { out[f] = NaN; continue; }
    const m = moves[f];
    out[f] = m.kakera + (m.die ? receive(cur, rest) : cur[m.pos * size + rest]);
  }
  if (r === 0) { out[0] = NaN; return out; }
  const prev = layers[r - 1];
  let s = 0;
  for (let f = 1; f <= 6; f++) {
    const m = moves[f];
    s += m.kakera + (m.die ? receive(prev, idx) : prev[m.pos * size + idx]);
  }
  out[0] = s / 6;
  return out;
}

// 期待値が最大の行動。同点なら普通のサイコロ、次に小さい目を選ぶ
function argmax(q) {
  let max = -Infinity;
  for (const v of q) if (v > max) max = v;
  return q.findIndex((v) => v >= max - EPS);
}

/** 残り0〜rolls回のすべての状態の期待値を求める。layers[r][pos * size + idx]。 */
function solve({ limit, rolls }) {
  const space = handSpace(limit);
  const layers = [];
  const q = new Float64Array(7);
  for (let r = 0; r <= rolls; r++) {
    const cur = new Float64Array(SIZE * space.size);
    layers.push(cur);
    // スタート(マス0)から確定サイコロでスタートへは戻れないので、同じ個数の中ではマス0を先に求める
    const fill = (idx, pos) => {
      if (r === 0 && idx === 0) return;
      actionValuesAt(space, layers, r, pos, idx, q);
      let max = -Infinity;
      for (const v of q) if (v > max) max = v;
      cur[pos * space.size + idx] = max;
    };
    for (let start = 0; start < space.size;) {
      let end = start;
      while (end < space.size && space.total[end] === space.total[start]) end++;
      for (let idx = start; idx < end; idx++) fill(idx, 0);
      for (let pos = 1; pos < SIZE; pos++) for (let idx = start; idx < end; idx++) fill(idx, pos);
      start = end;
    }
  }
  return { space, layers, rolls };
}

const value = ({ space, layers }, r, pos, hand) => layers[r][pos * space.size + space.index(hand)];

/** 各行動の期待値の配列。使えない目はNaN。 */
const actionValues = ({ space, layers }, r, pos, hand) =>
  Array.from(actionValuesAt(space, layers, r, pos, space.index(hand), new Float64Array(7)));

/** 期待値が最大の行動。0は普通のサイコロを振る。 */
const best = (solution, r, pos, hand) => argmax(actionValues(solution, r, pos, hand));

/** スタートで initial 個の確定サイコロ(1〜6が等確率)を受け取ったときの期待値。 */
function expectedStart(solution, initial) {
  const hand = [0, 0, 0, 0, 0, 0, 0];
  // 目ごとの個数の組を列挙し、多項分布の確率で重み付けする
  const fact = [1];
  for (let i = 1; i <= initial; i++) fact[i] = fact[i - 1] * i;
  let sum = 0;
  const walk = (f, left) => {
    if (f === 6) {
      hand[6] = left;
      const ways = fact[initial] / hand.slice(1).reduce((a, c) => a * fact[c], 1);
      sum += (ways / 6 ** initial) * value(solution, solution.rolls, 0, hand);
      return;
    }
    for (let c = 0; c <= left; c++) { hand[f] = c; walk(f + 1, left - c); }
  };
  walk(1, initial);
  return sum;
}

/** play に渡す判断。上限を超えて受け取った確定サイコロは別にしておき、最後に使い切る。 */
const policy = (solution) => ({
  limit: solution.space.limit,
  decide: (pos, hand, left) => best(solution, left, pos, hand),
  atEnd: (pos, hand) => best(solution, 0, pos, hand),
});

/** 判断が分かれた記録 {pos, hand, optimal, b, diff} を現在地と手持ちで数え、多い順に n 件返す。 */
function tallyScenes(records, n) {
  const scenes = new Map();
  for (const { pos, hand, optimal, b, diff } of records) {
    const key = `${pos}:${hand.join('')}:${optimal}:${b}`;
    const s = scenes.get(key) ?? { pos, hand, optimal, b, count: 0, sum: 0 };
    s.count++;
    s.sum += diff;
    scenes.set(key, s);
  }
  return [...scenes.values()]
    .sort((x, y) => y.count - x.count || y.sum - x.sum)
    .slice(0, n)
    .map(({ sum, ...s }) => ({ ...s, diff: sum / s.count }));
}

module.exports = { solve, value, actionValues, best, expectedStart, policy, tallyScenes };
