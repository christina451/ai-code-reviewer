import { describe, it, expect } from 'vitest';
import { parseFile } from '@/analysis/ast/parser';
import {
  runFunctionLength,
  FUNCTION_LENGTH_WARNING,
  FUNCTION_LENGTH_ERROR,
} from './function-length';

function analyse(source: string) {
  return runFunctionLength(parseFile(source, 'test.ts'));
}

function padLines(n: number): string {
  return Array.from({ length: n }, (_, i) => `  const v${i} = ${i};`).join('\n');
}

describe('function-length rule', () => {

  it('produces no findings for a short function', () => {
    const findings = analyse(`
      function short() {
        return 1;
      }
    `);
    expect(findings).toHaveLength(0);
  });

  it('produces no findings at exactly the warning threshold', () => {
    // 1 (signature) + 48 (body) + 1 (closing brace) = 50 lines. 50 > 50 is false.
    const source = `function atThreshold() {\n${padLines(48)}\n}`;
    const findings = analyse(source);
    expect(findings).toHaveLength(0);
  });

  it('produces a warning one line above the threshold', () => {
    // 1 + 49 + 1 = 51 lines. 51 > 50 -> warning.
    const source = `function justOver() {\n${padLines(49)}\n}`;
    const findings = analyse(source);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('warning');
    expect(findings[0].ruleId).toBe('function-length');
    expect(findings[0].value).toBe(51);
    expect(findings[0].context).toBe('justOver');
  });

  it('produces an error above the error threshold', () => {
    // 1 + 99 + 1 = 101 lines. 101 > 100 -> error.
    const source = `function tooLong() {\n${padLines(99)}\n}`;
    const findings = analyse(source);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('error');
    expect(findings[0].value).toBe(101);
  });

  it('correctly identifies arrow function names', () => {
    const source = `const myArrow = () => {\n${padLines(49)}\n};`;
    const findings = analyse(source);
    expect(findings[0].context).toBe('myArrow');
  });

  it('reports the correct starting line number', () => {
    const source = `\nfunction lineCheck() {\n${padLines(49)}\n}`;
    const findings = analyse(source);
    expect(findings[0].line).toBe(2);
  });

});