import type { TSESTree } from '@typescript-eslint/typescript-estree';

export type FunctionNode =
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression
  | TSESTree.ArrowFunctionExpression;

export function getFunctionName(node: FunctionNode): string {
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