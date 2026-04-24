// レポート文字列の組み立てに使う表示系の純粋関数群。

const CATEGORY_JA = {
  Hat: '帽子', Gloves: '手袋', Shoes: '靴',
  Bag: 'カバン', Badge: 'バッジ', Hairpin: 'ヘアピン',
  Charm: 'お守り', Watch: '時計', Necklace: 'ネックレス',
};

// カテゴリ名 (英) を日本語に変換。未定義カテゴリはそのまま返す。
function categoryJa(c) {
  return CATEGORY_JA[c] ?? c;
}

// 数値を「小数 n 桁、末尾ゼロを削った」文字列に整形。
// fmt(0)         → '0'
// fmt(1.234, 1)  → '1.2'
// fmt(1.0, 1)    → '1'
function fmt(v, n = 1) {
  if (v === 0) return '0';
  return Number(v).toFixed(n).replace(/\.?0+$/, '') || '0';
}

// 符号付きで fmt する。0 以下は素の fmt 結果、正値は先頭に '+' を付ける。
function signed(v) {
  return (v > 0 ? '+' : '') + fmt(v);
}

// 'T9' のような Tier キー文字列を数値 9 に変換。'T10' → 10。
function tierIndex(tk) {
  return Number(tk.slice(1));
}

// 連続した Tier キー配列を生成する。
// tierKeys(2, 10) → ['T2', 'T3', ..., 'T10']
function tierKeys(from, to) {
  const out = [];
  for (let t = from; t <= to; t++) out.push(`T${t}`);
  return out;
}

// fulfillment[].category の出現順をインデックス Map に変換。
// 後段でソートキーとして使い、preset.demand 定義順 (= 黄金比) を保つ。
function catOrder(fulfillment) {
  return new Map(fulfillment.map((f, i) => [f.category, i]));
}

module.exports = { categoryJa, fmt, signed, tierIndex, tierKeys, catOrder };
