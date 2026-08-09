import type { TSESTree } from '@typescript-eslint/typescript-estree';
import type { Finding } from '@/domain/types';
import type { ParsedFile } from '@/analysis/ast/parser';
import type { VisitorHandlers } from '@/analysis/ast/visitor';
import { walk } from '@/analysis/ast/visitor';
import { getFunctionName, type FunctionNode } from '@/analysis/ast/utils';

const RULE_ID = 'cyclomatic-complexity';

export const COMPLEXITY_WARNING_THRESHOLD = 10;
export const COMPLEXITY_ERROR_THRESHOLD = 20;

const BRANCHING_NODE_TYPES = new Set([
  'IfStatement',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
  'CatchClause',
  'ConditionalExpression',
  'LogicalExpression',
  'SwitchCase',
]);

export function computeFunctionComplexity(funcNode: FunctionNode): number {
  let complexity = 1;
  const body = funcNode.body;
  if (!body) return complexity;

  walk(body, {
    ...(Object.fromEntries(
      [...BRANCHING_NODE_TYPES].map((type) => [
        type,
        () => { complexity++; },
      ]),
    ) as VisitorHandlers),
    FunctionDeclaration: () => 'skip',
    FunctionExpression: () => 'skip',
    ArrowFunctionExpression: () => 'skip',
  });

  return complexity;
}

export function runCyclomaticComplexity(file: ParsedFile): Finding[] {
  const findings: Finding[] = [];

  walk(file.ast, {
    FunctionDeclaration(node) { analyzeFunction(node, findings); },
    FunctionExpression(node) { analyzeFunction(node, findings); },
    ArrowFunctionExpression(node) { analyzeFunction(node, findings); },
  });

  return findings;
}

function analyzeFunction(node: FunctionNode, findings: Finding[]): void {
  const complexity = computeFunctionComplexity(node);
  if (complexity <= COMPLEXITY_WARNING_THRESHOLD) return;

  const name = getFunctionName(node);
  const severity = complexity > COMPLEXITY_ERROR_THRESHOLD ? 'error' : 'warning';

  findings.push({
    ruleId: RULE_ID,
    severity,
    message:
      `Function '${name}' has cyclomatic complexity of ${complexity} ` +
      `(threshold: ${COMPLEXITY_WARNING_THRESHOLD})`,
    line: node.loc?.start.line ?? 0,
    column: node.loc?.start.column ?? 0,
    context: name,
    value: complexity,
  });
}