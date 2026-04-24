const test = require('node:test');
const assert = require('node:assert/strict');
const {
  requiredMaterials,
  buildLpModel,
  integerizeLpY,
  wildcardSupplyAt,
  topWildcardStages,
  adjustClearsForIntegerY,
  buildPlan,
  buildFulfillment,
  buildWildcardLedger,
} = require('../../src/functions/plan');

const TIER_KEYS = ['T2', 'T3', 'T4'];
const CUMULATIVE = { T2: 40, T3: 45, T4: 50 };
const RATE = { T2: 2, T3: 3, T4: 5 };

test('requiredMaterials: demand × cumulative で必要量テーブルを作る', () => {
  const required = requiredMaterials({ Hat: 3, Gloves: 2 }, CUMULATIVE, TIER_KEYS);
  assert.equal(required.Hat.T2, 120);   // 3 × 40
  assert.equal(required.Hat.T3, 135);   // 3 × 45
  assert.equal(required.Gloves.T4, 100); // 2 × 50
});

test('buildLpModel: 制約と変数が demand × tier 数だけ生成される', () => {
  const stages = [
    { label: 'S1', drops: [{ category: 'Hat', tier: 2, expected: 1 }] },
  ];
  const required = { Hat: { T2: 10, T3: 0, T4: 0 } };
  const model = buildLpModel({
    stages, required, rate: RATE, tierKeys: TIER_KEYS,
    multiplier: 2, demand: { Hat: 1 },
  });
  // demand_Hat_T2..T4 + wildcard_Hat = 4 制約
  assert.equal(Object.keys(model.constraints).length, 4);
  assert.equal(model.constraints.demand_Hat_T2.min, 10);
  // x_0 と y_Hat_T2..T4 = 4 変数
  assert.equal(Object.keys(model.variables).length, 4);
  // ステージドロップ係数 (multiplier * expected = 2 * 1 = 2)
  assert.equal(model.variables.x_0.demand_Hat_T2, 2);
});

test('buildLpModel: y 変数に退化解よけの totalClears ペナルティが rate 比例で入る', () => {
  // y が目的関数に効かないと LP が退化 (Σx 同値の解空間で任意の y を選ぶ) する。
  // y_cat_tier.totalClears = ε × rate[tk] で、1次目的 (整数周回) を歪めずに 2 次目的
  // (万能消費最小) を入れる近似 lexicographic 最適化。
  const stages = [{ label: 'S1', drops: [] }];
  const required = { Hat: { T2: 0, T3: 0, T4: 0 } };
  const model = buildLpModel({
    stages, required, rate: RATE, tierKeys: TIER_KEYS,
    multiplier: 1, demand: { Hat: 1 },
  });
  const p2 = model.variables.y_Hat_T2.totalClears;
  const p3 = model.variables.y_Hat_T3.totalClears;
  const p4 = model.variables.y_Hat_T4.totalClears;
  // 1次目的 (整数1刻み) を歪めない程度に小さい
  assert.ok(p2 > 0 && p2 < 1e-3, `小さい正値のはず: ${p2}`);
  // rate に比例 (T3 の係数は T2 の rate比だけ大きい)
  assert.equal(p3 / p2, RATE.T3 / RATE.T2);
  assert.equal(p4 / p2, RATE.T4 / RATE.T2);
});

test('buildLpModel: 万能設計図 (Tier 0) のドロップは wildcard 制約に入る', () => {
  const stages = [
    { label: 'S1', drops: [{ category: 'Hat', tier: 0, expected: 5 }] },
  ];
  const required = { Hat: { T2: 0, T3: 0, T4: 0 } };
  const model = buildLpModel({
    stages, required, rate: RATE, tierKeys: TIER_KEYS,
    multiplier: 2, demand: { Hat: 1 },
  });
  // wildcard_Hat の係数 = multiplier * expected = 10
  assert.equal(model.variables.x_0.wildcard_Hat, 10);
});

test('integerizeLpY: 連続値を切り上げ整数化', () => {
  const result = { y_Hat_T2: 12.3, y_Hat_T3: 0, y_Hat_T4: 1e-12 };
  const yInt = integerizeLpY(result, { Hat: 1 }, TIER_KEYS);
  assert.equal(yInt.Hat.T2, 13);
  assert.equal(yInt.Hat.T3, 0);
  assert.equal(yInt.Hat.T4, 0, '1e-12 は誤差として 0 扱い');
});

test('integerizeLpY: 解に y キー無しなら 0', () => {
  const yInt = integerizeLpY({}, { Hat: 1 }, TIER_KEYS);
  assert.equal(yInt.Hat.T2, 0);
});

test('wildcardSupplyAt: ステージ周回数 × 期待値 × multiplier の合計', () => {
  const stages = [
    { drops: [{ category: 'Hat', tier: 0, expected: 5 }] },
    { drops: [{ category: 'Hat', tier: 0, expected: 2 }] },
  ];
  // 2 周 × (5 + 2) = 14、multiplier 2 → 28
  assert.equal(wildcardSupplyAt('Hat', { 0: 1, 1: 1 }, stages, 2), 14);
});

