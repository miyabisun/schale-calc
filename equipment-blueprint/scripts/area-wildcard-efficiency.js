#!/usr/bin/env node
// 任務 Normal の各 Area で 1 出撃あたり何枚の万能設計図相当が削れるかを計算し、
// data/area-wildcard-efficiency.yaml に書き出す。
//
// 計算式: カテゴリごとの (万能ドロップ + Σ Tier装備 × wildcard_rate[Tier])。
// 各ステージは 3 カテゴリをドロップし、内 1 枠が「高」、残り 2 枠が「低」。
// 同 Area 内の 5 ステージは数値構造が一致するので、1 ステージ目を代表として出力。

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const ROOT = path.join(__dirname, '..');
const stagesYaml  = yaml.load(fs.readFileSync(path.join(ROOT, 'data', 'campaign-normal-rewards.yaml'), 'utf8'));
const upgradeYaml = yaml.load(fs.readFileSync(path.join(ROOT, 'data', 'equipment-upgrade.yaml'), 'utf8'));

const M = 2; // 2倍キャンペーン
const AP_PER_CLEAR = 10;
const RATE = upgradeYaml.wildcard_rate;
const round = (x, n = 2) => Number(x.toFixed(n));

// 1 ステージのドロップを「カテゴリ別万能換算」に集約する。
// onlyTier を指定するとその Tier のドロップだけ集計する。
// returns { [category]: 換算値 }
function categoryEquivalents(stage, onlyTier = null) {
  const byCat = {};
  for (const d of stage.drops) {
    if (onlyTier !== null && d.tier !== onlyTier) continue;
    const e = M * d.expected;
    const add = d.tier === 0 ? e : e * RATE[`T${d.tier}`];
    byCat[d.category] = (byCat[d.category] ?? 0) + add;
  }
  return byCat;
}

// 主ドロップ Tier (= ステージ内で最大 Tier) を返す。
function mainTier(stage) {
  let max = 0;
  for (const d of stage.drops) if (d.tier > max) max = d.tier;
  return max;
}

// Area ごとに 1 ステージ代表を取り、3 カテゴリの換算値を high/low に分ける。
// (同 Area 内の 5 ステージは「どのカテゴリが高/低か」だけ違って数値構造は同じなので、
//  代表ステージ 1 つで Area の出撃あたり効率を表せる。)
const byArea = {};
for (const s of stagesYaml.stages) {
  if (!byArea[s.area]) byArea[s.area] = [];
  byArea[s.area].push(s);
}

const areas = [];
for (const [areaKey, stages] of Object.entries(byArea).sort((a, b) => +a[0] - +b[0])) {
  const sample = stages[0];
  const equiv = categoryEquivalents(sample);
  const values = Object.values(equiv).sort((a, b) => b - a);
  if (values.length === 0) continue;

  const high = round(values[0]);
  const lows = values.slice(1).map((v) => round(v));
  const total = round(values.reduce((a, v) => a + v, 0));
  const tier = mainTier(sample);
  if (tier === 0) continue; // 万能のみのエリアはスキップ (理論上ないはず)

  // primary (= main Tier) 単体の換算値。装備が満タンになって不要になったとき、
  // この分の万能換算が「無駄」として失われる。
  const primaryEquiv = categoryEquivalents(sample, tier);
  const pValues = Object.values(primaryEquiv).sort((a, b) => b - a);
  const pHigh = round(pValues[0]);
  const pLows = pValues.slice(1).map((v) => round(v));
  const pTotal = round(pValues.reduce((a, v) => a + v, 0));

  // primary を不要扱いにしたときの残効率
  const totalAfter = round(total - pTotal);
  const apPerWcAfter = totalAfter > 0 ? round(AP_PER_CLEAR / totalAfter, 4) : null;

  areas.push({
    area: Number(areaKey),
    main_tier: `T${tier}`,
    sample_stage: sample.label,
    per_clear: {
      total,
      ap_per_wildcard: round(AP_PER_CLEAR / total, 4),
      breakdown: [high, ...lows].join(' + ') + ` = ${total}`,
      high_slot: high,
      low_slots: lows,
    },
    primary_only: {
      tier: `T${tier}`,
      total: pTotal,
      breakdown: [pHigh, ...pLows].join(' + ') + ` = ${pTotal}`,
      high_slot: pHigh,
      low_slots: pLows,
      share_of_total: round(pTotal / total, 3),
    },
    after_primary_satisfied: {
      total: totalAfter,
      ap_per_wildcard: apPerWcAfter,
    },
  });
}

const out = {
  generated_at: new Date().toISOString(),
  description: '任務 Normal の各 Area で 1 出撃あたり削減できる万能設計図相当 (2倍キャンペーン)。',
  multiplier: M,
  ap_per_clear: AP_PER_CLEAR,
  notes: {
    computation: 'カテゴリごとの (万能ドロップ + Σ Tier装備 × wildcard_rate[Tier])。multiplier 込み。',
    breakdown_format: '高い枠 + 低い枠 + 低い枠 = 総計。同ステージ内 3 カテゴリの内、1 枠だけ約 1.33 倍 (4:3 比) ドロップする。',
    sample_stage: '同 Area 内の 5 ステージは数値構造が同じなので 1 ステージを代表として記載。',
    ap_per_wildcard: '万能設計図 1 枚相当を削るのに必要な AP。低いほど効率良い。',
    primary_only: 'main Tier 単体の万能換算。その Tier の装備が満タンで不要になると、この分は「無駄ドロップ」として失われる。',
    after_primary_satisfied: 'primary が不要になった後の残効率 (= total - primary_only.total)。サブドロップと万能ドロップだけで評価。',
  },
  areas,
};

const outPath = path.join(ROOT, 'data', 'area-wildcard-efficiency.yaml');
fs.writeFileSync(outPath, yaml.dump(out, { lineWidth: 140, noRefs: true, quotingType: '"' }));
console.log(`wrote ${path.relative(process.cwd(), outPath)} (${areas.length} areas)`);
