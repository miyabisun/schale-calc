#!/usr/bin/env node
// data/grind-plan.yaml + data/campaign-normal-rewards.yaml を元に、
// 非プログラマの先生にも読める日本語レポートを docs/grind-plan.md に書き出す。
// 方針: 文字は最小限、表ベース。

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const ROOT = path.join(__dirname, '..');
const PLAN = yaml.load(fs.readFileSync(path.join(ROOT, 'data', 'grind-plan.yaml'), 'utf8'));
const REWARDS = yaml.load(fs.readFileSync(path.join(ROOT, 'data', 'campaign-normal-rewards.yaml'), 'utf8'));
const UPGRADE = yaml.load(fs.readFileSync(path.join(ROOT, 'data', 'equipment-upgrade.yaml'), 'utf8'));
const RATE = UPGRADE.wildcard_rate;
const OUT = path.join(ROOT, 'docs', 'grind-plan.md');

const CATEGORY_JA = {
  Hat: '帽子', Gloves: '手袋', Shoes: '靴',
  Bag: 'カバン', Badge: 'バッジ', Hairpin: 'ヘアピン',
  Charm: 'お守り', Watch: '時計', Necklace: 'ネックレス',
};
const ja = (c) => CATEGORY_JA[c] ?? c;

const AP_PER_CLEAR = 10;
const tierKeys = Object.keys(PLAN.fulfillment[0].tiers);
const stageByLabel = new Map(REWARDS.stages.map((s) => [s.label, s]));

const fmt = (v, n = 1) => {
  if (v === 0) return '0';
  return Number(v).toFixed(n).replace(/\.?0+$/, '') || '0';
};
const signed = (v) => (v > 0 ? '+' : '') + fmt(v);

// そのステージで何 Tier の何カテゴリを狙うかの略称
// GachaGroup 由来の T-2/-3 サブドロップは周知なので主な目当てから除外する。
function targetLabel(stageLabel) {
  const s = stageByLabel.get(stageLabel);
  if (!s) return '';
  const byTier = {};
  for (const d of s.drops) {
    if (d.tier === 0) continue;
    const hasMainDrop = d.slots.some((sl) => sl.source !== 'gacha');
    if (!hasMainDrop) continue;
    (byTier[d.tier] ??= new Set()).add(d.category);
  }
  return Object.entries(byTier)
    .sort((a, b) => +b[0] - +a[0])
    .map(([t, cats]) => `T${t}: ${[...cats].map(ja).join('、')}`)
    .join(' / ');
}

// --- 組み立て ---
const L = [];
const P = (s = '') => L.push(s);

P(`# 任務Normal 2倍期間 周回プラン`);
P();
P(`> \`npm run plan\` で自動生成。プリセットは [${PLAN.preset}](./oniea-golden-ratio.md)。`);
P();

P(`## 結論`);
P();
P(`| 合計周回 | 必要AP | 対象ステージ数 | 目標 |`);
P(`|---:|---:|---:|:---|`);
P(`| ${PLAN.summary.total_clears.toLocaleString()} 回 | ${PLAN.summary.total_ap.toLocaleString()} | ${PLAN.plan.length} | T1 → T${PLAN.target_tier} × 人数分 |`);
P();

P(`## 周回プラン`);
P();
P(`| ステージ | 周回 | AP | 主な目当て |`);
P(`|:---|---:|---:|:---|`);
for (const p of PLAN.plan) {
  P(`| ${p.stage} | ${p.clears} | ${(p.clears * AP_PER_CLEAR).toLocaleString()} | ${targetLabel(p.stage)} |`);
}
P(`| **合計** | **${PLAN.summary.total_clears.toLocaleString()}** | **${PLAN.summary.total_ap.toLocaleString()}** | |`);
P();

