/**
 * Evaluation benchmark for the static analysis engine.
 *
 * Runs all analysis rules against a corpus of known-good and known-bad
 * TypeScript snippets and reports detection accuracy per rule.
 *
 * Run with: npm run benchmark
 */

import { analyzeFile } from '../src/services/analysis-service';

// ─── Case definition ──────────────────────────────────────────────────────────

interface BenchmarkCase {
  name: string;
  filename: string;
  source: string;
  // ruleIds that MUST appear in findings
  mustFind: string[];
  // ruleIds that MUST NOT appear in findings
  mustNotFind: string[];
  // If true, failures are noted but not counted against accuracy
  knownLimitation?: boolean;
}

// ─── Source generators ────────────────────────────────────────────────────────

/** Generate a function with `count` if-statements (complexity = count + 1). */
function withIfs(name: string, count: number): string {
  const ifs = Array.from(
    { length: count },
    (_, i) => `  if (x === ${i}) return ${i};`,
  ).join('\n');
  return `function ${name}(x: number): number {\n${ifs}\n  return -1;\n}`;
}

/** Generate a function spanning exactly `totalLines` lines. */
function withLines(name: string, totalLines: number): string {
  const bodyLines = totalLines - 2; // subtract signature + closing brace
  const body = Array.from(
    { length: bodyLines },
    (_, i) => `  const v${i} = ${i};`,
  ).join('\n');
  return `function ${name}() {\n${body}\n}`;
}

/** Generate a function with `levels` of nested if-statements. */
function withNesting(name: string, levels: number): string {
  const params = Array.from(
    { length: levels },
    (_, i) => `a${i}: boolean`,
  ).join(', ');
  const lines: string[] = [`function ${name}(${params}): boolean {`];
  for (let i = 0; i < levels; i++) {
    lines.push(`${'  '.repeat(i + 1)}if (a${i}) {`);
  }
  lines.push(`${'  '.repeat(levels + 1)}return true;`);
  for (let i = levels - 1; i >= 0; i--) {
    lines.push(`${'  '.repeat(i + 1)}}`);
  }
  lines.push('  return false;');
  lines.push('}');
  return lines.join('\n');
}

// ─── Benchmark corpus ─────────────────────────────────────────────────────────

const cases: BenchmarkCase[] = [

  // ── Cyclomatic complexity ────────────────────────────────────────────────
  {
    name: 'CC: simple function — no finding',
    filename: 'test.ts',
    source: 'function add(a: number, b: number) { return a + b; }',
    mustFind: [],
    mustNotFind: ['cyclomatic-complexity'],
  },
  {
    name: 'CC: complexity 11 — warning',
    filename: 'test.ts',
    source: withIfs('highCC', 10),
    mustFind: ['cyclomatic-complexity'],
    mustNotFind: [],
  },
  {
    name: 'CC: complexity 21 — error',
    filename: 'test.ts',
    source: withIfs('veryHighCC', 20),
    mustFind: ['cyclomatic-complexity'],
    mustNotFind: [],
  },

  // ── Function length ──────────────────────────────────────────────────────
  {
    name: 'FL: short function — no finding',
    filename: 'test.ts',
    source: 'function short() { return 1; }',
    mustFind: [],
    mustNotFind: ['function-length'],
  },
  {
    name: 'FL: 51 lines — warning',
    filename: 'test.ts',
    source: withLines('longFunc', 51),
    mustFind: ['function-length'],
    mustNotFind: [],
  },
  {
    name: 'FL: 101 lines — error',
    filename: 'test.ts',
    source: withLines('veryLongFunc', 101),
    mustFind: ['function-length'],
    mustNotFind: [],
  },

  // ── Nesting depth ────────────────────────────────────────────────────────
  {
    name: 'ND: flat function — no finding',
    filename: 'test.ts',
    source: 'function flat(x: number) { return x + 1; }',
    mustFind: [],
    mustNotFind: ['nesting-depth'],
  },
  {
    name: 'ND: depth 5 — warning',
    filename: 'test.ts',
    source: withNesting('deepFunc', 5),
    mustFind: ['nesting-depth'],
    mustNotFind: [],
  },
  {
    name: 'ND: depth 7 — error',
    filename: 'test.ts',
    source: withNesting('veryDeepFunc', 7),
    mustFind: ['nesting-depth'],
    mustNotFind: [],
  },

  // ── Unreachable code ─────────────────────────────────────────────────────
  {
    name: 'UR: normal function — no finding',
    filename: 'test.ts',
    source: 'function foo(x: number) { const y = x + 1; return y; }',
    mustFind: [],
    mustNotFind: ['no-unreachable'],
  },
  {
    name: 'UR: code after return — error',
    filename: 'test.ts',
    source: `function foo() {\n  return 1;\n  const dead = 2;\n}`,
    mustFind: ['no-unreachable'],
    mustNotFind: [],
  },
  {
    name: 'UR: code after throw — error',
    filename: 'test.ts',
    source: `function foo() {\n  throw new Error('oops');\n  return 1;\n}`,
    mustFind: ['no-unreachable'],
    mustNotFind: [],
  },

  // ── Unused variables ─────────────────────────────────────────────────────
  {
    name: 'UV: all variables used — no finding',
    filename: 'test.ts',
    source: 'function foo() { const x = 1; return x; }',
    mustFind: [],
    mustNotFind: ['no-unused-vars'],
  },
  {
    name: 'UV: declared but unused variable — warning',
    filename: 'test.ts',
    source: 'function foo() { const unused = 1; return 0; }',
    mustFind: ['no-unused-vars'],
    mustNotFind: [],
  },
  {
    name: 'UV: closure capture — known false positive',
    filename: 'test.ts',
    source: 'function outer() { const x = 1; const inner = () => x; return inner; }',
    mustFind: [],
    mustNotFind: [],
    knownLimitation: true,
  },

  // ── TODO / FIXME ─────────────────────────────────────────────────────────
  {
    name: 'TF: no comments — no finding',
    filename: 'test.ts',
    source: 'function foo() { return 1; }',
    mustFind: [],
    mustNotFind: ['todo-fixme'],
  },
  {
    name: 'TF: TODO comment — info',
    filename: 'test.ts',
    source: '// TODO: refactor this\nfunction foo() { return 1; }',
    mustFind: ['todo-fixme'],
    mustNotFind: [],
  },
  {
    name: 'TF: FIXME comment — warning',
    filename: 'test.ts',
    source: '// FIXME: this is broken\nfunction foo() { return 1; }',
    mustFind: ['todo-fixme'],
    mustNotFind: [],
  },

];

