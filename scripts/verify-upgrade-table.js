#!/usr/bin/env node
// data/equipment-upgrade.yaml の転記ミス検出。
// 検査ロジックの実体は src/functions/verifyUpgradeTable.js にある。

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { verifyUpgradeTable } = require('../src/functions/verifyUpgradeTable');

const data = yaml.load(fs.readFileSync(path.join(__dirname, '..', 'data', 'equipment-upgrade.yaml'), 'utf8'));
const result = verifyUpgradeTable(data);

if (result.ok) {
  const { cumMaterials, cumTier, cumLevel, wildcardTotal } = result.summary;
  console.log('OK: equipment-upgrade.yaml passes all consistency checks.');
  console.log(`  cumulative T2..T10 materials: ${Object.entries(cumMaterials).filter(([k]) => k !== 'T1').map(([k, v]) => `${k}=${v}`).join(', ')}`);
  console.log(`  cumulative credits: tier=${cumTier.toLocaleString()}, level=${cumLevel.toLocaleString()}`);
  console.log(`  wildcard total (all substituted): ${wildcardTotal.toLocaleString()}`);
} else {
  console.error('FAIL:');
  for (const p of result.problems) console.error('  -', p);
  process.exit(1);
}
