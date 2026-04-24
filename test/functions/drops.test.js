const test = require('node:test');
const assert = require('node:assert/strict');
const { isDraft, expandReward, aggregateDrops } = require('../../src/functions/drops');

test('isDraft: 6桁以上の ID は設計図', () => {
  assert.equal(isDraft(101001), true);
  assert.equal(isDraft(509000), true);
});

test('isDraft: 5桁以下 (= Tier1 完成品の 4桁) は設計図ではない', () => {
  assert.equal(isDraft(1000), false);
  assert.equal(isDraft(99999), false);
});

test('expandReward: Equipment はそのまま 1 件として返す', () => {
  const r = { Type: 'Equipment', Id: 101008, Amount: 1, Chance: 0.344 };
  assert.deepEqual(expandReward(r, {}), [
    { equipId: 101008, amount: 1, chance: 0.344, source: 'equipment' },
  ]);
});

test('expandReward: Amount 省略時は 1 として扱う', () => {
  const r = { Type: 'Equipment', Id: 501000 };
  assert.equal(expandReward(r, {})[0].amount, 1);
});

test('expandReward: GachaGroup を子装備に展開し、親 chance × 子 chance を返す', () => {
  // ユーザー指摘の事例: 任務29-5 の 609007 (Necklace T7/T8 プール、親 Chance 0.3)
  const groups = {
    '609007': {
      Items: [
        { Type: 'Equipment', Id: 109006, Chance: 0.3333, AmountMin: 1, AmountMax: 1 }, // T7
        { Type: 'Equipment', Id: 109007, Chance: 0.6667, AmountMin: 1, AmountMax: 1 }, // T8
      ],
    },
  };
  const r = { Type: 'GachaGroup', Id: 609007, Amount: 1, Chance: 0.3 };
  const result = expandReward(r, groups);
  assert.equal(result.length, 2);
  assert.equal(result[0].equipId, 109006);
  assert.equal(result[0].source, 'gacha');
  // 期待値は事前計算した 5 桁の値 (0.3 × 0.3333 = 0.09999、0.3 × 0.6667 = 0.20001)。
  // 許容差は実装側の toFixed(6) と揃えて 6 桁精度 (1e-6) で判定する。
  const EPS = 1e-6;
  assert.ok(Math.abs(result[0].chance - 0.09999) < EPS, '子 chance が 0.09999 ± 1e-6');
  assert.ok(Math.abs(result[1].chance - 0.20001) < EPS, '子 chance が 0.20001 ± 1e-6');
});

test('expandReward: groups にない GachaGroup は空配列を返す', () => {
  const r = { Type: 'GachaGroup', Id: 999999, Chance: 0.1 };
  assert.deepEqual(expandReward(r, {}), []);
});

test('expandReward: GachaGroup の Items 内の非 Equipment (Item など) はスキップ', () => {
  const groups = {
    '500100': { Items: [
      { Type: 'Item', Id: 10, Chance: 0.5, AmountMin: 1, AmountMax: 1 },
      { Type: 'Equipment', Id: 101001, Chance: 0.5, AmountMin: 1, AmountMax: 1 },
    ]},
  };
  const r = { Type: 'GachaGroup', Id: 500100, Chance: 1 };
  const result = expandReward(r, groups);
  assert.equal(result.length, 1);
  assert.equal(result[0].equipId, 101001);
});

test('expandReward: AmountMin/AmountMax の平均を amount に使う', () => {
  const groups = {
    '700': { Items: [{ Type: 'Equipment', Id: 101001, Chance: 1, AmountMin: 2, AmountMax: 4 }] },
  };
  const r = { Type: 'GachaGroup', Id: 700, Chance: 1 };
  assert.equal(expandReward(r, groups)[0].amount, 3);
});

test('expandReward: Currency 等の未知 Type は空配列', () => {
  assert.deepEqual(expandReward({ Type: 'Currency', Id: 1, Amount: 100 }, {}), []);
});

test('aggregateDrops: RewardType 付きエントリ (FirstClear) は無視される', () => {
  const equipment = { 101008: { Name: 'セーラーハットの設計図', Category: 'Hat', Tier: 9 } };
  const rewards = [
    { Type: 'Equipment', Id: 101008, Amount: 1, Chance: 0.344 },
    { Type: 'Equipment', Id: 101008, Amount: 1, RewardType: 'FirstClear' },
  ];
  const drops = aggregateDrops(rewards, {}, equipment);
  assert.equal(drops.length, 1);
  assert.equal(drops[0].slots.length, 1, 'FirstClear はスロットに加算されない');
});

test('aggregateDrops: 同じ装備 ID の複数スロットを合算して期待値を出す', () => {
  const equipment = { 503000: { Name: 'シューズの万能設計図', Category: 'Shoes', Tier: 0 } };
  const rewards = [
    { Type: 'Equipment', Id: 503000, Amount: 9 },                     // 確定 9 個
    { Type: 'Equipment', Id: 503000, Amount: 1, Chance: 0.75 },       // 0.75 で +1
  ];
  const drops = aggregateDrops(rewards, {}, equipment);
  assert.equal(drops.length, 1);
  assert.equal(drops[0].expected, 9.75);
});

test('aggregateDrops: chance 1 のスロットには chance プロパティを残さない', () => {
  const equipment = { 501000: { Name: '帽子の万能設計図', Category: 'Hat', Tier: 0 } };
  const rewards = [{ Type: 'Equipment', Id: 501000, Amount: 13 }];
  const drops = aggregateDrops(rewards, {}, equipment);
  assert.deepEqual(drops[0].slots, [{ amount: 13 }]);
});

test('aggregateDrops: GachaGroup 由来のスロットには source: gacha が付く', () => {
  const equipment = { 109006: { Name: 'チェーンネックレスの設計図', Category: 'Necklace', Tier: 7 } };
  const groups = {
    '609007': { Items: [{ Type: 'Equipment', Id: 109006, Chance: 0.3333, AmountMin: 1, AmountMax: 1 }] },
  };
  const rewards = [{ Type: 'GachaGroup', Id: 609007, Chance: 0.3 }];
  const drops = aggregateDrops(rewards, groups, equipment);
  assert.equal(drops[0].slots[0].source, 'gacha');
});

test('aggregateDrops: tier 昇順 → category → id でソートされる', () => {
  const equipment = {
    101008: { Name: 'a', Category: 'Hat',     Tier: 9 },
    102008: { Name: 'b', Category: 'Gloves',  Tier: 9 },
    101009: { Name: 'c', Category: 'Hat',     Tier: 10 },
  };
  const rewards = [
    { Type: 'Equipment', Id: 101009, Amount: 1, Chance: 0.5 },
    { Type: 'Equipment', Id: 101008, Amount: 1, Chance: 0.5 },
    { Type: 'Equipment', Id: 102008, Amount: 1, Chance: 0.5 },
  ];
  const drops = aggregateDrops(rewards, {}, equipment);
  assert.deepEqual(drops.map((d) => d.id), [102008, 101008, 101009]);
});
