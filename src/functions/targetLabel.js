// 「主な目当て」列の文字列を組み立てる純粋関数。
// 例: 任務29-5 → "T10: カバン、ヘアピン、ネックレス"
//
// stage:        campaign-normal-rewards.yaml の stages[i] と同形 (drops を持つ)
// categoryLabel: カテゴリ名 (英) を表示用文字列に変換する関数 (例: format.categoryJa)

function targetLabel(stage, categoryLabel) {
  if (!stage) return '';
  const byTier = {};
  for (const d of stage.drops) {
    if (d.tier === 0) continue;
    // GachaGroup 由来の T-2/-3 サブドロップは周知なので主な目当てから除外する
    const hasMainDrop = d.slots.some((sl) => sl.source !== 'gacha');
    if (!hasMainDrop) continue;
    (byTier[d.tier] ??= new Set()).add(d.category);
  }
  return Object.entries(byTier)
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([t, cats]) => `T${t}: ${[...cats].map(categoryLabel).join('、')}`)
    .join(' / ');
}

module.exports = { targetLabel };
