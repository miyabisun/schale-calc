// equipment-upgrade.yaml の整合性検査を行う純粋関数。
// 入力: data (yaml をパースしたオブジェクト)
// 出力: { ok, problems, summary }
//   problems: 不一致があった検査の説明文配列。空なら検査全通過。
//   summary : 計算で出した累計値 (UI 表示用)

function verifyUpgradeTable(data) {
  const problems = [];
  const expect = (label, actual, expected) => {
    if (actual !== expected) problems.push(`${label}: got ${actual}, expected ${expected}`);
  };

  // 1) tier_upgrade から累計を算出して cumulative_to_T10 と比較
  const cumMaterials = {};
  let cumTier = 0;
  let cumLevel = 0;
  for (const step of data.tier_upgrade) {
    for (const [tier, n] of Object.entries(step.materials)) {
      cumMaterials[tier] = (cumMaterials[tier] ?? 0) + n;
    }
    cumTier += step.tier_credits;
    cumLevel += step.level_credits;
  }
  for (const [tier, expected] of Object.entries(data.cumulative_to_T10.materials)) {
    expect(`cumulative.materials.${tier}`, cumMaterials[tier] ?? 0, expected);
  }
  expect('cumulative.tier_credits', cumTier, data.cumulative_to_T10.tier_credits);
  expect('cumulative.level_credits', cumLevel, data.cumulative_to_T10.level_credits);

  // 2) cumulative × wildcard_rate が cumulative_wildcards_if_all_substituted と一致
  let wildcardTotal = 0;
  for (const [tier, rate] of Object.entries(data.wildcard_rate)) {
    const need = (cumMaterials[tier] ?? 0) * rate;
    const recorded = data.cumulative_wildcards_if_all_substituted[tier];
    expect(`wildcards.${tier}`, need, recorded);
    wildcardTotal += need;
  }
  expect('wildcards.total', wildcardTotal, data.cumulative_wildcards_if_all_substituted.total);

  return {
    ok: problems.length === 0,
    problems,
    summary: { cumMaterials, cumTier, cumLevel, wildcardTotal },
  };
}

module.exports = { verifyUpgradeTable };
