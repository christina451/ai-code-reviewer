import { describe, it, expect } from 'vitest';
import { parseFile } from '@/analysis/ast/parser';
import {
  runCyclomaticComplexity,
  COMPLEXITY_WARNING_THRESHOLD,
  COMPLEXITY_ERROR_THRESHOLD,
} from './cyclomatic-complexity';

function analyse(source: string) {
  return runCyclomaticComplexity(parseFile(source, 'test.ts'));
}

describe('cyclomatic-complexity rule', () => {

  it('produces no findings for a simple function (complexity = 1)', () => {
    const findings = analyse(`
      function add(a: number, b: number) {
        return a + b;
      }
    `);
    expect(findings).toHaveLength(0);
  });

  it('produces no findings at exactly the warning threshold', () => {
    const ifs = Array.from({ length: 9 }, (_, i) => `if (x === ${i}) return ${i};`).join('\n');
    const findings = analyse(`
      function atThreshold(x: number) {
        ${ifs}
        return -1;
      }
    `);
    expect(findings).toHaveLength(0);
  });

  it('produces a warning finding one above the threshold', () => {
    const ifs = Array.from({ length: 10 }, (_, i) => `if (x === ${i}) return ${i};`).join('\n');
    const findings = analyse(`
      function justOver(x: number) {
        ${ifs}
        return -1;
      }
    `);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('warning');
    expect(findings[0].ruleId).toBe('cyclomatic-complexity');
    expect(findings[0].value).toBe(11);
    expect(findings[0].context).toBe('justOver');
  });

  it('produces an error finding above the error threshold', () => {
    const ifs = Array.from({ length: 20 }, (_, i) => `if (x === ${i}) return ${i};`).join('\n');
    const findings = analyse(`
      function tooComplex(x: number) {
        ${ifs}
        return -1;
      }
    `);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('error');
    expect(findings[0].value).toBe(21);
  });

  it('counts logical operators (&&, ||) as branching points', () => {
    // 11 expressions joined by 10 && operators = complexity 11
    const ops = Array.from({ length: 11 }, (_, i) => `x !== ${i}`).join(' && ');
    const findings = analyse(`
      function logicalBranches(x: number) {
        return ${ops};
      }
    `);
    expect(findings).toHaveLength(1);
    expect(findings[0].value).toBe(11);
  });

  it('counts ternary expressions as branching points', () => {
    const ternaries = Array.from({ length: 10 }, (_, i) =>
      `const v${i} = x === ${i} ? ${i} : -1;`
    ).join('\n');
    const findings = analyse(`
      function ternaryBranches(x: number) {
        ${ternaries}
        return x;
      }
    `);
    expect(findings).toHaveLength(1);
    expect(findings[0].value).toBe(11);
  });

  it('does NOT count nested function complexity in the outer function', () => {
    const ifs = Array.from({ length: 10 }, (_, i) => `if (x === ${i}) return ${i};`).join('\n');
    const findings = analyse(`
      function outer() {
        const inner = (x: number) => {
          ${ifs}
          return -1;
        };
        return inner;
      }
    `);
    expect(findings).toHaveLength(1);
    expect(findings[0].context).toBe('inner');
  });

  it('reports separate findings for multiple complex functions', () => {
    const ifs = Array.from({ length: 10 }, (_, i) => `if (x === ${i}) return ${i};`).join('\n');
    const findings = analyse(`
      function alpha(x: number) { ${ifs} return -1; }
      function beta(x: number)  { ${ifs} return -1; }
    `);
    expect(findings).toHaveLength(2);
    const names = findings.map(f => f.context);
    expect(names).toContain('alpha');
    expect(names).toContain('beta');
  });

  it('correctly identifies the function name for arrow functions', () => {
    const ifs = Array.from({ length: 10 }, (_, i) => `if (x === ${i}) return ${i};`).join('\n');
    const findings = analyse(`
      const myArrow = (x: number) => {
        ${ifs}
        return -1;
      };
    `);
    expect(findings[0].context).toBe('myArrow');
  });

  it('includes the correct line number in the finding', () => {
    const ifs = Array.from({ length: 10 }, (_, i) => `if (x === ${i}) return ${i};`).join('\n');
    const findings = analyse(`
      function lineCheck(x: number) {
        ${ifs}
        return -1;
      }
    `);
    expect(findings[0].line).toBe(2);
  });

});