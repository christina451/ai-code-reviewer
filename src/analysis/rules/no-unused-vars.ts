import type { TSESTree } from '@typescript-eslint/typescript-estree';
import type { Finding } from '@/domain/types';
import type { ParsedFile } from '@/analysis/ast/parser';
import { walk } from '@/analysis/ast/visitor';
import { getFunctionName, type FunctionNode } from '@/analysis/ast/utils';

const RULE_ID = 'no-unused-vars';

interface VarDeclaration {
  name: string;
  line: number;
  column: number;
}

export function runNoUnusedVars(file: ParsedFile): Finding[] {
  const findings: Finding[] = [];

  walk(file.ast, {
    FunctionDeclaration(node) { checkFunction(node, findings); },
    FunctionExpression(node) { checkFunction(node, findings); },
    ArrowFunctionExpression(node) { checkFunction(node, findings); },
  });

  return findings;
}

function checkFunction(node: FunctionNode, findings: Finding[]): void {
  if (!node.body) return;

  // Pass 1: collect variable declarations (const/let/var).
  // Parameters are excluded deliberately — unused params are common
  // in callbacks and interface conformance.
  const declared: VarDeclaration[] = [];

  walk(node.body, {
    VariableDeclarator(declarator) {
      if (declarator.id.type === 'Identifier') {
        declared.push({
          name: declarator.id.name,
          line: declarator.id.loc?.start.line ?? 0,
          column: declarator.id.loc?.start.column ?? 0,
        });
      }
    },
    FunctionDeclaration: () => 'skip',
    FunctionExpression: () => 'skip',
    ArrowFunctionExpression: () => 'skip',
  });

  if (declared.length === 0) return;

  // Pass 2: collect all identifier references.
  const referenced = new Set<string>();

  walk(node.body, {
    Identifier(id) {
      // Skip the declaration site itself — VariableDeclarator.id
      if (
        id.parent?.type === 'VariableDeclarator' &&
        (id.parent as TSESTree.VariableDeclarator).id === (id as TSESTree.Node)
      ) {
        return;
      }
      referenced.add(id.name);
    },
    FunctionDeclaration: () => 'skip',
    FunctionExpression: () => 'skip',
    ArrowFunctionExpression: () => 'skip',
  });

  // Report any declaration with no matching reference.
  const functionName = getFunctionName(node);

  for (const decl of declared) {
    if (!referenced.has(decl.name)) {
      findings.push({
        ruleId: RULE_ID,
        severity: 'warning',
        message: `Variable '${decl.name}' is declared but never used`,
        line: decl.line,
        column: decl.column,
        context: functionName,
      });
    }
  }
}