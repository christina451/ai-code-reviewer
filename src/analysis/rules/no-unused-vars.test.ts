import { describe, it, expect } from 'vitest';
import { parseFile } from '@/analysis/ast/parser';
import { runNoUnusedVars } from './no-unused-vars';

function analyse(source: string) {
  return runNoUnusedVars(parseFile(source, 'test.ts'));
}

describe('no-unused-vars rule', () => {

  it('produces no findings when all variables are used', () => {
    const findings = analyse(`
      function foo(x: number) {
        const y = x + 1;
        return y;
      }
    `);
    expect(findings).toHaveLength(0);
  });

  it('flags a variable that is declared but never referenced', () => {
    const findings = analyse(`
      function foo() {
        const unused = 42;
        return 1;
      }
    `);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('no-unused-vars');
    expect(findings[0].severity).toBe('warning');
    expect(findings[0].message).toContain('unused');
  });

  it('does not flag a variable used in a return statement', () => {
    const findings = analyse(`
      function foo() {
        const result = 42;
        return result;
      }
    `);
    expect(findings).toHaveLength(0);
  });

  it('does not flag a variable used in an expression', () => {
    const findings = analyse(`
      function foo(x: number) {
        const multiplier = 3;
        return x * multiplier;
      }
    `);
    expect(findings).toHaveLength(0);
  });

  it('flags multiple unused variables in one function', () => {
    const findings = analyse(`
      function foo() {
        const a = 1;
        const b = 2;
        const c = 3;
        return 0;
      }
    `);
    expect(findings).toHaveLength(3);
    const messages = findings.map(f => f.message);
    expect(messages.some(m => m.includes("'a'"))).toBe(true);
    expect(messages.some(m => m.includes("'b'"))).toBe(true);
    expect(messages.some(m => m.includes("'c'"))).toBe(true);
  });

  it('does not flag function parameters', () => {
    const findings = analyse(`
      function foo(unusedParam: number) {
        return 42;
      }
    `);
    expect(findings).toHaveLength(0);
  });

  it('reports findings in the correct function context', () => {
    const findings = analyse(`
      function myFunction() {
        const x = 1;
        return 0;
      }
    `);
    expect(findings[0].context).toBe('myFunction');
  });

  it('known limitation: false positive when variable is only used in a closure', () => {
    // Our simplified scope analysis stops at function boundaries.
    // x IS used inside inner, but we incorrectly flag it as unused.
    const findings = analyse(`
      function outer() {
        const x = 1;
        const inner = () => x;
        return inner;
      }
    `);
    expect(findings.some(f => f.message.includes("'x'"))).toBe(true);
  });

});