P(`## 在庫目安`);
P();
P(`> アイテム欄でこの数だけ確保できれば育成完了。装備設計図は不足時に同カテゴリの万能設計図で自動補填される (Tier ごとの交換レートは [equipment-upgrade.md](./equipment-upgrade.md) 参照)。`);
P();
const STOCK_TIERS = [`T${PLAN.target_tier - 1}`, `T${PLAN.target_tier}`];
P(`### 装備設計図 (${STOCK_TIERS.join('・')})`);
P();
P(`> 下位 Tier は ${STOCK_TIERS.join('・')} の周回時サブドロップと万能設計図補填で揃うため省略。`);
P();
P(`| カテゴリ | Tier | 必要数 |`);
P(`|:---|:---|---:|`);
for (const f of PLAN.fulfillment) {
  for (const tk of STOCK_TIERS) {
    const t = f.tiers[tk];
    if (!t) continue;
    P(`| ${ja(f.category)} | ${tk} | ${t.required.toLocaleString()} |`);
  }
}
P();
P(`### 万能設計図 (カテゴリ別)`);
P();
P(`| カテゴリ | 必要数 |`);
P(`|:---|---:|`);
for (const w of PLAN.wildcard_ledger) {
  P(`| ${ja(w.category)} | ${w.consumed.toLocaleString()} |`);
}
P();

P(`## 過不足`);
P();
P(`### カテゴリ別`);
P();
P(`| カテゴリ | 必要 | 獲得 | 余剰 |`);
P(`|:---|---:|---:|---:|`);
for (const f of PLAN.fulfillment) {
  P(`| ${ja(f.category)} | ${f.total_required} | ${fmt(f.total_obtained)} | ${signed(f.total_surplus)} |`);
}
P();

// 余剰 1 以上の (category, tier) のみ（端数はノイズとして省略）
// 並び順は黄金比 (preset.demand 定義順) → Tier 昇順 で在庫目安と揃える。
const catOrder = new Map(PLAN.fulfillment.map((f, i) => [f.category, i]));
const surplusRows = [];
for (const f of PLAN.fulfillment) {
  for (const [tk, t] of Object.entries(f.tiers)) {
    if (t.surplus >= 1) surplusRows.push({ category: f.category, tier: tk, ...t });
  }
}
surplusRows.sort((a, b) =>
  catOrder.get(a.category) - catOrder.get(b.category) ||
  +a.tier.slice(1) - +b.tier.slice(1)
);

P(`### Tier 別の余り (+1 以上)`);
P();
P(`| カテゴリ | Tier | 必要 | 獲得 | 余剰 |`);
P(`|:---|:---|---:|---:|---:|`);
for (const s of surplusRows) {
  P(`| ${ja(s.category)} | ${s.tier} | ${s.required} | ${fmt(s.obtained)} | ${signed(s.surplus)} |`);
}
P();

const totalRequired = PLAN.fulfillment.reduce((a, f) => a + f.total_required, 0);
const shownSurplusTotal = surplusRows.reduce((a, r) => a + r.surplus, 0);
P(`> 全体需要 ${totalRequired.toLocaleString()} 個に対し、上表の余剰は合計 ${fmt(shownSurplusTotal)} 個。最適解にかなり近い配分。`);
P();

P(`## 万能設計図の使い道`);
P();
P(`| カテゴリ | 入手 | 消費 | 余り |`);
P(`|:---|---:|---:|---:|`);
for (const w of PLAN.wildcard_ledger) {
  P(`| ${ja(w.category)} | ${fmt(w.supply)} | ${fmt(w.consumed)} | ${signed(w.surplus)} |`);
}
P();

P(`### 交換内訳 (万能消費 → 作成数)`);
P();
P(`| カテゴリ | Tier | 万能消費 → 作成 |`);
P(`|:---|:---|:---|`);
for (const w of PLAN.wildcard_ledger) {
  const tiers = Object.entries(w.used_for)
    .filter(([, v]) => v > 0)
    .sort((a, b) => +a[0].slice(1) - +b[0].slice(1));
  for (const [tk, made] of tiers) {
    const consumed = made * RATE[tk];
    P(`| ${ja(w.category)} | ${tk} | ${consumed} → ${made} |`);
  }
}
P();

P(`---`);
P();
P(`計算仕様: [任務](./campaign-spec.md) / [装備昇格](./equipment-upgrade.md) / [素データ](../data/grind-plan.yaml)`);
P();

fs.writeFileSync(OUT, L.join('\n'));
console.log(`wrote ${path.relative(process.cwd(), OUT)}`);
