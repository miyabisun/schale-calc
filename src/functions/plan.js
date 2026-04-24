// 任務周回プランの LP 計算と、解からの集計を担う純粋関数群。
// LP solver の呼び出しは外側 (orchestrator) で行い、本ファイルは入出力を変換する。

// 必要素材テーブル: required[category][T#] = demand[category] × cumulative_to_T10.materials[T#]
// 例: 帽子 demand=3 → T2 は 3 × 40 = 120
function requiredMaterials(demand, cumulative, tierKeys) {
  const required = {};
  for (const [cat, n] of Object.entries(demand)) {
    required[cat] = {};
    for (const tk of tierKeys) required[cat][tk] = n * cumulative[tk];
  }
  return required;
}

// LP モデルを組み立てる。
// 変数:
//   x_<i>          : ステージ i の周回数
//   y_<cat>_<tier> : 万能設計図 → Tier 設計図への変換数
// 制約:
//   demand_<cat>_<tier> : ドロップ期待値 + 変換 ≥ required[cat][tier]
//   wildcard_<cat>      : 万能設計図の供給 - 消費 ≥ 0
// 目的: Σ x_i 最小化
function buildLpModel({ stages, required, rate, tierKeys, multiplier, demand }) {
  const model = { optimize: 'totalClears', opType: 'min', constraints: {}, variables: {} };

  for (const cat of Object.keys(demand)) {
    for (const tk of tierKeys) model.constraints[`demand_${cat}_${tk}`] = { min: required[cat][tk] };
    model.constraints[`wildcard_${cat}`] = { min: 0 };
  }

  for (let i = 0; i < stages.length; i++) {
    const s = stages[i];
    const coef = { totalClears: 1 };
    for (const d of s.drops) {
      if (!demand[d.category]) continue;
      if (d.tier === 0) {
        coef[`wildcard_${d.category}`] = (coef[`wildcard_${d.category}`] ?? 0) + multiplier * d.expected;
      } else if (tierKeys.includes(`T${d.tier}`)) {
        const key = `demand_${d.category}_T${d.tier}`;
        coef[key] = (coef[key] ?? 0) + multiplier * d.expected;
      }
    }
    model.variables[`x_${i}`] = coef;
  }

  for (const cat of Object.keys(demand)) {
    for (const tk of tierKeys) {
      model.variables[`y_${cat}_${tk}`] = {
        [`demand_${cat}_${tk}`]: 1,
        [`wildcard_${cat}`]: -rate[tk],
      };
    }
  }

  return model;
}

// LP 解の y_<cat>_<tier> を切り上げ整数化する。
// 万能設計図 → 通常設計図の交換は 1 個単位でしか行えないため。
function integerizeLpY(result, demand, tierKeys) {
  const yInt = {};
  for (const cat of Object.keys(demand)) {
    yInt[cat] = {};
    for (const tk of tierKeys) {
      const raw = result[`y_${cat}_${tk}`] ?? 0;
      yInt[cat][tk] = raw > 1e-9 ? Math.ceil(raw) : 0;
    }
  }
  return yInt;
}

// 各ステージの周回 (整数化済み) からカテゴリ別の万能設計図供給量を集計
function wildcardSupplyAt(cat, xMap, stages, multiplier) {
  let s = 0;
  for (let i = 0; i < stages.length; i++) {
    const st = stages[i];
    for (const d of st.drops) {
      if (d.tier === 0 && d.category === cat) s += multiplier * d.expected * (xMap[i] ?? 0);
    }
  }
  return s;
}

// カテゴリごとに「万能設計図が一番多く出るステージ」と 1 周あたりの期待量を返す。
// y 整数化で消費が増えた時の不足補填に使う。
function topWildcardStages(stages, demand, multiplier) {
  const top = {};
  for (const cat of Object.keys(demand)) {
    let best = -1, bestE = 0;
    for (let i = 0; i < stages.length; i++) {
      for (const d of stages[i].drops) {
        if (d.tier === 0 && d.category === cat && d.expected > bestE) {
          bestE = d.expected;
          best = i;
        }
      }
    }
    top[cat] = { idx: best, perClear: multiplier * bestE };
  }
  return top;
}

