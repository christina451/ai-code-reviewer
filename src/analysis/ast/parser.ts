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
    throw new ParseError(`Failed to parse ${filename}: ${message}`, filename);
  }
}