import { describe, it, expect } from 'vitest';
import { parseFile } from '@/analysis/ast/parser';
import { runTodoFixme } from './todo-fixme';

function analyse(source: string) {
  return runTodoFixme(parseFile(source, 'test.ts'));
}

describe('todo-fixme rule', () => {

  it('produces no findings for a file with no todo comments', () => {
    const findings = analyse(`
      function add(a: number, b: number) {
        return a + b;
      }
    `);
    expect(findings).toHaveLength(0);
  });

  it('detects a single-line TODO comment', () => {
    const findings = analyse(`
      // TODO: refactor this function
      function foo() { return 1; }
    `);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('todo-fixme');
    expect(findings[0].severity).toBe('info');
    expect(findings[0].message).toBe('TODO: refactor this function');
  });

  it('gives FIXME a warning severity', () => {
    const findings = analyse(`
      // FIXME: this crashes on null input
      function foo() { return 1; }
    `);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('warning');
    expect(findings[0].message).toBe('FIXME: this crashes on null input');
  });

  it('gives HACK a warning severity', () => {
    const findings = analyse(`
      // HACK: temporary workaround for the API bug
      function foo() { return 1; }
    `);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('warning');
  });

  it('detects TODO inside a block comment', () => {
    const findings = analyse(`
      /* TODO: replace with real implementation */
      function foo() { return 1; }
    `);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('info');
  });

  it('detects multiple TODO comments across the file', () => {
    const findings = analyse(`
      // TODO: first thing
      function foo() {
        // FIXME: second thing
        return 1;
      }
    `);
    expect(findings).toHaveLength(2);
  });

  it('reports the correct line number', () => {
    const findings = analyse(`function foo() {
  // TODO: fix this
  return 1;
}`);
    expect(findings[0].line).toBe(2);
  });

  it('does not match TODO as part of a longer word', () => {
    const findings = analyse(`
      // TODOLIST is a separate concept
      function foo() { return 1; }
    `);
    expect(findings).toHaveLength(0);
  });

});