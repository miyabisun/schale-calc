const test = require('node:test');
const assert = require('node:assert/strict');
const { categoryJa, fmt, signed, tierIndex, tierKeys, catOrder } = require('../../src/functions/format');

test('categoryJa: 既知カテゴリを日本語に変換', () => {
  assert.equal(categoryJa('Hat'), '帽子');
  assert.equal(categoryJa('Necklace'), 'ネックレス');
});

test('categoryJa: 未知カテゴリはそのまま返す', () => {
  assert.equal(categoryJa('Unknown'), 'Unknown');
});

test('fmt: 0 は "0"', () => {
  assert.equal(fmt(0), '0');
});

test('fmt: 末尾ゼロを削る', () => {
  assert.equal(fmt(1.0), '1');
  assert.equal(fmt(1.50, 2), '1.5');
});

test('fmt: 桁数指定 n を反映', () => {
  assert.equal(fmt(1.2345, 2), '1.23');
  assert.equal(fmt(1.2356, 3), '1.236');
});

test('signed: 正値は先頭に + を付ける', () => {
  assert.equal(signed(1.5), '+1.5');
});

test('signed: 0 と負値は + を付けない', () => {
  assert.equal(signed(0), '0');
  assert.equal(signed(-2.5), '-2.5');
});

test('tierIndex: T# 文字列を数値に変換', () => {
  assert.equal(tierIndex('T2'), 2);
  assert.equal(tierIndex('T10'), 10);
});

test('tierKeys: from-to の Tier キー配列を返す', () => {
  assert.deepEqual(tierKeys(2, 5), ['T2', 'T3', 'T4', 'T5']);
  assert.deepEqual(tierKeys(9, 10), ['T9', 'T10']);
});

test('catOrder: fulfillment 配列順を Map にする', () => {
  const f = [
    { category: 'Hat' },
    { category: 'Gloves' },
    { category: 'Shoes' },
  ];
  const m = catOrder(f);
  assert.equal(m.get('Hat'), 0);
  assert.equal(m.get('Gloves'), 1);
  assert.equal(m.get('Shoes'), 2);
});

test('catOrder: ソート比較関数として使うとカテゴリ定義順を保つ', () => {
  const f = [{ category: 'Hat' }, { category: 'Gloves' }, { category: 'Shoes' }];
  const m = catOrder(f);
  const rows = [
    { category: 'Shoes' }, { category: 'Hat' }, { category: 'Gloves' },
  ];
  rows.sort((a, b) => m.get(a.category) - m.get(b.category));
  assert.deepEqual(rows.map((r) => r.category), ['Hat', 'Gloves', 'Shoes']);
});