// LP 連続解 + 整数化 y に対して、万能設計図の供給不足が出るカテゴリの周回数を追加する。
function adjustClearsForIntegerY({ xCont, yInt, stages, demand, rate, tierKeys, multiplier }) {
  const xAdjusted = { ...xCont };
  const top = topWildcardStages(stages, demand, multiplier);
  for (const cat of Object.keys(demand)) {
    const consumed = tierKeys.reduce((a, tk) => a + yInt[cat][tk] * rate[tk], 0);
    const supply = wildcardSupplyAt(cat, xAdjusted, stages, multiplier);
    if (consumed > supply) {
      const deficit = consumed - supply;
      const { idx, perClear } = top[cat];
      const add = Math.ceil(deficit / perClear);
      xAdjusted[idx] = (xAdjusted[idx] ?? 0) + add;
    }
  }
  return xAdjusted;
}

// 整数化 + 補填済みの x から最終周回プランを生成 (area, stage_num 昇順)
function buildPlan({ stages, xAdjusted, xCont }) {
  const plan = [];
  for (let i = 0; i < stages.length; i++) {
    const raw = xAdjusted[i] ?? 0;
    if (raw <= 1e-6) continue;
    const s = stages[i];
    plan.push({
      stage: s.label,
      area: s.area,
      stage_num: s.stage,
      clears: Math.ceil(raw),
      lp_continuous: Number((xCont[i] ?? 0).toFixed(3)),
    });
  }
  plan.sort((a, b) => a.area - b.area || a.stage_num - b.stage_num);
  return plan;
}

// 各カテゴリ・Tier の充足状況を集計する。
function buildFulfillment({ plan, stages, yInt, required, demand, tierKeys, multiplier }) {
  const stageIndex = new Map(stages.map((s, i) => [s.label, i]));
  const dropExpected = {};
  for (const cat of Object.keys(demand)) {
    dropExpected[cat] = Object.fromEntries(tierKeys.map((tk) => [tk, 0]));
  }
  for (const p of plan) {
    const s = stages[stageIndex.get(p.stage)];
    for (const d of s.drops) {
      if (d.tier === 0) continue;
      const tk = `T${d.tier}`;
      if (!tierKeys.includes(tk)) continue;
      if (!dropExpected[d.category]) continue;
      dropExpected[d.category][tk] += multiplier * d.expected * p.clears;
    }
  }

  const round = (x, n = 2) => Number(x.toFixed(n));
  const fulfillment = [];
  for (const cat of Object.keys(demand)) {
    const tiers = {};
    let reqTotal = 0;
    let gotTotal = 0;
    for (const tk of tierKeys) {
      const req = required[cat][tk];
      const drop = round(dropExpected[cat][tk]);
      const converted = round(yInt[cat][tk]);
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
  return fulfillment;
}

// 各カテゴリの万能設計図の収支 (供給/消費/余り) を集計する。
function buildWildcardLedger({ plan, stages, yInt, demand, rate, tierKeys, multiplier }) {
  const stageIndex = new Map(stages.map((s, i) => [s.label, i]));
  const supply = Object.fromEntries(Object.keys(demand).map((c) => [c, 0]));
  for (const p of plan) {
    const s = stages[stageIndex.get(p.stage)];
    for (const d of s.drops) {
      if (d.tier === 0 && supply[d.category] !== undefined) {
        supply[d.category] += multiplier * d.expected * p.clears;
      }
    }
  }

  const round = (x, n = 2) => Number(x.toFixed(n));
  const ledger = [];
  for (const cat of Object.keys(demand)) {
    const usedFor = {};
    let consumed = 0;
    for (const tk of tierKeys) {
      const v = yInt[cat][tk];
      if (v > 0) {
        usedFor[tk] = v;
        consumed += v * rate[tk];
      }
    }
    ledger.push({
      category: cat,
      supply: round(supply[cat]),
      consumed: round(consumed),
      surplus: round(supply[cat] - consumed),
      used_for: usedFor,
    });
  }
  return ledger;
}

module.exports = {
  requiredMaterials,
  buildLpModel,
  integerizeLpY,
  wildcardSupplyAt,
  topWildcardStages,
  adjustClearsForIntegerY,
  buildPlan,
  buildFulfillment,
  buildWildcardLedger,
};