test('topWildcardStages: 期待値最大のステージ index と perClear を返す', () => {
  const stages = [
    { drops: [{ category: 'Hat', tier: 0, expected: 3 }] },
    { drops: [{ category: 'Hat', tier: 0, expected: 7 }] }, // 最大
    { drops: [{ category: 'Hat', tier: 0, expected: 5 }] },
  ];
  const top = topWildcardStages(stages, { Hat: 1 }, 2);
  assert.equal(top.Hat.idx, 1);
  assert.equal(top.Hat.perClear, 14); // 2 × 7
});

test('adjustClearsForIntegerY: 万能消費過多なら最有力ステージの周回を増やす', () => {
  const stages = [
    { drops: [{ category: 'Hat', tier: 0, expected: 10 }] },
  ];
  // 連続解では x_0 = 1 でちょうど足りる想定だが、整数化 y で消費が膨らむケース
  const xCont = { 0: 1.0 };
  const yInt = { Hat: { T2: 20, T3: 0, T4: 0 } }; // 消費 20 × rate(2) = 40
  // supply at xCont = 2 * 10 * 1 = 20。不足 20 → 1 周追加で +20 → 計 40 でちょうど
  const adjusted = adjustClearsForIntegerY({
    xCont, yInt, stages, demand: { Hat: 1 },
    rate: RATE, tierKeys: TIER_KEYS, multiplier: 2,
  });
  assert.equal(adjusted[0], 2.0);
});

test('buildPlan: ceil 後の周回数を area/stage_num 順に並べる', () => {
  const stages = [
    { label: 'S2', area: 10, stage: 2, drops: [] },
    { label: 'S1', area: 10, stage: 1, drops: [] },
    { label: 'S3', area: 5,  stage: 3, drops: [] },
  ];
  const xAdjusted = { 0: 5.2, 1: 3.0, 2: 0 };  // S3 は周回ゼロで除外
  const xCont = { 0: 5.2, 1: 3.0, 2: 0 };
  const plan = buildPlan({ stages, xAdjusted, xCont });
  assert.deepEqual(plan.map((p) => p.stage), ['S1', 'S2']);
  assert.equal(plan[0].area, 10);
  assert.equal(plan[0].clears, 3);  // S1
  assert.equal(plan[1].clears, 6);  // S2 ceil(5.2) = 6
});

test('buildFulfillment: drop_expected と wildcard_converted を合算して obtained / surplus を出す', () => {
  const stages = [
    { label: 'S1', drops: [{ category: 'Hat', tier: 2, expected: 5 }] },
  ];
  const plan = [{ stage: 'S1', clears: 10 }];
  const yInt = { Hat: { T2: 50, T3: 0, T4: 0 } };
  const required = { Hat: { T2: 100, T3: 0, T4: 0 } };
  const ff = buildFulfillment({
    plan, stages, yInt, required, demand: { Hat: 1 },
    tierKeys: TIER_KEYS, multiplier: 2,
  });
  // drop_expected = 2 * 5 * 10 = 100, wildcard_converted = 50 → obtained = 150, surplus = +50
  assert.equal(ff.length, 1);
  assert.equal(ff[0].tiers.T2.drop_expected, 100);
  assert.equal(ff[0].tiers.T2.wildcard_converted, 50);
  assert.equal(ff[0].tiers.T2.obtained, 150);
  assert.equal(ff[0].tiers.T2.surplus, 50);
  assert.equal(ff[0].total_required, 100);
});

test('buildWildcardLedger: supply, consumed, surplus, used_for を返す', () => {
  const stages = [
    { label: 'S1', drops: [{ category: 'Hat', tier: 0, expected: 7 }] },
  ];
  const plan = [{ stage: 'S1', clears: 5 }];
  const yInt = { Hat: { T2: 10, T3: 0, T4: 0 } }; // 消費 10 × 2 = 20
  const ledger = buildWildcardLedger({
    plan, stages, yInt, demand: { Hat: 1 },
    rate: RATE, tierKeys: TIER_KEYS, multiplier: 2,
  });
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0].supply, 70);   // 2 * 7 * 5
  assert.equal(ledger[0].consumed, 20);
  assert.equal(ledger[0].surplus, 50);
  assert.deepEqual(ledger[0].used_for, { T2: 10 });
});

test('buildWildcardLedger: y が 0 の Tier は used_for に出ない', () => {
  const stages = [];
  const plan = [];
  const yInt = { Hat: { T2: 5, T3: 0, T4: 3 } };
  const ledger = buildWildcardLedger({
    plan, stages, yInt, demand: { Hat: 1 },
    rate: RATE, tierKeys: TIER_KEYS, multiplier: 2,
  });
  assert.deepEqual(Object.keys(ledger[0].used_for), ['T2', 'T4']);
});
