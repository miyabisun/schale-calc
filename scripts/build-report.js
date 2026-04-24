#!/usr/bin/env node
// data/grind-plan.yaml + data/campaign-normal-rewards.yaml を元に、
// 非プログラマの先生にも読める日本語レポートを docs/grind-plan.md に書き出す。
// 方針: 文字は最小限、表ベース。
// 純粋関数の実体は src/functions/{format,targetLabel}.js にある。

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { categoryJa, fmt, signed, catOrder } = require('../src/functions/format');
const { targetLabel } = require('../src/functions/targetLabel');

const ROOT = path.join(__dirname, '..');
const PLAN = yaml.load(fs.readFileSync(path.join(ROOT, 'data', 'grind-plan.yaml'), 'utf8'));
const REWARDS = yaml.load(fs.readFileSync(path.join(ROOT, 'data', 'campaign-normal-rewards.yaml'), 'utf8'));
const UPGRADE = yaml.load(fs.readFileSync(path.join(ROOT, 'data', 'equipment-upgrade.yaml'), 'utf8'));
const RATE = UPGRADE.wildcard_rate;
const OUT = path.join(ROOT, 'docs', 'grind-plan.md');

const AP_PER_CLEAR = 10;
const stageByLabel = new Map(REWARDS.stages.map((s) => [s.label, s]));

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
  P(`| ${p.stage} | ${p.clears} | ${(p.clears * AP_PER_CLEAR).toLocaleString()} | ${targetLabel(stageByLabel.get(p.stage), categoryJa)} |`);
}
P(`| **合計** | **${PLAN.summary.total_clears.toLocaleString()}** | **${PLAN.summary.total_ap.toLocaleString()}** | |`);
P();

P(`## 在庫目安`);
P();
P(`> この周回プランを消化すると、以下の期待値でアイテムがアイテム欄に積み上がる。昇格時は装備設計図が優先消費され、不足分は同カテゴリの万能設計図から自動補填される (Tier ごとの交換レートは [equipment-upgrade.md](./equipment-upgrade.md) 参照)。`);
P();

// 装備設計図: 各カテゴリの drop_expected を Tier で横並び
// 表示は整数 (Math.round) なので、四捨五入で 1 個以上になる Tier だけ列に出す。
// ゼロ表示のセルは '—' にして「この組み合わせはドロップしない」が一目で分かるように。
const cellStr = (drop) => {
  const n = Math.round(drop ?? 0);
  return n === 0 ? '—' : n.toLocaleString();
};
const DROP_TIERS = Object.keys(PLAN.fulfillment[0].tiers)
  .filter((tk) => PLAN.fulfillment.some((f) => Math.round(f.tiers[tk]?.drop_expected ?? 0) >= 1));

P(`### 装備設計図 (周回ドロップ期待値)`);
P();
P(`| カテゴリ | ${DROP_TIERS.join(' | ')} |`);
P(`|:---|${DROP_TIERS.map(() => '---:').join('|')}|`);
for (const f of PLAN.fulfillment) {
  const cells = DROP_TIERS.map((tk) => cellStr(f.tiers[tk]?.drop_expected));
  P(`| ${categoryJa(f.category)} | ${cells.join(' | ')} |`);
}
P();
P(`> 記載のない下位 Tier (T2〜) は直接ドロップせず、昇格時に万能設計図から直接引き落とされる。`);
P();

P(`### 万能設計図 (周回ドロップ期待値)`);
P();
P(`| カテゴリ | 入手 |`);
P(`|:---|---:|`);
for (const w of PLAN.wildcard_ledger) {
  P(`| ${categoryJa(w.category)} | ${Math.round(w.supply).toLocaleString()} |`);
}
P();

P(`## 過不足`);
P();
P(`### カテゴリ別`);
P();
P(`| カテゴリ | 必要 | 獲得 | 余剰 |`);
P(`|:---|---:|---:|---:|`);
for (const f of PLAN.fulfillment) {
  P(`| ${categoryJa(f.category)} | ${f.total_required} | ${fmt(f.total_obtained)} | ${signed(f.total_surplus)} |`);
}
P();

// 余剰 1 以上の (category, tier) のみ。並び順は黄金比 (preset.demand 定義順) → Tier 昇順 で在庫目安と揃える。
const order = catOrder(PLAN.fulfillment);
const surplusRows = [];
for (const f of PLAN.fulfillment) {
  for (const [tk, t] of Object.entries(f.tiers)) {
    if (t.surplus >= 1) surplusRows.push({ category: f.category, tier: tk, ...t });
  }
}
surplusRows.sort((a, b) =>
  order.get(a.category) - order.get(b.category) || Number(a.tier.slice(1)) - Number(b.tier.slice(1))
);

P(`### Tier 別の余り (+1 以上)`);
P();
P(`| カテゴリ | Tier | 必要 | 獲得 | 余剰 |`);
P(`|:---|:---|---:|---:|---:|`);
for (const s of surplusRows) {
  P(`| ${categoryJa(s.category)} | ${s.tier} | ${s.required} | ${fmt(s.obtained)} | ${signed(s.surplus)} |`);
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
  P(`| ${categoryJa(w.category)} | ${fmt(w.supply)} | ${fmt(w.consumed)} | ${signed(w.surplus)} |`);
}
P();

P(`### 交換内訳 (万能消費 → 作成数)`);
P();
P(`| カテゴリ | Tier | 万能消費 → 作成 |`);
P(`|:---|:---|:---|`);
for (const w of PLAN.wildcard_ledger) {
  const tiers = Object.entries(w.used_for)
    .filter(([, v]) => v > 0)
    .sort((a, b) => Number(a[0].slice(1)) - Number(b[0].slice(1)));
  for (const [tk, made] of tiers) {
    P(`| ${categoryJa(w.category)} | ${tk} | ${made * RATE[tk]} → ${made} |`);
  }
}
P();

P(`---`);
P();
P(`計算仕様: [任務](./campaign-spec.md) / [装備昇格](./equipment-upgrade.md) / [素データ](../data/grind-plan.yaml)`);
P();

fs.writeFileSync(OUT, L.join('\n'));
console.log(`wrote ${path.relative(process.cwd(), OUT)}`);
