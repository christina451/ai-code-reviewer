import type { TSESTree } from '@typescript-eslint/typescript-estree';

export type VisitorHandlers = Partial<{
  [K in TSESTree.Node['type']]: (node: Extract<TSESTree.Node, { type: K }>) => void;
}>;

export function walk(
  node: TSESTree.Node | null | undefined,
  handlers: VisitorHandlers,
): void {
  if (!node || typeof node !== 'object') return;

  const handler = handlers[node.type as keyof VisitorHandlers];
  if (handler) {
    (handler as (n: TSESTree.Node) => void)(node);
  }

  for (const key of Object.keys(node)) {
    if (key === 'parent') continue;
    const value = (node as unknown as Record<string, unknown>)[key];

    if (Array.isArray(value)) {
      for (const item of value) {
        if (isASTNode(item)) walk(item, handlers);
      }
    } else if (isASTNode(value)) {
      walk(value, handlers);
    }
  }
}

function isASTNode(value: unknown): value is TSESTree.Node {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof (value as Record<string, unknown>)['type'] === 'string'
  );
}