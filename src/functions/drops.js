// 任務ステージの Rewards (raw データ) を「装備設計図のドロップ期待値」に整形する純粋関数群。
// I/O は持たず、全て引数で渡された値だけで計算する。

// 装備 ID が「Tier1 完成品（4桁）= 計算対象外」か判定する。
// 実データ上、完成品 Tier1 の ID は 1000/2000/3000/5000/6000/8000 のような 4桁。
// 設計図は 6桁（10XXXX, 50XXXX, …）。
function isDraft(equipId) {
  return equipId >= 100000;
}

// 1 つの reward エントリを「装備設計図への寄与」のリストに展開する。
// GachaGroup は groups テーブルで内部抽選を引いて子装備に分解する。
// 例: GachaGroup 609007 (Chance 0.3) → Necklace T7 (子 Chance 0.3333) と T8 (0.6667) に分配。
function expandReward(r, groups) {
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

// rewards 配列を「装備 ID 単位でまとめたドロップ期待値」配列に集約する。
// 各 drop は { id, name, category, tier, expected, slots } の形。
// equipment は装備 ID → メタ情報 (Name, Category, Tier) のマップ。
function aggregateDrops(rewards, groups, equipment) {
  const byId = new Map();
  for (const r of rewards) {
    if (r.RewardType) continue;            // FirstClear / ThreeStar はスキップ
    for (const ex of expandReward(r, groups)) {
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

module.exports = { isDraft, expandReward, aggregateDrops };
