import { describe, it, expect } from 'vitest';
import { parseFile } from '@/analysis/ast/parser';
import { runNestingDepth } from './nesting-depth';

function analyse(source: string) {
  return runNestingDepth(parseFile(source, 'test.ts'));
}

describe('nesting-depth rule', () => {

  it('produces no findings for a flat function', () => {
    const findings = analyse(`
      function flat(x: number) {
        const y = x + 1;
        return y;
      }
    `);
    expect(findings).toHaveLength(0);
  });

  it('produces no findings at exactly the warning threshold (4 levels)', () => {
    const findings = analyse(`
      function fourDeep(a: boolean, b: boolean, c: boolean, d: boolean) {
        if (a) {
          if (b) {
            if (c) {
              if (d) {
                return true;
              }
            }
          }
        }
        return false;
      }
    `);
    expect(findings).toHaveLength(0);
  });

  it('produces a warning at 5 levels deep', () => {
    const findings = analyse(`
      function fiveDeep(a: boolean, b: boolean, c: boolean, d: boolean, e: boolean) {
        if (a) {
          if (b) {
            if (c) {
              if (d) {
                if (e) {
                  return true;
                }
              }
            }
          }
        }
        return false;
      }
    `);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('warning');
    expect(findings[0].ruleId).toBe('nesting-depth');
    expect(findings[0].value).toBe(5);
    expect(findings[0].context).toBe('fiveDeep');
  });

  it('produces an error above the error threshold', () => {
    const findings = analyse(`
      function sevenDeep(a: boolean, b: boolean, c: boolean, d: boolean, e: boolean, f: boolean, g: boolean) {
        if (a) { if (b) { if (c) { if (d) { if (e) { if (f) { if (g) {
          return true;
        } } } } } } }
        return false;
      }
    `);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('error');
    expect(findings[0].value).toBe(7);
  });

  it('counts mixed control flow constructs', () => {
    const findings = analyse(`
      function mixedNesting(a: boolean) {
        if (a) {
          for (let i = 0; i < 10; i++) {
            while (a) {
              if (a) {
                if (a) {
                  return true;
                }
              }
            }
          }
        }
        return false;
      }
    `);
    expect(findings).toHaveLength(1);
    expect(findings[0].value).toBe(5);
  });

  it('does NOT count nested function depth in the outer function', () => {
    const findings = analyse(`
      function outer() {
        const inner = (a: boolean, b: boolean, c: boolean, d: boolean, e: boolean) => {
          if (a) {
            if (b) {
              if (c) {
                if (d) {
                  if (e) {
                    return true;
                  }
                }
              }
            }
          }
          return false;
        };
        return inner;
      }
    `);
    expect(findings).toHaveLength(1);
    expect(findings[0].context).toBe('inner');
  });

});