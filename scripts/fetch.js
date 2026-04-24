#!/usr/bin/env node
// schaledb.com から任務計算に必要な JSON を取得し、data/raw/ に保存する。
// 使い方: node scripts/fetch.js

const fs = require('node:fs/promises');
const path = require('node:path');

const BASE = 'https://schaledb.com/data/jp';
const OUT_DIR = path.join(__dirname, '..', 'data', 'raw');
const RESOURCES = ['stages', 'items', 'currency', 'equipment'];

async function download(name) {
  const url = `${BASE}/${name}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
  const body = await res.text();
  // JSON.parse で壊れていないか軽く検証してから書き込む
  JSON.parse(body);
  const outPath = path.join(OUT_DIR, `${name}.json`);
  await fs.writeFile(outPath, body);
  const kb = (body.length / 1024).toFixed(1);
  console.log(`  ${name}.json  ${kb} KB`);
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  console.log(`downloading to ${path.relative(process.cwd(), OUT_DIR)}/`);
  for (const name of RESOURCES) {
    await download(name);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
