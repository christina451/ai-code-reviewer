import { parseFile } from '@/analysis/ast/parser';
import { runCyclomaticComplexity } from '@/analysis/rules/cyclomatic-complexity';
import { runFunctionLength } from '@/analysis/rules/function-length';
import { runNestingDepth } from '@/analysis/rules/nesting-depth';
import { runTodoFixme } from '@/analysis/rules/todo-fixme';
import { runNoUnreachable } from '@/analysis/rules/no-unreachable';
import { runNoUnusedVars } from '@/analysis/rules/no-unused-vars';
import { collectFunctionMetrics } from '@/analysis/rules/metrics';
import type { AnalysisResult, Finding } from '@/domain/types';

// Re-export ParseError so API routes only need to import from this service,
// not reach into the parser directly.
export { ParseError } from '@/analysis/ast/parser';

/**
 * Infer a human-readable language name from the file extension.
 * Sent to the LLM so it generates language-appropriate suggestions.
 */
function inferLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'TypeScript',
    tsx: 'TypeScript (React)',
    js: 'JavaScript',
    jsx: 'JavaScript (React)',
    mjs: 'JavaScript (ESM)',
    cjs: 'JavaScript (CommonJS)',
  };
  return map[ext] ?? 'Unknown';
}

/**
 * Run the full deterministic analysis pipeline against a single source file.
 *
 * Steps:
 *   1. Parse the source into an AST.
 *   2. Run all static analysis rules — each returns Finding[].
 *   3. Collect per-function metrics for every function (not just violations).
 *   4. Assemble and return the AnalysisResult.
 *
 * Throws ParseError if the source has a syntax error. API routes should
 * catch this and return a 422 so the user knows the file was rejected at
 * parse time, not silently producing zero findings.
 */
export function analyzeFile(source: string, filename: string): AnalysisResult {
  // Step 1: parse — throws ParseError on syntax failure.
  const file = parseFile(source, filename);

  // Step 2: run all rules and merge findings into a single array.
  const findings: Finding[] = [
    ...runCyclomaticComplexity(file),
    ...runFunctionLength(file),
    ...runNestingDepth(file),
    ...runTodoFixme(file),
    ...runNoUnreachable(file),
    ...runNoUnusedVars(file),
  ];

  // Sort by line then column so findings follow source reading order.
  // This makes LLM output more coherent — it naturally narrates top to bottom.
  findings.sort((a, b) => a.line - b.line || a.column - b.column);

  const errors   = findings.filter(f => f.severity === 'error').length;
  const warnings = findings.filter(f => f.severity === 'warning').length;
  const infos    = findings.filter(f => f.severity === 'info').length;

  // Step 3: collect per-function metrics.
  const functions = collectFunctionMetrics(file);

  // Step 4: assemble the result.
  return {
    filename,
    language: inferLanguage(filename),
    lineCount: file.lineCount,
    summary: {
      totalFindings: findings.length,
      errors,
      warnings,
      infos,
    },
    findings,
    functions,
  };
}