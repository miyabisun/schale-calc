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
const groups = loadJson('groups');

// 装備 ID が「Tier1 完成品（4桁）= 計算対象外」か判定する。
// 実データ上、完成品 Tier1 の ID は 1000/2000/3000/5000/6000/8000 のような 4桁。
// 設計図は 6桁（10XXXX, 50XXXX, …）。
function isDraft(equipId) {
  return equipId >= 100000;
}

// 1 つの reward エントリを「装備設計図への寄与」のリストに展開する。
// GachaGroup は groups.json で内部抽選テーブルを引いて子装備に分解する。
// 例: GachaGroup 609007 (Chance 0.3) → Necklace T7 (子 Chance 0.3333) と T8 (0.6667) に分配。
function expandReward(r) {
  if (r.Type === 'Equipment') {
    return [{ equipId: r.Id, amount: r.Amount ?? 1, chance: r.Chance, source: 'equipment' }];
  }
  if (r.Type === 'GachaGroup') {
    const group = groups[String(r.Id)];
    if (!group?.Items) return [];
    const parentChance = r.Chance ?? 1;
    const parentAmount = r.Amount ?? 1;
    const out = [];
    for (const it of group.Items) {
      if (it.Type !== 'Equipment') continue;
      const childChance = it.Chance ?? 0;       // groups 側が Chance 省略なら期待値ゼロで除外される側に倒す
      const aMin = it.AmountMin ?? 1;
      const aMax = it.AmountMax ?? aMin;
      const childAmount = (aMin + aMax) / 2;
      out.push({
        equipId: it.Id,
        amount: parentAmount * childAmount,
        chance: parentChance * childChance,
        source: 'gacha',
      });
    }
    return out;
  }
  return [];
}

// スロット配列から、同一 Id をまとめて期待値と内訳を返す。
function aggregateDrops(rewards) {
  const byId = new Map();
  for (const r of rewards) {
    if (r.RewardType) continue;            // FirstClear / ThreeStar はスキップ
    for (const ex of expandReward(r)) {
      if (!isDraft(ex.equipId)) continue;  // Tier1 完成品はスキップ
      if (ex.chance === 0) continue;       // 期待値ゼロ (例: groups 内の "0" 重み) は除外
      if (!byId.has(ex.equipId)) byId.set(ex.equipId, []);
      const slot = { amount: ex.amount };
      if (ex.chance !== undefined && ex.chance !== 1) slot.chance = Number(ex.chance.toFixed(6));
      if (ex.source === 'gacha') slot.source = 'gacha';
      byId.get(ex.equipId).push(slot);
    }
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
    'Currency / 装備以外の GachaGroup (500100 など)',
    'RewardType === "FirstClear" | "ThreeStar"',
    '設計図が1種もドロップしないステージ',
  ],
  notes: {
    label: '"任務{Area}-{Stage}" 形式。Area は元の番号のまま（3の倍数を飛ばすが詰めない）。',
    expected: 'Σ(slot.amount × (slot.chance ?? 1))。スロット同士は独立抽選のため単純合算。',
    slots: '未指定 chance は確定ドロップ（= 1.0）として期待値計算。source: "gacha" は GachaGroup 由来のサブドロップ。',
    gacha_group: 'GachaGroup は groups.json の内部抽選テーブルで子装備に展開し、親chance × 子chance × 個数 で期待値加算。',
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
