#!/usr/bin/env node
// data/raw/*.json から「任務 Normal ＆ Area % 3 !== 0 ＆ 設計図が1種以上ドロップ」
// するステージだけを抽出し、装備ドロップの期待値付きで YAML に書き出す。
//
// 詳細仕様は docs/campaign-spec.md を参照。

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const RAW_DIR = path.join(__dirname, '..', 'data', 'raw');
const OUT_PATH = path.join(__dirname, '..', 'data', 'campaign-normal-rewards.yaml');

function loadJson(name) {
  return JSON.parse(fs.readFileSync(path.join(RAW_DIR, `${name}.json`), 'utf8'));
}

const stages = loadJson('stages');
const equipment = loadJson('equipment');

// 装備 ID が「Tier1 完成品（4桁）= 計算対象外」か判定する。
// 実データ上、完成品 Tier1 の ID は 1000/2000/3000/5000/6000/8000 のような 4桁。
// 設計図は 6桁（10XXXX, 50XXXX, …）。
function isDraft(equipId) {
  return equipId >= 100000;
}

// スロット配列から、同一 Id をまとめて期待値と内訳を返す。
function aggregateDrops(rewards) {
  const byId = new Map();
  for (const r of rewards) {
    if (r.RewardType) continue;          // FirstClear / ThreeStar はスキップ
    if (r.Type !== 'Equipment') continue; // Currency / GachaGroup は除外
    if (!isDraft(r.Id)) continue;         // Tier1 完成品はスキップ
    if (!byId.has(r.Id)) byId.set(r.Id, []);
    const slot = { amount: r.Amount ?? 1 };
    if (r.Chance !== undefined) slot.chance = r.Chance;
    byId.get(r.Id).push(slot);
  }
  const drops = [];
  for (const [id, slots] of byId) {
    const eq = equipment[id] ?? {};
    // chance 未指定は確定（= 1.0）として期待値加算
    const expected = slots.reduce((acc, s) => acc + s.amount * (s.chance ?? 1), 0);
    drops.push({
      id,
      name: eq.Name ?? null,
      category: eq.Category ?? null,
      tier: eq.Tier ?? null,
      expected: Number(expected.toFixed(4)),
      slots,
    });
  }
  // 出力は tier 昇順 → category → id 昇順でソート
  drops.sort((a, b) => (a.tier - b.tier) || a.category.localeCompare(b.category) || a.id - b.id);
  return drops;
}

function buildStage(s) {
  const drops = aggregateDrops(s.Rewards ?? []);
  if (drops.length === 0) return null; // 設計図が1個も出ないステージはオミット
  return {
    label: `任務${s.Area}-${s.Stage}`,
    area: s.Area,
    stage: s.Stage,
    drops,
  };
}

// --- メイン ---
const targets = Object.values(stages)
  .filter((s) => s.Category === 'Campaign' && s.Difficulty === 0 && s.Area % 3 !== 0)
  .sort((a, b) => (a.Area - b.Area) || (a.Stage === 'A' ? 99 : a.Stage) - (b.Stage === 'A' ? 99 : b.Stage));

const built = [];
for (const s of targets) {
  const b = buildStage(s);
  if (b) built.push(b);
}

const output = {
  source: 'https://schaledb.com/data/jp/stages.json',
  generated_at: new Date().toISOString(),
  difficulty: 'normal',
  excluded: [
    'Difficulty === 1 (Hard)',
    'Area % 3 === 0 (challenge areas without equipment drops)',
    'Tier1 完成品装備（4桁ID）',
    'Currency / GachaGroup',
    'RewardType === "FirstClear" | "ThreeStar"',
    '設計図が1種もドロップしないステージ',
  ],
  notes: {
    label: '"任務{Area}-{Stage}" 形式。Area は元の番号のまま（3の倍数を飛ばすが詰めない）。',
    expected: 'Σ(slot.amount × (slot.chance ?? 1))。スロット同士は独立抽選のため単純合算。',
    slots: '未指定 chance は確定ドロップ（= 1.0）として期待値計算。',
  },
  total_stages: built.length,
  stages: built,
};

fs.writeFileSync(OUT_PATH, yaml.dump(output, {
  lineWidth: 120,
  noRefs: true,
  quotingType: '"',
}));
console.log(`wrote ${path.relative(process.cwd(), OUT_PATH)}`);
console.log(`  ${built.length} stages with equipment drafts`);
