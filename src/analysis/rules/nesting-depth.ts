import type { TSESTree } from '@typescript-eslint/typescript-estree';
import type { Finding } from '@/domain/types';
import type { ParsedFile } from '@/analysis/ast/parser';
import { walk } from '@/analysis/ast/visitor';
import { getFunctionName, type FunctionNode } from '@/analysis/ast/utils';

const RULE_ID = 'nesting-depth';

export const NESTING_WARNING_THRESHOLD = 4;
export const NESTING_ERROR_THRESHOLD = 6;

const NESTING_TYPES = new Set([
  'IfStatement',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
  'SwitchStatement',
  'TryStatement',
]);

const FUNCTION_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
]);

function isASTNode(value: unknown): value is TSESTree.Node {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof (value as Record<string, unknown>)['type'] === 'string'
  );
}

function measureMaxDepth(node: TSESTree.Node, currentDepth: number): number {
  const depth = NESTING_TYPES.has(node.type) ? currentDepth + 1 : currentDepth;
  let max = depth;

  for (const key of Object.keys(node)) {
    if (key === 'parent') continue;
    const value = (node as unknown as Record<string, unknown>)[key];

    if (Array.isArray(value)) {
      for (const item of value) {
        if (!isASTNode(item) || FUNCTION_TYPES.has(item.type)) continue;
        max = Math.max(max, measureMaxDepth(item, depth));
      }
    } else if (isASTNode(value) && !FUNCTION_TYPES.has(value.type)) {
      max = Math.max(max, measureMaxDepth(value, depth));
    }
  }

  return max;
}

export function runNestingDepth(file: ParsedFile): Finding[] {
  const findings: Finding[] = [];

  walk(file.ast, {
    FunctionDeclaration(node) { check(node, findings); },
    FunctionExpression(node) { check(node, findings); },
    ArrowFunctionExpression(node) { check(node, findings); },
  });

  return findings;
}

function check(node: FunctionNode, findings: Finding[]): void {
  if (!node.body || !node.loc) return;

  const maxDepth = measureMaxDepth(node.body, 0);
  if (maxDepth <= NESTING_WARNING_THRESHOLD) return;

  const name = getFunctionName(node);
  const severity = maxDepth > NESTING_ERROR_THRESHOLD ? 'error' : 'warning';

  findings.push({
    ruleId: RULE_ID,
    severity,
    message: `Function '${name}' has a maximum nesting depth of ${maxDepth} (threshold: ${NESTING_WARNING_THRESHOLD})`,
    line: node.loc.start.line,
    column: node.loc.start.column,
    context: name,
    value: maxDepth,
  });
}