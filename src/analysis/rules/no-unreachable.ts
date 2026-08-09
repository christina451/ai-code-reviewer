import type { TSESTree } from '@typescript-eslint/typescript-estree';
import type { Finding } from '@/domain/types';
import type { ParsedFile } from '@/analysis/ast/parser';
import { walk } from '@/analysis/ast/visitor';

const RULE_ID = 'no-unreachable';

const TERMINATOR_TYPES = new Set([
  'ReturnStatement',
  'ThrowStatement',
  'BreakStatement',
  'ContinueStatement',
]);

const TERMINATOR_LABELS: Record<string, string> = {
  ReturnStatement: 'return',
  ThrowStatement: 'throw',
  BreakStatement: 'break',
  ContinueStatement: 'continue',
};

export function runNoUnreachable(file: ParsedFile): Finding[] {
  const findings: Finding[] = [];

  walk(file.ast, {
    BlockStatement(node) {
      checkBlock(node, findings);
    },
  });

  return findings;
}

function checkBlock(
  node: TSESTree.BlockStatement,
  findings: Finding[],
): void {
  let terminatorType: string | null = null;

  for (const statement of node.body) {
    if (terminatorType !== null) {
      findings.push({
        ruleId: RULE_ID,
        severity: 'error',
        message: `Unreachable code after '${TERMINATOR_LABELS[terminatorType] ?? terminatorType}'`,
        line: statement.loc?.start.line ?? 0,
        column: statement.loc?.start.column ?? 0,
      });
      break;
    }

    if (TERMINATOR_TYPES.has(statement.type)) {
      terminatorType = statement.type;
    }
  }
}