// ─── Runner ───────────────────────────────────────────────────────────────────

const ALL_RULES = [
  'cyclomatic-complexity',
  'function-length',
  'nesting-depth',
  'no-unreachable',
  'no-unused-vars',
  'todo-fixme',
];

interface RuleStats {
  total: number;
  passed: number;
}

function main(): void {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║       Code Review Platform — Rule Benchmark        ║');
  console.log('╚════════════════════════════════════════════════════╝\n');
  console.log(`  ${cases.length} cases · ${ALL_RULES.length} rules\n`);

  const ruleStats: Record<string, RuleStats> = {};
  for (const rule of ALL_RULES) {
    ruleStats[rule] = { total: 0, passed: 0 };
  }

  const failures: string[] = [];
  const limitations: string[] = [];

  const start = process.hrtime.bigint();

  for (const tc of cases) {
    const result = analyzeFile(tc.source, tc.filename);
    const foundRuleIds = new Set(result.findings.map((f) => f.ruleId));

    for (const ruleId of tc.mustFind) {
      ruleStats[ruleId] ??= { total: 0, passed: 0 };
      ruleStats[ruleId].total++;
      if (foundRuleIds.has(ruleId)) {
        ruleStats[ruleId].passed++;
      } else if (tc.knownLimitation) {
        limitations.push(`  ${tc.name}: expected ${ruleId} finding (known limitation)`);
      } else {
        failures.push(`  FAIL [${tc.name}]: expected ${ruleId} but got none`);
      }
    }

    for (const ruleId of tc.mustNotFind) {
      ruleStats[ruleId] ??= { total: 0, passed: 0 };
      ruleStats[ruleId].total++;
      if (!foundRuleIds.has(ruleId)) {
        ruleStats[ruleId].passed++;
      } else if (tc.knownLimitation) {
        limitations.push(`  ${tc.name}: unexpected ${ruleId} finding (known limitation)`);
      } else {
        failures.push(`  FAIL [${tc.name}]: unexpected ${ruleId} finding`);
      }
    }
  }

  const elapsed = Number(process.hrtime.bigint() - start) / 1_000_000;

  // Print results table
  const C1 = 26;
  const SEP = '─'.repeat(54);

  console.log(`  ${'Rule'.padEnd(C1)} ${'Cases'.padStart(7)}   ${'Accuracy'.padStart(9)}`);
  console.log(`  ${SEP}`);

  let totalPassed = 0;
  let totalCases = 0;

  for (const rule of ALL_RULES) {
    const s = ruleStats[rule] ?? { total: 0, passed: 0 };
    const accuracy = s.total === 0 ? 100 : (s.passed / s.total) * 100;
    totalPassed += s.passed;
    totalCases += s.total;
    console.log(
      `  ${rule.padEnd(C1)} ${`${s.passed}/${s.total}`.padStart(7)}   ${`${accuracy.toFixed(1)}%`.padStart(9)}`,
    );
  }

  console.log(`  ${SEP}`);
  const overall = totalCases === 0 ? 100 : (totalPassed / totalCases) * 100;
  console.log(
    `  ${'Overall'.padEnd(C1)} ${`${totalPassed}/${totalCases}`.padStart(7)}   ${`${overall.toFixed(1)}%`.padStart(9)}`,
  );

  if (limitations.length > 0) {
    console.log('\n  Known limitations (not counted as failures):');
    for (const note of limitations) console.log(note);
  }

  if (failures.length > 0) {
    console.log('\n  Failures:');
    for (const f of failures) console.log(`  ✗ ${f}`);
  } else {
    console.log('\n  ✓ All assertions passed');
  }

  console.log(
    `\n  Latency: ${cases.length} cases in ${elapsed.toFixed(1)}ms` +
    ` (avg ${(elapsed / cases.length).toFixed(1)}ms/case)\n`,
  );

  if (failures.length > 0) process.exit(1);
}

main();