/**
 * Computes precision from your manually-filled precision-review.csv.
 * Run after completing manual review: npm run benchmark:precision
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// Usage: npx tsx benchmark/precision.ts [csvFileName]
// Defaults to precision-review.csv. Pass e.g. precision-review-holdout.csv
// to score a held-out set generated via evaluate.ts.
const csvFileName = process.argv[2] ?? 'precision-review.csv';
const csvPath = join(__dirname, csvFileName);
const raw = readFileSync(csvPath, 'utf8').trim().split('\n');

// Minimal RFC4180 CSV row parser — handles quoted fields containing commas
// (e.g. TODO/HACK comment text like "HACK: , but in order to..."), which a
// naive line.split(',') silently mis-splits and drops from the count.
function parseCSVLine(line: string): string[] {
  const cols: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else { inQuotes = false; }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cols.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cols.push(cur);
  return cols;
}

const headers = parseCSVLine(raw[0]);
const tpIdx = headers.indexOf('true_positive');
const ruleIdx = headers.indexOf('rule');

interface RuleStat { tp: number; total: number }
const byRule: Record<string, RuleStat> = {};
let totalTP = 0;
let totalReviewed = 0;

for (const line of raw.slice(1)) {
  const cols = parseCSVLine(line);
  const rule = cols[ruleIdx];
  const tp = cols[tpIdx];
  if (tp !== '0' && tp !== '1') continue; // skip unreviewed rows

  byRule[rule] ??= { tp: 0, total: 0 };
  byRule[rule].total++;
  totalReviewed++;

  if (tp === '1') {
    byRule[rule].tp++;
    totalTP++;
  }
}

if (totalReviewed === 0) {
  console.error('\nNo reviewed rows found. Fill in true_positive column first.\n');
  process.exit(1);
}

console.log('\n╔════════════════════════════════════════════════════╗');
console.log('║        Precision Results (Manual Classification)    ║');
console.log('╚════════════════════════════════════════════════════╝\n');

const C1 = 26;
console.log(`  ${'Rule'.padEnd(C1)} ${'Findings'.padStart(9)}   ${'Precision'.padStart(10)}`);
console.log(`  ${'─'.repeat(52)}`);

for (const [rule, s] of Object.entries(byRule)) {
  const precision = s.total === 0 ? 0 : (s.tp / s.total) * 100;
  console.log(
    `  ${rule.padEnd(C1)} ${`${s.tp}/${s.total}`.padStart(9)}   ${`${precision.toFixed(1)}%`.padStart(10)}`,
  );
}

console.log(`  ${'─'.repeat(52)}`);
const overall = totalReviewed === 0 ? 0 : (totalTP / totalReviewed) * 100;
console.log(
  `  ${'Overall'.padEnd(C1)} ${`${totalTP}/${totalReviewed}`.padStart(9)}   ${`${overall.toFixed(1)}%`.padStart(10)}`,
);
console.log();