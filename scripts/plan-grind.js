#!/usr/bin/env node
// 任務 Normal 2倍期間の最小周回プランを LP で求めて data/grind-plan.yaml に書き出す。
//
// 入力:
//   data/campaign-normal-rewards.yaml … ステージ別の装備期待ドロップ数
//   data/equipment-upgrade.yaml        … Tier アップ必要量と万能設計図レート
//   data/demand.yaml                   … 育成目標 (active プリセット)

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const solver = require('javascript-lp-solver');

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

const cumulative = upgradeYaml.cumulative_to_T10.materials; // { T1:1, T2:40, ... }
const rate = upgradeYaml.wildcard_rate;                     // { T2:2, T3:3, ... }
const tierKeys = [];
for (let t = 2; t <= preset.target_tier; t++) tierKeys.push(`T${t}`);

// required[category][Tt] = demand[category] * cumulative[Tt]
const required = {};
for (const [cat, n] of Object.entries(preset.demand)) {
  required[cat] = {};
  for (const tk of tierKeys) required[cat][tk] = n * cumulative[tk];
}

// --- LP モデル ---
// 変数: x_<stageIdx> (周回), y_<cat>_<tier> (万能→Tier設計図変換)
// 制約:
//   demand_<cat>_<tier>: M·Σx·E[s][cat][tier] + y[cat][tier] ≥ required[cat][tier]
//   wildcard_<cat>      : M·Σx·W[s][cat] - Σ_t y[cat][tier]·rate[tier] ≥ 0
// 目的: Σ x_s 最小化
const model = { optimize: 'totalClears', opType: 'min', constraints: {}, variables: {} };

for (const cat of Object.keys(preset.demand)) {
  for (const tk of tierKeys) model.constraints[`demand_${cat}_${tk}`] = { min: required[cat][tk] };
  model.constraints[`wildcard_${cat}`] = { min: 0 };
}

const stageList = stagesYaml.stages;
for (let i = 0; i < stageList.length; i++) {
  const s = stageList[i];
  const coef = { totalClears: 1 };
  for (const d of s.drops) {
    if (!required[d.category]) continue;
    if (d.tier === 0) {
      coef[`wildcard_${d.category}`] = (coef[`wildcard_${d.category}`] ?? 0) + MULTIPLIER * d.expected;
    } else if (d.tier >= 2 && d.tier <= preset.target_tier) {
      const key = `demand_${d.category}_T${d.tier}`;
      coef[key] = (coef[key] ?? 0) + MULTIPLIER * d.expected;
    }
  }
  model.variables[`x_${i}`] = coef;
}

for (const cat of Object.keys(preset.demand)) {
  for (const tk of tierKeys) {
    model.variables[`y_${cat}_${tk}`] = {
      [`demand_${cat}_${tk}`]: 1,
      [`wildcard_${cat}`]: -rate[tk],
    };
  }
}

// --- 解く (連続 LP) ---
// 万能設計図 → 通常設計図の交換は整数単位でしか行えないため、
// 解いた後に y_{c,t} を切り上げて整数化する。供給が不足する場合に備えて
// 一部ステージの周回数を追加する。
const result = solver.Solve(model);
if (!result.feasible) {
  console.error('LP infeasible.');
  console.error(result);
  process.exit(1);
}

// y を切り上げで整数化
const yInt = {};
for (const cat of Object.keys(preset.demand)) {
  yInt[cat] = {};
  for (const tk of tierKeys) {
    const raw = result[`y_${cat}_${tk}`] ?? 0;
    yInt[cat][tk] = raw > 1e-9 ? Math.ceil(raw) : 0;
  }
}
// 連続解から得た x_s の値を取り出し（ceil 前の段階で供給・消費を確認）
const xCont = {};
for (let i = 0; i < stageList.length; i++) xCont[i] = result[`x_${i}`] ?? 0;

// 整数化した y で各カテゴリの万能消費量を算出し、連続 x での供給と比較して
// 不足があれば、そのカテゴリの万能設計図が最も多く出るステージの周回を追加する
function wildcardSupplyAt(cat, xMap) {
  let s = 0;
  for (let i = 0; i < stageList.length; i++) {
    const st = stageList[i];
    for (const d of st.drops) {
      if (d.tier === 0 && d.category === cat) s += MULTIPLIER * d.expected * (xMap[i] ?? 0);
    }
  }
  return s;
}
// 万能設計図が一番多く出るステージを cat ごとに事前算出（不足補填用）
const topWildcardStage = {};
for (const cat of Object.keys(preset.demand)) {
  let best = -1, bestE = 0;
  for (let i = 0; i < stageList.length; i++) {
    for (const d of stageList[i].drops) {
      if (d.tier === 0 && d.category === cat && d.expected > bestE) {
        bestE = d.expected;
        best = i;
      }
    }
  }
  topWildcardStage[cat] = { idx: best, perClear: MULTIPLIER * bestE };
}

