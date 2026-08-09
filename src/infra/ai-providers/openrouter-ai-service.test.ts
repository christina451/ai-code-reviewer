import { describe, it, expect } from 'vitest';
import { parseSSELine } from './openrouter-ai-service';

describe('parseSSELine', () => {

  it('returns null for lines that are not SSE data lines', () => {
    expect(parseSSELine('')).toBeNull();
    expect(parseSSELine('event: message')).toBeNull();
    expect(parseSSELine(': heartbeat')).toBeNull();
  });

  it('returns null for the [DONE] terminator', () => {
    expect(parseSSELine('data: [DONE]')).toBeNull();
  });

  it('extracts text content from a well-formed SSE chunk', () => {
    const line = 'data: {"choices":[{"delta":{"content":"Hello"},"index":0}]}';
    expect(parseSSELine(line)).toBe('Hello');
  });

  it('returns null when the delta has no content field', () => {
    const line = 'data: {"choices":[{"delta":{},"index":0}]}';
    expect(parseSSELine(line)).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(parseSSELine('data: {not valid json')).toBeNull();
  });

  it('returns null when choices array is empty', () => {
    const line = 'data: {"choices":[]}';
    expect(parseSSELine(line)).toBeNull();
  });

  it('handles multi-character content correctly', () => {
    const line = 'data: {"choices":[{"delta":{"content":"Hello, world!"},"index":0}]}';
    expect(parseSSELine(line)).toBe('Hello, world!');
  });

});