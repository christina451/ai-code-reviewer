/**
 * Precision and Recall Benchmark
 *
 * Measures the static analysis engine against real-world TypeScript files.
 *
 * Part A — Recall: injects known issues into copies of corpus files and
 * measures what percentage the analyzer detects.
 *
 * Part B — Precision: runs the analyzer against unmodified corpus files
 * and outputs a CSV for manual classification of findings.
 *
 * Usage:
 *   npm run benchmark:eval
 *
 * After running:
 *   1. Open benchmark/precision-review.csv
 *   2. For each row, set the "true_positive" column to 1 (correct finding)
 *      or 0 (false positive)
 *   3. Run: npm run benchmark:precision
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { analyzeFile } from '../src/services/analysis-service';

// Usage: npx tsx benchmark/evaluate.ts [corpusDirName] [outputSuffix]
// Defaults to the 'corpus' dev set. Pass e.g. 'corpus-holdout' 'holdout'
// to evaluate a separate held-out set without overwriting the dev-set results.
const corpusDirName = process.argv[2] ?? 'corpus';
const outputSuffix = process.argv[3] ?? '';
const suffixed = (name: string) => (outputSuffix ? `${name}-${outputSuffix}` : name);

const CORPUS_DIR = join(__dirname, corpusDirName);
const SEEDED_DIR = join(__dirname, suffixed('seeded'));

// ─── Load corpus ──────────────────────────────────────────────────────────────

function loadCorpusFiles(): Array<{ filename: string; source: string }> {
  if (!existsSync(CORPUS_DIR)) {
    console.error(`\nCorpus directory not found: ${CORPUS_DIR}`);
    console.error('Create benchmark/corpus/ and add 30-40 real .ts files.\n');
    process.exit(1);
  }

  const files = readdirSync(CORPUS_DIR).filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));

  if (files.length < 5) {
    console.error(`\nOnly ${files.length} files in corpus. Add more real TypeScript files.\n`);
    process.exit(1);
  }

  return files.map(filename => ({
    filename,
    source: readFileSync(join(CORPUS_DIR, filename), 'utf8'),
  }));
}

// ─── Seeders ──────────────────────────────────────────────────────────────────
// Each seeder takes source code and injects a known issue.
// Returns { seeded: string, expectedRuleId: string, description: string }

interface SeedResult {
  source: string;
  expectedRuleId: string;
  description: string;
}

function seedHighComplexity(source: string): SeedResult {
  // Inject a function with complexity 12 at the bottom of the file
  const inject = `
// BENCHMARK_SEEDED: high cyclomatic complexity
function __seeded_highComplexity__(x: number): number {
  if (x === 0) return 0;
  if (x === 1) return 1;
  if (x === 2) return 2;
  if (x === 3) return 3;
  if (x === 4) return 4;
  if (x === 5) return 5;
  if (x === 6) return 6;
  if (x === 7) return 7;
  if (x === 8) return 8;
  if (x === 9) return 9;
  if (x === 10) return 10;
  return -1;
}
`;
  return {
    source: source + inject,
    expectedRuleId: 'cyclomatic-complexity',
    description: 'Injected function with complexity 12',
  };
}

function seedLongFunction(source: string): SeedResult {
  const bodyLines = Array.from(
    { length: 55 },
    (_, i) => `  const __seeded_var_${i}__ = ${i};`,
  ).join('\n');
  const inject = `
// BENCHMARK_SEEDED: long function
function __seeded_longFunction__() {
${bodyLines}
  return __seeded_var_0__;
}
`;
  return {
    source: source + inject,
    expectedRuleId: 'function-length',
    description: 'Injected function with 58 lines',
  };
}

function seedDeepNesting(source: string): SeedResult {
  const inject = `
// BENCHMARK_SEEDED: deep nesting
function __seeded_deepNesting__(a: boolean, b: boolean, c: boolean, d: boolean, e: boolean): boolean {
  if (a) {
    if (b) {
      if (c) {
        if (d) {
          if (e) {
            return true;
          }
        }
      }
    }
  }
  return false;
}
`;
  return {
    source: source + inject,
    expectedRuleId: 'nesting-depth',
    description: 'Injected function with nesting depth 5',
  };
}

function seedUnreachableCode(source: string): SeedResult {
  const inject = `
// BENCHMARK_SEEDED: unreachable code
function __seeded_unreachable__(): number {
  return 42;
  const __seeded_dead__ = 'unreachable';
}
`;
  return {
    source: source + inject,
    expectedRuleId: 'no-unreachable',
    description: 'Injected return followed by dead code',
  };
}

function seedTodoComment(source: string): SeedResult {
  const inject = `
// TODO: BENCHMARK_SEEDED - this is a seeded todo comment
function __seeded_todo__(): void {}
`;
  return {
    source: source + inject,
    expectedRuleId: 'todo-fixme',
    description: 'Injected TODO comment',
  };
}

const SEEDERS = [
  seedHighComplexity,
  seedLongFunction,
  seedDeepNesting,
  seedUnreachableCode,
  seedTodoComment,
];

// ─── Part A: Recall ───────────────────────────────────────────────────────────

interface RecallResult {
  file: string;
  seeder: string;
  expectedRule: string;
  detected: boolean;
  findingsForRule: number;
}

function runRecallBenchmark(
  corpus: Array<{ filename: string; source: string }>,
): RecallResult[] {
  if (!existsSync(SEEDED_DIR)) mkdirSync(SEEDED_DIR);

  const results: RecallResult[] = [];

  // Use every 5th file for seeding to keep the benchmark manageable
  const seedingSubset = corpus.filter((_, i) => i % 5 === 0).slice(0, 10);

  for (const { filename, source } of seedingSubset) {
    for (const seeder of SEEDERS) {
      const seeded = seeder(source);

      try {
        const result = analyzeFile(seeded.source, filename);
        const ruleFindings = result.findings.filter(
          f => f.ruleId === seeded.expectedRuleId,
        );
        // A seeded issue is detected if at least one finding for
        // that rule references the seeded function (contains __seeded_)
        // or if any finding exists for that rule (for TODO/FIXME which
        // doesn't have a function context)
        const detected =
          seeded.expectedRuleId === 'todo-fixme'
            ? ruleFindings.some(f => f.line > source.split('\n').length)
            : ruleFindings.some(
                f =>
                  f.context?.startsWith('__seeded_') ||
                  (f.line > source.split('\n').length),
              );

        results.push({
          file: filename,
          seeder: seeder.name,
          expectedRule: seeded.expectedRuleId,
          detected,
          findingsForRule: ruleFindings.length,
        });
      } catch {
        // Parse error on seeded file — skip
        results.push({
          file: filename,
          seeder: seeder.name,
          expectedRule: seeded.expectedRuleId,
          detected: false,
          findingsForRule: 0,
        });
      }
    }
  }

  return results;
}

// ─── Part B: Precision (manual review output) ─────────────────────────────────

interface PrecisionRow {
  file: string;
  rule: string;
  severity: string;
  line: number;
  message: string;
  context: string;
  true_positive: string; // filled manually
}

function runPrecisionBenchmark(
  corpus: Array<{ filename: string; source: string }>,
): PrecisionRow[] {
  const rows: PrecisionRow[] = [];

  for (const { filename, source } of corpus) {
    try {
      const result = analyzeFile(source, filename);
      for (const finding of result.findings) {
        rows.push({
          file: filename,
          rule: finding.ruleId,
          severity: finding.severity,
          line: finding.line,
          message: finding.message,
          context: finding.context ?? '',
          true_positive: '', // you fill this in
        });
      }
    } catch {
      // Skip files that don't parse
    }
  }

  return rows;
}

// ─── Output ───────────────────────────────────────────────────────────────────

function writeCSV(rows: Record<string, unknown>[], path: string): void {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map(row =>
      headers
        .map(h => {
          const val = String(row[h] ?? '');
          return val.includes(',') ? `"${val}"` : val;
        })
        .join(','),
    ),
  ];
  writeFileSync(path, lines.join('\n'));
}

function printRecallResults(results: RecallResult[]): void {
  const byRule: Record<string, { detected: number; total: number }> = {};

  for (const r of results) {
    byRule[r.expectedRule] ??= { detected: 0, total: 0 };
    byRule[r.expectedRule].total++;
    if (r.detected) byRule[r.expectedRule].detected++;
  }

  const totalDetected = results.filter(r => r.detected).length;
  const totalCases = results.length;

  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║           Recall Benchmark (Seeded Issues)          ║');
  console.log('╚════════════════════════════════════════════════════╝\n');

  const C1 = 26;
  console.log(`  ${'Rule'.padEnd(C1)} ${'Cases'.padStart(7)}   ${'Recall'.padStart(8)}`);
  console.log(`  ${'─'.repeat(48)}`);

  for (const [rule, stats] of Object.entries(byRule)) {
    const recall = stats.total === 0 ? 0 : (stats.detected / stats.total) * 100;
    console.log(
      `  ${rule.padEnd(C1)} ${`${stats.detected}/${stats.total}`.padStart(7)}   ${`${recall.toFixed(1)}%`.padStart(8)}`,
    );
  }

  console.log(`  ${'─'.repeat(48)}`);
  const overallRecall = totalCases === 0 ? 0 : (totalDetected / totalCases) * 100;
  console.log(
    `  ${'Overall'.padEnd(C1)} ${`${totalDetected}/${totalCases}`.padStart(7)}   ${`${overallRecall.toFixed(1)}%`.padStart(8)}`,
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  const recallOutPath = join(__dirname, `${suffixed('recall-results')}.csv`);
  const precisionOutPath = join(__dirname, `${suffixed('precision-review')}.csv`);

  console.log('\nLoading corpus...');
  const corpus = loadCorpusFiles();
  console.log(`  ${corpus.length} files loaded from benchmark/${corpusDirName}/`);

  // --- Recall ---
  console.log('\nRunning recall benchmark (seeded issues)...');
  const recallResults = runRecallBenchmark(corpus);
  printRecallResults(recallResults);

  writeCSV(
    recallResults.map(r => ({ ...r, detected: r.detected ? 1 : 0 })),
    recallOutPath,
  );

  // --- Precision ---
  console.log('\nRunning precision benchmark (unmodified files)...');
  const precisionRows = runPrecisionBenchmark(corpus);

  if (precisionRows.length === 0) {
    console.log('  No findings on unmodified corpus files.');
  } else {
    console.log(
      `  Found ${precisionRows.length} findings across ${corpus.length} files.`,
    );
    console.log(
      `\n  ⚠️  Manual step required:`,
    );
    console.log(
      `  Open benchmark/${suffixed('precision-review')}.csv and set true_positive to 1 or 0`,
    );
    console.log(
      `  for each row, then run: npx tsx benchmark/precision.ts ${suffixed('precision-review')}.csv`,
    );
  }

  writeCSV(
    precisionRows as unknown as Record<string, unknown>[],
    precisionOutPath,
  );

  console.log('\n  Output files:');
  console.log(`    ${recallOutPath}`);
  console.log(`    ${precisionOutPath}\n`);
}

main();