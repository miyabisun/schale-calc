const test = require('node:test');
const assert = require('node:assert/strict');
const { targetLabel } = require('../../src/functions/targetLabel');
const { categoryJa } = require('../../src/functions/format');

// テスト用にカテゴリは英語のまま返すラベル関数 (アサート簡潔化のため)
const enLabel = (c) => c;

test('stage が無ければ空文字を返す', () => {
  assert.equal(targetLabel(null, enLabel), '');
  assert.equal(targetLabel(undefined, enLabel), '');
});

test('Equipment 直接ドロップ (source なし) はメインとして含まれる', () => {
  const stage = {
    drops: [
      { tier: 9, category: 'Hat', slots: [{ amount: 1, chance: 0.344 }] },
    ],
  };
  assert.equal(targetLabel(stage, enLabel), 'T9: Hat');
});

test('GachaGroup 由来のサブドロップ (source: gacha) のみの装備は主な目当てから除外', () => {
  const stage = {
    drops: [
      { tier: 9, category: 'Hat', slots: [{ amount: 1, chance: 0.344 }] },
      { tier: 7, category: 'Hat', slots: [{ amount: 1, chance: 0.1, source: 'gacha' }] },
    ],
  };
  assert.equal(targetLabel(stage, enLabel), 'T9: Hat', 'T7 のサブドロップは表示されない');
});

test('Tier 0 (万能設計図) はスキップ', () => {
  const stage = {
    drops: [
      { tier: 0, category: 'Hat', slots: [{ amount: 13 }] },
      { tier: 9, category: 'Hat', slots: [{ amount: 1, chance: 0.344 }] },
    ],
  };
  assert.equal(targetLabel(stage, enLabel), 'T9: Hat');
});

test('複数 Tier がある場合は Tier 降順で / 区切りに並べる', () => {
  const stage = {
    drops: [
      { tier: 8, category: 'Bag',     slots: [{ amount: 1, chance: 0.5 }] },
      { tier: 8, category: 'Watch',   slots: [{ amount: 1, chance: 0.5 }] },
      { tier: 5, category: 'Bag',     slots: [{ amount: 1, chance: 0.1, source: 'gacha' }] },
    ],
  };
  // T5 はサブドロップのみで除外されるため、T8 だけが残る
  assert.equal(targetLabel(stage, enLabel), 'T8: Bag、Watch');
});

test('categoryLabel に日本語変換を渡すと表示も日本語', () => {
  const stage = {
    drops: [
      { tier: 9, category: 'Hat', slots: [{ amount: 1, chance: 0.344 }] },
      { tier: 9, category: 'Necklace', slots: [{ amount: 1, chance: 0.258 }] },
    ],
  };
  assert.equal(targetLabel(stage, categoryJa), 'T9: 帽子、ネックレス');
});

test('同一カテゴリが Equipment + GachaGroup の両方からドロップする場合、メインとして残る', () => {
  // 例: T8 の Bag は任務26-* で Equipment ドロップ、別任務では GachaGroup サブドロップ
  const stage = {
    drops: [
      { tier: 8, category: 'Bag', slots: [
        { amount: 1, chance: 0.3 },                          // メイン
        { amount: 1, chance: 0.1, source: 'gacha' },         // サブ (同 ID 別ステージ由来想定)
      ]},
    ],
  };
  assert.equal(targetLabel(stage, enLabel), 'T8: Bag');
});
