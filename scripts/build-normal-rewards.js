#!/usr/bin/env node
// data/raw/*.json から「任務 Normal ＆ Area % 3 !== 0 ＆ 設計図が1種以上ドロップ」
// するステージだけを抽出し、装備ドロップの期待値付きで YAML に書き出す。
//
// 詳細仕様は docs/campaign-spec.md を参照。
// 純粋関数の実体は src/functions/drops.js にある。

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { aggregateDrops } = require('../src/functions/drops');

const RAW_DIR = path.join(__dirname, '..', 'data', 'raw');
const OUT_PATH = path.join(__dirname, '..', 'data', 'campaign-normal-rewards.yaml');

const loadJson = (name) => JSON.parse(fs.readFileSync(path.join(RAW_DIR, `${name}.json`), 'utf8'));
const stages = loadJson('stages');
const equipment = loadJson('equipment');
const groups = loadJson('groups');

const targets = Object.values(stages)
  .filter((s) => s.Category === 'Campaign' && s.Difficulty === 0 && s.Area % 3 !== 0)
  .sort((a, b) => (a.Area - b.Area) || (a.Stage === 'A' ? 99 : a.Stage) - (b.Stage === 'A' ? 99 : b.Stage));

const built = [];
for (const s of targets) {
  const drops = aggregateDrops(s.Rewards ?? [], groups, equipment);
  if (drops.length === 0) continue; // 設計図が1個も出ないステージはオミット
  built.push({ label: `任務${s.Area}-${s.Stage}`, area: s.Area, stage: s.Stage, drops });
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

fs.writeFileSync(OUT_PATH, yaml.dump(output, { lineWidth: 120, noRefs: true, quotingType: '"' }));
console.log(`wrote ${path.relative(process.cwd(), OUT_PATH)}`);
console.log(`  ${built.length} stages with equipment drafts`);
