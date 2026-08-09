import { describe, it, expect } from 'vitest';
import { parseFile } from '@/analysis/ast/parser';
import { runNoUnreachable } from './no-unreachable';

function analyse(source: string) {
  return runNoUnreachable(parseFile(source, 'test.ts'));
}

describe('no-unreachable rule', () => {

  it('produces no findings for a normal function', () => {
    const findings = analyse(`
      function foo(x: number) {
        const y = x + 1;
        return y;
      }
    `);
    expect(findings).toHaveLength(0);
  });

  it('detects code after a return statement', () => {
    const findings = analyse(`
      function foo() {
        return 1;
        const x = 2;
      }
    `);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('no-unreachable');
    expect(findings[0].severity).toBe('error');
    expect(findings[0].message).toContain('return');
  });

  it('detects code after a throw statement', () => {
    const findings = analyse(`
      function foo() {
        throw new Error('oops');
        return 1;
      }
    `);
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain('throw');
  });

  it('only reports the first unreachable statement per block', () => {
    const findings = analyse(`
      function foo() {
        return 1;
        const a = 2;
        const b = 3;
        const c = 4;
      }
    `);
    expect(findings).toHaveLength(1);
  });

  it('does not flag code before a return', () => {
    const findings = analyse(`
      function foo(x: number) {
        const a = x + 1;
        const b = a * 2;
        return b;
      }
    `);
    expect(findings).toHaveLength(0);
  });

  it('detects unreachable code inside an if branch', () => {
    const findings = analyse(`
      function foo(x: number) {
        if (x > 0) {
          return x;
          const dead = 1;
        }
        return -1;
      }
    `);
    expect(findings).toHaveLength(1);
  });

  it('reports the correct line number of the unreachable statement', () => {
    const findings = analyse(`function foo() {
  return 1;
  const x = 2;
}`);
    expect(findings[0].line).toBe(3);
  });

});