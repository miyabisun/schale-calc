const test = require('node:test');
const assert = require('node:assert/strict');
const { move, decide, chooseAtEnd, play, endValue } = require('./dice-run.js');

const hand = (...faces) => faces.reduce((c, f) => { c[f]++; return c; }, [0, 0, 0, 0, 0, 0, 0]);

test('進むマスは追加で進み、その先の報酬だけを受け取る', () => {
  assert.deepEqual(move(0, 4), { pos: 7, kakera: 0, report: 0, credit: 0, die: false });
  assert.deepEqual(move(9, 1), { pos: 11, kakera: 0, report: 0, credit: 300, die: false });
  assert.deepEqual(move(14, 2), { pos: 0, kakera: 0, report: 0, credit: 0, die: true });
});

test('盤面は18マスで周回し、17から2で1に止まる', () => {
  assert.equal(move(17, 2).pos, 1);
  assert.equal(move(17, 1).die, true);
  assert.equal(move(3, 5).kakera, 12);
  assert.equal(move(8, 4).kakera, 8);
  assert.equal(move(11, 4).report, 8);
});

test('前提: カケラ12のマスに直接止まれる確定サイコロを使う', () => {
  for (const name of ['A', 'B', 'C', 'D']) {
    assert.equal(decide(name, 7, hand(1, 4)), 1);
    assert.equal(decide(name, 2, hand(6)), 6);
    assert.equal(decide(name, 0, hand(1, 2, 3, 5, 6)), 0);
  }
});

test('A: 4は12か14からスタートに止まるときだけ使う', () => {
  assert.equal(decide('A', 12, hand(4, 6)), 4);
  assert.equal(decide('A', 14, hand(4)), 4);
  assert.equal(decide('A', 13, hand(4, 5)), 0);
  assert.equal(decide('A', 8, hand(4)), 0);
});

test('B: 4はカケラ12のマスで使う', () => {
  assert.equal(decide('B', 8, hand(4)), 4);
  assert.equal(decide('B', 12, hand(4)), 0);
});

test('C: スタートに止まれる確定サイコロを使い、4、次に大きい目を優先する', () => {
  assert.equal(decide('C', 12, hand(4, 6)), 4);
  assert.equal(decide('C', 15, hand(1, 3)), 3);
  assert.equal(decide('C', 17, hand(1)), 1);
  assert.equal(decide('C', 11, hand(5)), 5);
  assert.equal(decide('C', 8, hand(4)), 0);
});

test('D: Cと同じだが1はスタートのために使わない', () => {
  assert.equal(decide('D', 17, hand(1)), 0);
  assert.equal(decide('D', 15, hand(1, 3)), 3);
  assert.equal(decide('D', 7, hand(1)), 1);
});

test('最後の消費: 手持ちで取れるカケラが最も多い順番の最初の1個を使う', () => {
  assert.equal(chooseAtEnd(3, hand(4, 5)), 5);
  // 6から: 6→12(8個)、続けて4→16→0。4を先に使うと11へ進み、6では17に止まる
  assert.equal(chooseAtEnd(6, hand(4, 6)), 6);
});

test('最後の消費: カケラが同じなら、スタートに早く止まる順番を選ぶ', () => {
  // 11から2→13,5→0 と 5→0,2 はどちらもカケラ0・スタート1回。先にスタートへ止まる5を使う
  assert.equal(chooseAtEnd(11, hand(2, 5)), 5);
});

test('最後の消費: すべて同じなら小さい目から使う', () => {
  assert.equal(chooseAtEnd(0, hand(1, 2)), 1);
});

test('play: 普通のサイコロと確定サイコロの判断を順に適用する', () => {
  // B, 開始時の確定サイコロ[5,4]。3→3、5で8(12個)、4で12(8個)、1→13
  const { endState, ...result } = play('B', { normal: [3, 1], fixed: [5, 4] }, { initial: 2 });
  assert.deepEqual(result, { kakera: 20, report: 0, credit: 0, fixedUsed: 2, fixedGained: 0 });
  assert.deepEqual(endState, { pos: 13, hand: [0, 0, 0, 0, 0, 0, 0] });
});

test('play: スタートに止まると表の次の確定サイコロを受け取り、最後に使い切る', () => {
  // A, 開始時[4]。6→6、6→12(8個)、Aで4→16→0で6を受け取る。1→1、最後に6→7
  const { endState, ...result } = play('A', { normal: [6, 6, 1], fixed: [4, 6] }, { initial: 1 });
  assert.deepEqual(result, { kakera: 8, report: 0, credit: 0, fixedUsed: 2, fixedGained: 1 });
  assert.deepEqual(endState, { pos: 1, hand: [0, 0, 0, 0, 0, 0, 1] });
});

test('play: 確定サイコロの表が足りなければ止める', () => {
  assert.throws(() => play('A', { normal: [6, 6, 1], fixed: [4] }, { initial: 1 }), /確定サイコロの表/);
});

test('endValue: 方針ごとの最後の消費の期待値を厳密に求める', () => {
  assert.equal(endValue(3, hand(5)), 12);
  assert.equal(endValue(3, hand(4, 5)), 20);
  // 17から1で0に止まり、ランダムな1個を0から使う。0+1..6でカケラのマスには届かない
  assert.equal(endValue(17, hand(1)), 0);
  // 2から6でカケラ12。最大値は方針の値以上
  assert.ok(endValue(11, hand(2, 5)) >= endValue(11, hand(2, 5), chooseAtEnd));
});
