import type { Finding } from '@/domain/types';
import type { ParsedFile } from '@/analysis/ast/parser';
import { walk } from '@/analysis/ast/visitor';
import { getFunctionName, type FunctionNode } from '@/analysis/ast/utils';

const RULE_ID = 'function-length';

export const FUNCTION_LENGTH_WARNING = 50;
export const FUNCTION_LENGTH_ERROR = 100;

export function runFunctionLength(file: ParsedFile): Finding[] {
  const findings: Finding[] = [];

  walk(file.ast, {
    FunctionDeclaration(node) { check(node, findings); },
    FunctionExpression(node) { check(node, findings); },
    ArrowFunctionExpression(node) { check(node, findings); },
  });

  return findings;
}

function check(node: FunctionNode, findings: Finding[]): void {
  if (!node.loc) return;

  const lineCount = node.loc.end.line - node.loc.start.line + 1;
  if (lineCount <= FUNCTION_LENGTH_WARNING) return;

  const name = getFunctionName(node);
  const severity = lineCount > FUNCTION_LENGTH_ERROR ? 'error' : 'warning';

  findings.push({
    ruleId: RULE_ID,
    severity,
    message: `Function '${name}' is ${lineCount} lines long (threshold: ${FUNCTION_LENGTH_WARNING})`,
    line: node.loc.start.line,
    column: node.loc.start.column,
    context: name,
    value: lineCount,
  });
}