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
  let terminatorLabel: string | null = null;

  for (const statement of node.body) {
    if (terminatorLabel !== null) {
      if (statement.type === 'FunctionDeclaration') continue;

      findings.push({
        ruleId: RULE_ID,
        severity: 'error',
        message: `Unreachable code after '${terminatorLabel}'`,
        line: statement.loc?.start.line ?? 0,
        column: statement.loc?.start.column ?? 0,
      });
      break;
    }

    terminatorLabel = exitLabel(statement);
  }
}

/**
 * Returns a label if control can never fall through `statement` to the
 * next one, or null if it might. Deliberately conservative: anything not
 * handled here (loops, switch, labeled statements) is assumed to fall
 * through, so it can cause a missed finding but never a false positive.
 * A `break` inside a loop or switch only exits that construct, which is
 * why those are not analysed.
 */
function exitLabel(statement: TSESTree.Statement): string | null {
  if (TERMINATOR_TYPES.has(statement.type)) {
    return TERMINATOR_LABELS[statement.type];
  }

  switch (statement.type) {
    case 'BlockStatement': {
      for (const inner of statement.body) {
        const label = exitLabel(inner);
        if (label !== null) return label;
      }
      return null;
    }

    case 'IfStatement':
      // Without an else, the false path always falls through.
      return statement.alternate !== null &&
        exitLabel(statement.consequent) !== null &&
        exitLabel(statement.alternate) !== null
        ? 'if/else'
        : null;

    case 'TryStatement': {
      // A finally that exits overrides whatever try/catch did.
      if (statement.finalizer && exitLabel(statement.finalizer) !== null) {
        return 'finally';
      }
      // Otherwise the finally runs and then the try's exit proceeds — but
      // a catch that can complete normally makes the code after reachable.
      const tryExits = exitLabel(statement.block) !== null;
      const catchExits = statement.handler === null || exitLabel(statement.handler.body) !== null;
      if (!tryExits || !catchExits) return null;
      return statement.handler ? 'try/catch' : 'try/finally';
    }

    default:
      return null;
  }
}