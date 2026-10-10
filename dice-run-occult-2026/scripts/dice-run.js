// サイコロランの盤面・各戦略の判断・1パターンの実行。副作用なし。
// 判断に使うのは現在地と手持ちの確定サイコロだけで、次に出る目は見ない。

const SIZE = 18;
const START = 0;
const KAKERA12 = 8;
const KAKERA8 = 12;
// マス番号 → 報酬。advanceは「Xマス進む」マス。credit は万単位。
const SQUARES = {
  0: { die: true },
  4: { advance: 3 },
  5: { report: 8 },
  8: { kakera: 12 },
  10: { advance: 1 },
  11: { credit: 300 },
  12: { kakera: 8 },
  15: { report: 8 },
  16: { advance: 2 },
};
const FACES = [1, 2, 3, 4, 5, 6];

function move(from, steps) {
  let pos = (from + steps) % SIZE;
  if (SQUARES[pos]?.advance) pos = (pos + SQUARES[pos].advance) % SIZE;
  const square = SQUARES[pos] ?? {};
  return { pos, kakera: square.kakera ?? 0, report: square.report ?? 0, credit: square.credit ?? 0, die: Boolean(square.die) };
}

const faceTo = (pos, hand, target) => FACES.filter((f) => hand[f] && move(pos, f).pos === target);

// スタートに止まれる目のうち、4、次に大きい目から使う
function toStart(pos, hand, keepOne) {
  const faces = faceTo(pos, hand, START).filter((f) => !(keepOne && f === 1));
  if (faces.includes(4)) return 4;
  return faces.length ? Math.max(...faces) : 0;
}

const count = (hand) => hand.reduce((a, b) => a + b, 0);

const STRATEGIES = {
  A: (pos, hand) => (hand[4] && move(pos, 4).pos === START ? 4 : 0),
  B: (pos, hand) => (hand[4] && pos === KAKERA12 ? 4 : 0),
  C: (pos, hand) => toStart(pos, hand, false),
  D: (pos, hand) => toStart(pos, hand, true),
  // Bに加え、残りの普通のサイコロで使い切れないほど持っていれば、カケラ8のマスかスタートにも使う
  E: (pos, hand, left) => STRATEGIES.B(pos, hand)
    || (count(hand) * 5 >= left ? faceTo(pos, hand, KAKERA8)[0] ?? toStart(pos, hand, false) : 0),
};

/** 普通のサイコロを振る前の判断。leftは残りの普通のサイコロの回数。使う確定サイコロの目、または0(普通のサイコロを振る)を返す。 */
function decide(name, pos, hand, left) {
  const [direct] = faceTo(pos, hand, KAKERA12);
  return direct ?? STRATEGIES[name](pos, hand, left);
}
const key = (pos, hand) => `${pos}:${hand.join('')}`;

// 手持ちだけを使い切る順番の評価: [カケラ, スタートに止まる回数, 止まった時点の残り個数の合計, 最初の目]
const planMemo = new Map();
function plan(pos, hand) {
  const n = count(hand);
  if (!n) return [0, 0, 0, 0];
  const k = key(pos, hand);
  if (planMemo.has(k)) return planMemo.get(k);
  let best = null;
  for (const f of FACES) {
    if (!hand[f]) continue;
    const step = move(pos, f);
    const rest = hand.slice();
    rest[f]--;
    const [kakera, starts, early] = plan(step.pos, rest);
    const value = [step.kakera + kakera, (step.die ? 1 : 0) + starts, (step.die ? n - 1 : 0) + early, f];
    // 先の目ほど優先。同点なら小さい目(先に調べた方)を残す
    if (!best || value[0] > best[0] || (value[0] === best[0] && (value[1] > best[1] || (value[1] === best[1] && value[2] > best[2])))) best = value;
  }
  planMemo.set(k, best);
  return best;
}

/** 普通のサイコロを振り終えた後に使う確定サイコロの目。 */
const chooseAtEnd = (pos, hand) => plan(pos, hand)[3];

/**
 * 普通のサイコロが尽きた後のカケラの期待値。chooseを省くと最大値を求める。
 * スタートで受け取る確定サイコロは1〜6が等確率。
 */
function endValue(pos, hand, choose, memo = new Map()) {
  if (!count(hand)) return 0;
  const k = key(pos, hand);
  if (memo.has(k)) return memo.get(k);
  const value = (f) => {
    const step = move(pos, f);
    const rest = hand.slice();
    rest[f]--;
    if (!step.die) return step.kakera + endValue(step.pos, rest, choose, memo);
    return step.kakera + FACES.reduce((sum, g) => {
      rest[g]++;
      const v = endValue(step.pos, rest, choose, memo);
      rest[g]--;
      return sum + v / 6;
    }, 0);
  };
  const result = choose ? value(choose(pos, hand)) : Math.max(...FACES.filter((f) => hand[f]).map(value));
  memo.set(k, result);
  return result;
}

/**
 * 1パターンを最後まで進めた集計。policyは戦略名か {decide(pos, hand, left), atEnd?, limit?}。
 * leftは残りの普通のサイコロの回数。手持ちがlimit個のときに受け取った確定サイコロは別にしておき、
 * 手持ちを使い切った後に手順3で使う。endStateは最後の消費を始める時点の状態。
 */
function play(policy, pattern, { initial = 16 } = {}) {
  const { decide: choose, atEnd = chooseAtEnd, limit = Infinity } =
    typeof policy === 'string' ? { decide: (pos, h, left) => decide(policy, pos, h, left) } : policy;
  const hand = [0, 0, 0, 0, 0, 0, 0];
  const aside = [0, 0, 0, 0, 0, 0, 0];
  let next = 0;
  const receive = () => {
    if (next >= pattern.fixed.length) throw new Error('確定サイコロの表が足りません');
    (count(hand) < limit ? hand : aside)[pattern.fixed[next++]]++;
  };
  for (let i = 0; i < initial; i++) receive();
  const total = { kakera: 0, report: 0, credit: 0, fixedUsed: 0, fixedGained: 0 };
  let pos = START;
  const advance = (steps, fixed) => {
    if (fixed) {
      hand[steps]--;
      total.fixedUsed++;
    }
    const step = move(pos, steps);
    pos = step.pos;
    total.kakera += step.kakera;
    total.report += step.report;
    total.credit += step.credit;
    if (step.die) {
      receive();
      total.fixedGained++;
    }
  };
  pattern.normal.forEach((roll, i) => {
    const left = pattern.normal.length - i;
    for (let f = choose(pos, hand, left); f; f = choose(pos, hand, left)) advance(f, true);
    advance(roll, false);
  });
  total.endState = { pos, hand: hand.slice() };
  while (count(hand)) advance(atEnd(pos, hand), true);
  while (count(hand) || count(aside)) {
    for (const f of FACES) { hand[f] += aside[f]; aside[f] = 0; }
    advance(chooseAtEnd(pos, hand), true);
  }
  return total;
}

module.exports = { SIZE, SQUARES, FACES, move, decide, chooseAtEnd, endValue, play, STRATEGIES: Object.keys(STRATEGIES) };
