#!/usr/bin/env node
// data/equipment-upgrade.yaml の転記ミス検出。
// 各行の合計・累計・万能設計図換算が Wiki 表と一致するか確認する。

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const data = yaml.load(fs.readFileSync(path.join(__dirname, '..', 'data', 'equipment-upgrade.yaml'), 'utf8'));

const problems = [];
function expect(label, actual, expected) {
  if (actual !== expected) problems.push(`${label}: got ${actual}, expected ${expected}`);
}

// 1) tier_upgrade から累計を算出して cumulative_to_T10 と比較
const cumMaterials = {};
let cumTier = 0;
let cumLevel = 0;
for (const step of data.tier_upgrade) {
  for (const [tier, n] of Object.entries(step.materials)) {
    cumMaterials[tier] = (cumMaterials[tier] ?? 0) + n;
  }
  cumTier += step.tier_credits;
  cumLevel += step.level_credits;
}
for (const [tier, expected] of Object.entries(data.cumulative_to_T10.materials)) {
  expect(`cumulative.materials.${tier}`, cumMaterials[tier] ?? 0, expected);
}
expect('cumulative.tier_credits', cumTier, data.cumulative_to_T10.tier_credits);
expect('cumulative.level_credits', cumLevel, data.cumulative_to_T10.level_credits);

// 2) cumulative × wildcard_rate が cumulative_wildcards_if_all_substituted と一致
let wildcardTotal = 0;
for (const [tier, rate] of Object.entries(data.wildcard_rate)) {
  const need = (cumMaterials[tier] ?? 0) * rate;
  const recorded = data.cumulative_wildcards_if_all_substituted[tier];
  expect(`wildcards.${tier}`, need, recorded);
  wildcardTotal += need;
}
expect('wildcards.total', wildcardTotal, data.cumulative_wildcards_if_all_substituted.total);

// 結果出力
if (problems.length === 0) {
  console.log('OK: equipment-upgrade.yaml passes all consistency checks.');
  console.log(`  cumulative T2..T10 materials: ${Object.entries(cumMaterials).filter(([k]) => k !== 'T1').map(([k, v]) => `${k}=${v}`).join(', ')}`);
  console.log(`  cumulative credits: tier=${cumTier.toLocaleString()}, level=${cumLevel.toLocaleString()}`);
  console.log(`  wildcard total (all substituted): ${wildcardTotal.toLocaleString()}`);
} else {
  console.error('FAIL:');
  for (const p of problems) console.error('  -', p);
  process.exit(1);
}
