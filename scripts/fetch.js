#!/usr/bin/env node
// schaledb.com から任務計算に必要な JSON を取得し、data/raw/ に保存する。
// 使い方: node scripts/fetch.js

const fs = require('node:fs/promises');
const path = require('node:path');

const BASE_LANG = 'https://schaledb.com/data/jp';
const BASE_COMMON = 'https://schaledb.com/data';
const OUT_DIR = path.join(__dirname, '..', 'data', 'raw');
// groups は GachaGroup の内部抽選テーブル (言語非依存・data/ 直下).
// schaledb の任務ページがサブドロップ Tier を出せるのもこのファイル由来。
const RESOURCES = [
  { url: `${BASE_LANG}/stages.json`,        file: 'stages.json' },
  { url: `${BASE_LANG}/items.json`,         file: 'items.json' },
  { url: `${BASE_LANG}/currency.json`,      file: 'currency.json' },
  { url: `${BASE_LANG}/equipment.json`,     file: 'equipment.json' },
  { url: `${BASE_COMMON}/groups.min.json`,  file: 'groups.json' },
];

async function download({ url, file }) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
  const body = await res.text();
  JSON.parse(body); // 軽く検証
  const outPath = path.join(OUT_DIR, file);
  await fs.writeFile(outPath, body);
  const kb = (body.length / 1024).toFixed(1);
  console.log(`  ${file}  ${kb} KB`);
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  console.log(`downloading to ${path.relative(process.cwd(), OUT_DIR)}/`);
  for (const r of RESOURCES) {
    await download(r);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
