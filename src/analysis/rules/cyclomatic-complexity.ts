import type { TSESTree } from '@typescript-eslint/typescript-estree';
import type { Finding } from '@/domain/types';
import type { ParsedFile } from '@/analysis/ast/parser';
import type { VisitorHandlers } from '@/analysis/ast/visitor';
import { walk } from '@/analysis/ast/visitor';

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

function getFunctionName(
  node:
    | TSESTree.FunctionDeclaration
    | TSESTree.FunctionExpression
    | TSESTree.ArrowFunctionExpression,
): string {
  if (node.type === 'FunctionDeclaration' && node.id?.name) {
    return node.id.name;
  }

  if (node.type === 'FunctionExpression' && node.id?.name) {
    return node.id.name;
  }

  if (
    node.parent?.type === 'VariableDeclarator' &&
    node.parent.id.type === 'Identifier'
  ) {
    return node.parent.id.name;
  }

  if (
    node.parent?.type === 'Property' &&
    node.parent.key.type === 'Identifier'
  ) {
    return node.parent.key.name;
  }

  if (
    node.parent?.type === 'MethodDefinition' &&
    node.parent.key.type === 'Identifier'
  ) {
    return node.parent.key.name;
  }

  return 'anonymous';
}

function computeComplexityForFunction(
  funcNode:
    | TSESTree.FunctionDeclaration
    | TSESTree.FunctionExpression
    | TSESTree.ArrowFunctionExpression,
): number {
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
    FunctionDeclaration(node) {
      analyzeFunction(node, findings);
    },
    FunctionExpression(node) {
      analyzeFunction(node, findings);
    },
    ArrowFunctionExpression(node) {
      analyzeFunction(node, findings);
    },
  });

  return findings;
}

function analyzeFunction(
  node:
    | TSESTree.FunctionDeclaration
    | TSESTree.FunctionExpression
    | TSESTree.ArrowFunctionExpression,
  findings: Finding[],
): void {
  const complexity = computeComplexityForFunction(node);

  if (complexity <= COMPLEXITY_WARNING_THRESHOLD) return;

  const name = getFunctionName(node);
  const severity = complexity > COMPLEXITY_ERROR_THRESHOLD ? 'error' : 'warning';
  const line = node.loc?.start.line ?? 0;
  const column = node.loc?.start.column ?? 0;

  findings.push({
    ruleId: RULE_ID,
    severity,
    message:
      `Function '${name}' has cyclomatic complexity of ${complexity} ` +
      `(threshold: ${COMPLEXITY_WARNING_THRESHOLD})`,
    line,
    column,
    context: name,
    value: complexity,
  });
}