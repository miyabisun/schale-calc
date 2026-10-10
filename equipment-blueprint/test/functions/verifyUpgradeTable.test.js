const test = require('node:test');
const assert = require('node:assert/strict');
const { verifyUpgradeTable } = require('../../src/functions/verifyUpgradeTable');

// 最小の整合データ (cumulative T2 = 5+10 = 15、credits も足し算)
function minimalConsistentData() {
  return {
    tier_upgrade: [
      { materials: { T2: 5 },         tier_credits: 100, level_credits: 200 },
      { materials: { T2: 10, T3: 7 }, tier_credits: 300, level_credits: 400 },
    ],
    cumulative_to_T10: {
      materials: { T2: 15, T3: 7 },
      tier_credits: 400,
      level_credits: 600,
    },
    wildcard_rate: { T2: 2, T3: 3 },
    cumulative_wildcards_if_all_substituted: {
      T2: 30,    // 15 × 2
      T3: 21,    //  7 × 3
      total: 51,
    },
  };
}

test('整合データなら ok: true、problems は空', () => {
  const result = verifyUpgradeTable(minimalConsistentData());
  assert.equal(result.ok, true);
  assert.deepEqual(result.problems, []);
});

test('summary に累計値が入る', () => {
  const result = verifyUpgradeTable(minimalConsistentData());
  assert.equal(result.summary.cumMaterials.T2, 15);
  assert.equal(result.summary.cumTier, 400);
  assert.equal(result.summary.cumLevel, 600);
  assert.equal(result.summary.wildcardTotal, 51);
});

test('cumulative_to_T10.materials が一致しなければ problem を記録', () => {
  const data = minimalConsistentData();
  data.cumulative_to_T10.materials.T2 = 99;
  const result = verifyUpgradeTable(data);
  assert.equal(result.ok, false);
  assert.match(result.problems[0], /cumulative\.materials\.T2: got 15, expected 99/);
});

test('cumulative.tier_credits が一致しなければ problem を記録', () => {
  const data = minimalConsistentData();
  data.cumulative_to_T10.tier_credits = 99999;
  const result = verifyUpgradeTable(data);
  assert.ok(result.problems.some((p) => p.startsWith('cumulative.tier_credits:')));
});

test('cumulative_wildcards_if_all_substituted の Tier 値が一致しなければ problem を記録', () => {
  const data = minimalConsistentData();
  data.cumulative_wildcards_if_all_substituted.T2 = 999;
  const result = verifyUpgradeTable(data);
  assert.ok(result.problems.some((p) => p.startsWith('wildcards.T2:')));
});

test('wildcards.total が一致しなければ problem を記録', () => {
  const data = minimalConsistentData();
  data.cumulative_wildcards_if_all_substituted.total = 0;
  const result = verifyUpgradeTable(data);
  assert.ok(result.problems.some((p) => p.startsWith('wildcards.total:')));
});

test('実プロジェクトの equipment-upgrade.yaml は通る (回帰検出)', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const yaml = require('js-yaml');
  const data = yaml.load(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'equipment-upgrade.yaml'), 'utf8'));
  const result = verifyUpgradeTable(data);
  assert.equal(result.ok, true, `should be consistent, but got problems: ${result.problems.join(', ')}`);
});
