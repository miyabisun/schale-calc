#!/usr/bin/env node
// 任務 Normal 2倍期間の最小周回プランを LP で求めて data/grind-plan.yaml に書き出す。
//
// 入力:
//   data/campaign-normal-rewards.yaml … ステージ別の装備期待ドロップ数
//   data/equipment-upgrade.yaml        … Tier アップ必要量と万能設計図レート
//   data/demand.yaml                   … 育成目標 (active プリセット)
//
// 純粋関数の実体は src/functions/plan.js にある。

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const solver = require('javascript-lp-solver');
const { tierKeys } = require('../src/functions/format');
const {
  requiredMaterials,
  buildLpModel,
  integerizeLpY,
  adjustClearsForIntegerY,
  buildPlan,
  buildFulfillment,
  buildWildcardLedger,
} = require('../src/functions/plan');

const DATA = path.join(__dirname, '..', 'data');
const loadYaml = (f) => yaml.load(fs.readFileSync(path.join(DATA, f), 'utf8'));
const OUT_PATH = path.join(DATA, 'grind-plan.yaml');

const MULTIPLIER = 2;     // Normal 2倍キャンペーン
const AP_PER_CLEAR = 10;

const stagesYaml = loadYaml('campaign-normal-rewards.yaml');
const upgradeYaml = loadYaml('equipment-upgrade.yaml');
const demandYaml = loadYaml('demand.yaml');

const preset = demandYaml.presets[demandYaml.active];
if (!preset) throw new Error(`preset "${demandYaml.active}" not found`);

const cumulative = upgradeYaml.cumulative_to_T10.materials;
const rate = upgradeYaml.wildcard_rate;
const TIERS = tierKeys(2, preset.target_tier);
const stages = stagesYaml.stages;

const required = requiredMaterials(preset.demand, cumulative, TIERS);

// LP を解く
const model = buildLpModel({
  stages, required, rate, tierKeys: TIERS, multiplier: MULTIPLIER, demand: preset.demand,
});
const result = solver.Solve(model);
if (!result.feasible) {
  console.error('LP infeasible.');
  console.error(result);
  process.exit(1);
}

// y を切り上げ整数化 + 万能設計図不足分を周回数で補填
const yInt = integerizeLpY(result, preset.demand, TIERS);
const xCont = {};
for (let i = 0; i < stages.length; i++) xCont[i] = result[`x_${i}`] ?? 0;
const xAdjusted = adjustClearsForIntegerY({
  xCont, yInt, stages, demand: preset.demand, rate, tierKeys: TIERS, multiplier: MULTIPLIER,
});

const plan = buildPlan({ stages, xAdjusted, xCont });
const totalClears = plan.reduce((a, p) => a + p.clears, 0);
const totalAp = totalClears * AP_PER_CLEAR;

const fulfillment = buildFulfillment({
  plan, stages, yInt, required, demand: preset.demand, tierKeys: TIERS, multiplier: MULTIPLIER,
});
const wildcardLedger = buildWildcardLedger({
  plan, stages, yInt, demand: preset.demand, rate, tierKeys: TIERS, multiplier: MULTIPLIER,
});

const output = {
  generated_at: new Date().toISOString(),
  preset: demandYaml.active,
  description: preset.description,
  target_tier: preset.target_tier,
  demand: preset.demand,
  multiplier: MULTIPLIER,
  summary: { total_clears: totalClears, total_ap: totalAp },
  plan,
  fulfillment,
  wildcard_ledger: wildcardLedger,
};

fs.writeFileSync(OUT_PATH, yaml.dump(output, { lineWidth: 140, noRefs: true, quotingType: '"' }));
console.log(`wrote ${path.relative(process.cwd(), OUT_PATH)}`);
console.log(`  周回: ${totalClears} 回 / AP: ${totalAp.toLocaleString()} / ステージ: ${plan.length}`);
