import type { FunctionMetrics } from '@/domain/types';
import type { ParsedFile } from '@/analysis/ast/parser';
import { walk } from '@/analysis/ast/visitor';
import { getFunctionName, type FunctionNode } from '@/analysis/ast/utils';
import { computeFunctionComplexity } from './cyclomatic-complexity';
import { computeFunctionNestingDepth } from './nesting-depth';

/**
 * Collect numeric metrics for every function in the file — not just those
 * that exceeded a rule threshold. This gives the LLM the full picture when
 * estimating maintainability, not just a list of violations.
 */
export function collectFunctionMetrics(file: ParsedFile): FunctionMetrics[] {
  const metrics: FunctionMetrics[] = [];

  walk(file.ast, {
    FunctionDeclaration(node) { collect(node, metrics); },
    FunctionExpression(node) { collect(node, metrics); },
    ArrowFunctionExpression(node) { collect(node, metrics); },
  });

  return metrics;
}

function collect(node: FunctionNode, metrics: FunctionMetrics[]): void {
  if (!node.loc) return;

  metrics.push({
    name: getFunctionName(node),
    startLine: node.loc.start.line,
    lineCount: node.loc.end.line - node.loc.start.line + 1,
    cyclomaticComplexity: computeFunctionComplexity(node),
    maxNestingDepth: computeFunctionNestingDepth(node),
  });
}