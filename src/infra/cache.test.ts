import { describe, it, expect } from 'vitest';
import { buildAnalysisCacheKey } from './cache';

describe('buildAnalysisCacheKey', () => {

  it('returns a string starting with the cache namespace', () => {
    const key = buildAnalysisCacheKey('const x = 1;', 'foo.ts');
    expect(key).toMatch(/^analysis:v1:/);
  });

  it('includes the file extension in the key', () => {
    const tsKey = buildAnalysisCacheKey('const x = 1;', 'foo.ts');
    const jsKey = buildAnalysisCacheKey('const x = 1;', 'foo.js');
    expect(tsKey).not.toBe(jsKey);
  });

  it('produces the same key for identical content regardless of filename', () => {
    const key1 = buildAnalysisCacheKey('const x = 1;', 'foo.ts');
    const key2 = buildAnalysisCacheKey('const x = 1;', 'bar.ts');
    expect(key1).toBe(key2);
  });

  it('produces different keys for different content', () => {
    const key1 = buildAnalysisCacheKey('const x = 1;', 'foo.ts');
    const key2 = buildAnalysisCacheKey('const y = 2;', 'foo.ts');
    expect(key1).not.toBe(key2);
  });

  it('produces a deterministic key for the same input', () => {
    const source = 'function add(a: number, b: number) { return a + b; }';
    const key1 = buildAnalysisCacheKey(source, 'add.ts');
    const key2 = buildAnalysisCacheKey(source, 'add.ts');
    expect(key1).toBe(key2);
  });

  it('handles files with no extension', () => {
    const key = buildAnalysisCacheKey('const x = 1;', 'Makefile');
    expect(key).toContain('analysis:v1:');
  });

});