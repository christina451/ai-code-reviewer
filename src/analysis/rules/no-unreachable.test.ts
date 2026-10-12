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

  it('does not flag hoisted function declarations after return', () => {
  const findings = analyse(`
    function outer() {
      return inner();
      function inner() { return 1; }
    }
  `);
  expect(findings).toHaveLength(0);
});

  describe('compound statements that always exit', () => {
    it('detects code after an if/else where both branches return', () => {
      const findings = analyse(`function status(done: boolean) {
  if (done) {
    return 'done';
  } else {
    return 'todo';
  }
  return 'unknown';
}`);
      expect(findings).toHaveLength(1);
      expect(findings[0].line).toBe(7);
      expect(findings[0].message).toContain('if/else');
    });

    it('detects code after an else-if chain where every branch exits', () => {
      const findings = analyse(`
        function f(x: number) {
          if (x > 0) { return 1; } else if (x < 0) { throw new Error(); } else { return 0; }
          return 2;
        }
      `);
      expect(findings).toHaveLength(1);
    });

    it('detects code after try { return } finally { }', () => {
      const findings = analyse(`function safe(n: number) {
  try {
    return n;
  } finally {
    console.log('checked');
  }
  return 0;
}`);
      expect(findings).toHaveLength(1);
      expect(findings[0].line).toBe(7);
      expect(findings[0].message).toContain('try/finally');
    });

    it('detects code after a finally block that returns', () => {
      const findings = analyse(`
        function f() {
          try { doWork(); } catch { log(); } finally { return 1; }
          return 2;
        }
      `);
      expect(findings).toHaveLength(1);
    });

    it('detects code after try/catch where both blocks exit', () => {
      const findings = analyse(`
        function f() {
          try { return parse(); } catch { throw new Error('bad'); }
          return null;
        }
      `);
      expect(findings).toHaveLength(1);
    });

    it('does not flag when only one if branch returns', () => {
      const findings = analyse(`
        function next(items: number[]) {
          if (items.length === 0) {
            return undefined;
          } else {
            items.sort();
          }
          return items[0];
        }
      `);
      expect(findings).toHaveLength(0);
    });

    it('does not flag after an if without an else', () => {
      const findings = analyse(`
        function f(x: boolean) {
          if (x) { return 1; }
          return 2;
        }
      `);
      expect(findings).toHaveLength(0);
    });

    it('does not flag after a try that does not return', () => {
      const findings = analyse(`
        function timed(work: () => number) {
          let result: number;
          try { result = work(); } finally { console.info('done'); }
          return result;
        }
      `);
      expect(findings).toHaveLength(0);
    });

    it('does not flag after try { return } with a catch that falls through', () => {
      const findings = analyse(`
        function f() {
          try { return parse(); } catch { log(); }
          return null;
        }
      `);
      expect(findings).toHaveLength(0);
    });

    it('does not flag after a loop or switch containing break', () => {
      const findings = analyse(`
        function f(xs: number[], k: string) {
          for (const x of xs) { if (x) { break; } else { continue; } }
          switch (k) { case 'a': return 1; default: break; }
          return 0;
        }
      `);
      expect(findings).toHaveLength(0);
    });

    it('does not flag after a labeled block exited via break', () => {
      const findings = analyse(`
        function f(x: boolean) {
          block: { if (x) { break block; } else { return 1; } }
          return 2;
        }
      `);
      expect(findings).toHaveLength(0);
    });

    it('does not treat a return inside a nested callback as exiting', () => {
      const findings = analyse(`
        function ids(xs: { ok: boolean }[]) {
          const ok = xs.filter((x) => { if (x.ok) { return true; } else { return false; } });
          return ok;
        }
      `);
      expect(findings).toHaveLength(0);
    });
  });

});
