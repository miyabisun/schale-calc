// 500パターンの乱数テーブルを作り直して data/table.json に保存する。通常のbuildでは実行しない。
// 1パターン = 普通のサイコロ200回の目 + 確定サイコロを受け取る順の目(先頭16個が開始時の所持分)。

const fs = require('node:fs');
const path = require('node:path');
const { randomInt } = require('node:crypto');
const { makePattern } = require('./stats.js');

const FIXED_LENGTH = 300; // どの戦略でも使い切らない長さ。足りなければ play() がエラーで止まる
const patterns = Array.from({ length: 500 }, () => makePattern(() => randomInt(1, 7), 200, FIXED_LENGTH))
  .map((p) => ({ normal: p.normal.join(''), fixed: p.fixed.join('') }));
const out = path.join(__dirname, '..', 'data', 'table.json');
fs.writeFileSync(out, `${JSON.stringify({ patterns }, null, 1)}\n`);
console.log(`wrote ${path.relative(process.cwd(), out)}`);
