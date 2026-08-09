import { describe, it, expect } from 'vitest';
import { analyzeFile, ParseError } from './analysis-service';

describe('analyzeFile (integration)', () => {

  it('returns zero findings for a clean, simple file', () => {
    const result = analyzeFile(`
      function add(a: number, b: number): number {
        return a + b;
      }
    `, 'add.ts');

    expect(result.summary.totalFindings).toBe(0);
    expect(result.summary.errors).toBe(0);
    expect(result.summary.warnings).toBe(0);
  });

  it('infers the language from the filename extension', () => {
    const ts  = analyzeFile('const x = 1;', 'foo.ts');
    const tsx = analyzeFile('const x = 1;', 'foo.tsx');
    const js  = analyzeFile('const x = 1;', 'foo.js');

    expect(ts.language).toBe('TypeScript');
    expect(tsx.language).toBe('TypeScript (React)');
    expect(js.language).toBe('JavaScript');
  });

  it('reports the correct line count', () => {
    const source = 'const a = 1;\nconst b = 2;\nconst c = 3;';
    const result = analyzeFile(source, 'test.ts');
    expect(result.lineCount).toBe(3);
  });

  it('collects findings from multiple rules in one pass', () => {
    const source = `
      function messy(x: number) {
        // TODO: clean this up
        return x;
        const dead = 1;
      }
    `;
    const result = analyzeFile(source, 'messy.ts');

    const ruleIds = result.findings.map(f => f.ruleId);
    expect(ruleIds).toContain('todo-fixme');
    expect(ruleIds).toContain('no-unreachable');
  });

  it('summary counts match the actual findings array', () => {
    const source = `
      function messy(x: number) {
        // TODO: clean this up
        return x;
        const dead = 1;
      }
    `;
    const result = analyzeFile(source, 'messy.ts');

    const actualErrors   = result.findings.filter(f => f.severity === 'error').length;
    const actualWarnings = result.findings.filter(f => f.severity === 'warning').length;
    const actualInfos    = result.findings.filter(f => f.severity === 'info').length;

    expect(result.summary.errors).toBe(actualErrors);
    expect(result.summary.warnings).toBe(actualWarnings);
    expect(result.summary.infos).toBe(actualInfos);
    expect(result.summary.totalFindings).toBe(result.findings.length);
  });

  it('sorts findings by line number ascending', () => {
    // TODO on line 2, unreachable code on line 5 — should be in that order
    const source = `function foo() {
  // TODO: fix this
  const x = 1;
  return x;
  const dead = 2;
}`;
    const result = analyzeFile(source, 'test.ts');
    const lines = result.findings.map(f => f.line);

    for (let i = 1; i < lines.length; i++) {
      expect(lines[i]).toBeGreaterThanOrEqual(lines[i - 1]);
    }
  });

  it('collects function metrics for every function', () => {
    const result = analyzeFile(`
      function alpha() { return 1; }
      function beta()  { return 2; }
    `, 'test.ts');

    expect(result.functions).toHaveLength(2);
    const names = result.functions.map(f => f.name);
    expect(names).toContain('alpha');
    expect(names).toContain('beta');
  });

  it('function metrics include correct complexity and depth', () => {
    const result = analyzeFile(`
      function simple(a: boolean) {
        if (a) return 1;
        return 2;
      }
    `, 'test.ts');

    const fn = result.functions[0];
    expect(fn.name).toBe('simple');
    expect(fn.cyclomaticComplexity).toBe(2); // 1 base + 1 if
    expect(fn.maxNestingDepth).toBe(1);      // one level of nesting
  });

  it('throws ParseError on a syntax error in the source', () => {
    expect(() => analyzeFile('function broken( {', 'bad.ts'))
      .toThrow(ParseError);
  });

  it('includes filename in the result', () => {
    const result = analyzeFile('const x = 1;', 'my-file.ts');
    expect(result.filename).toBe('my-file.ts');
  });

});