const xAdjusted = { ...xCont };
for (const cat of Object.keys(preset.demand)) {
  const consumed = tierKeys.reduce((a, tk) => a + yInt[cat][tk] * rate[tk], 0);
  let supply = wildcardSupplyAt(cat, xAdjusted);
  if (consumed > supply) {
    const deficit = consumed - supply;
    const { idx, perClear } = topWildcardStage[cat];
    const add = Math.ceil(deficit / perClear);
    xAdjusted[idx] = (xAdjusted[idx] ?? 0) + add;
  }
}

// --- 周回プラン（整数化で補填済みの x を切り上げ） ---
const plan = [];
for (let i = 0; i < stageList.length; i++) {
  const raw = xAdjusted[i] ?? 0;
  if (raw <= 1e-6) continue;
  const clears = Math.ceil(raw);
  const s = stageList[i];
  plan.push({
    stage: s.label,
    area: s.area,
    stage_num: s.stage,
    clears,
    lp_continuous: Number((xCont[i] ?? 0).toFixed(3)),
  });
}
plan.sort((a, b) => a.area - b.area || a.stage_num - b.stage_num);

const totalClears = plan.reduce((a, p) => a + p.clears, 0);
const totalAp = totalClears * AP_PER_CLEAR;

// --- 実ドロップ期待値の再計算（ceil 後） ---
const dropExpected = {};   // dropExpected[cat][Tt] = ceil 後の実ドロップ期待値
const wildcardSupply = {}; // wildcardSupply[cat]    = ceil 後の万能設計図期待獲得
for (const cat of Object.keys(preset.demand)) {
  dropExpected[cat] = Object.fromEntries(tierKeys.map((tk) => [tk, 0]));
  wildcardSupply[cat] = 0;
}
const stageIndex = new Map(stageList.map((s, i) => [s.label, i]));
for (const p of plan) {
  const s = stageList[stageIndex.get(p.stage)];
  for (const d of s.drops) {
    const add = MULTIPLIER * d.expected * p.clears;
    if (d.tier === 0) {
      wildcardSupply[d.category] += add;
    } else if (d.tier >= 2 && d.tier <= preset.target_tier) {
      dropExpected[d.category][`T${d.tier}`] += add;
    }
  }
}

// --- 万能設計図の変換（整数化後） ---
const wildcardConverted = {};
for (const cat of Object.keys(preset.demand)) {
  wildcardConverted[cat] = {};
  for (const tk of tierKeys) wildcardConverted[cat][tk] = yInt[cat][tk];
}

// --- 各カテゴリ・Tier の充足状況 ---
const round = (x, n = 2) => Number(x.toFixed(n));
const fulfillment = [];
for (const cat of Object.keys(preset.demand)) {
  const tiers = {};
  let reqTotal = 0;
  let gotTotal = 0;
  for (const tk of tierKeys) {
    const req = required[cat][tk];
    const drop = round(dropExpected[cat][tk]);
    const converted = round(wildcardConverted[cat][tk]);
    const obtained = round(drop + converted);
    const surplus = round(obtained - req);
    tiers[tk] = { required: req, drop_expected: drop, wildcard_converted: converted, obtained, surplus };
    reqTotal += req;
    gotTotal += obtained;
  }
  fulfillment.push({
    category: cat,
    total_required: reqTotal,
    total_obtained: round(gotTotal),
    total_surplus: round(gotTotal - reqTotal),
    tiers,
  });
}

// --- 万能設計図の収支 ---
const wildcardLedger = [];
for (const cat of Object.keys(preset.demand)) {
  const usedFor = {};
  let consumed = 0;
  for (const tk of tierKeys) {
    const v = wildcardConverted[cat][tk];
    if (v > 0) {
      usedFor[tk] = v;
      consumed += v * rate[tk];
    }
  }
  const supply = round(wildcardSupply[cat]);
  wildcardLedger.push({
    category: cat,
    supply,
    consumed: round(consumed),
    surplus: round(supply - consumed),
    used_for: usedFor,
  });
}

// --- YAML 出力 ---
const output = {
  generated_at: new Date().toISOString(),
  preset: demandYaml.active,
  description: preset.description,
  target_tier: preset.target_tier,
  demand: preset.demand,
  multiplier: MULTIPLIER,
  summary: {
    total_clears: totalClears,
    total_ap: totalAp,
  },
  plan,
  fulfillment,
  wildcard_ledger: wildcardLedger,
};

fs.writeFileSync(OUT_PATH, yaml.dump(output, { lineWidth: 140, noRefs: true, quotingType: '"' }));
console.log(`wrote ${path.relative(process.cwd(), OUT_PATH)}`);
console.log(`  周回: ${totalClears} 回 / AP: ${totalAp.toLocaleString()} / ステージ: ${plan.length}`);
