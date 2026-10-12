import { parse } from '@typescript-eslint/typescript-estree';
import type { TSESTree } from '@typescript-eslint/typescript-estree';

export interface ParsedFile {
  filename: string;
  source: string;
  ast: TSESTree.Program;
  lineCount: number;
}

export class ParseError extends Error {
  constructor(
    message: string,
    public readonly filename: string,
    public readonly line?: number,
  ) {
    super(message);
    this.name = 'ParseError';
  }
}

export function parseFile(source: string, filename: string): ParsedFile {
  try {
    const ast = parse(source, {
      loc: true,
      range: true,
      comment: true,
      jsx: true,
    });

    return {
      filename,
      source,
      ast,
      lineCount: source.split('\n').length,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown parse error';
    // typescript-estree's TSError carries the 1-based line of the failure.
    const line = (err as { lineNumber?: unknown }).lineNumber;
    const at = typeof line === 'number' ? ` (line ${line})` : '';
    throw new ParseError(
      `Failed to parse ${filename}${at}: ${message}`,
      filename,
      typeof line === 'number' ? line : undefined,
    );
  }
}