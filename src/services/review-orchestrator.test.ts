import { describe, it, expect } from 'vitest';
import { ReviewOrchestrator } from './review-orchestrator';
import type { AIService } from './ai-service';
import type { AnalysisResult } from '@/domain/types';

// Minimal AnalysisResult fixture — only needs to satisfy the type.
const mockResult: AnalysisResult = {
  filename: 'test.ts',
  language: 'TypeScript',
  lineCount: 5,
  summary: { totalFindings: 0, errors: 0, warnings: 0, infos: 0 },
  findings: [],
  functions: [],
};

/** Collect all tokens from an AsyncIterable into an array. */
async function collectTokens(iterable: AsyncIterable<string>): Promise<string[]> {
  const tokens: string[] = [];
  for await (const token of iterable) tokens.push(token);
  return tokens;
}

describe('ReviewOrchestrator', () => {

  it('yields all tokens from the AI service in order', async () => {
    const mockAI: AIService = {
      async *generateReview() {
        yield 'Hello';
        yield ', ';
        yield 'world';
      },
    };

    const orchestrator = new ReviewOrchestrator(mockAI);
    const tokens = await collectTokens(
      orchestrator.generateReview(mockResult, 'const x = 1;'),
    );

    expect(tokens).toEqual(['Hello', ', ', 'world']);
  });

  it('yields nothing when the AI service yields nothing', async () => {
    const mockAI: AIService = {
      async *generateReview() { /* intentionally empty */ },
    };

    const orchestrator = new ReviewOrchestrator(mockAI);
    const tokens = await collectTokens(
      orchestrator.generateReview(mockResult, 'const x = 1;'),
    );

    expect(tokens).toHaveLength(0);
  });

  it('propagates errors thrown by the AI service', async () => {
    const mockAI: AIService = {
      async *generateReview() {
        throw new Error('API quota exceeded');
        yield ''; // unreachable — required for TypeScript to infer the return type
      },
    };

    const orchestrator = new ReviewOrchestrator(mockAI);

    await expect(
      collectTokens(orchestrator.generateReview(mockResult, 'const x = 1;')),
    ).rejects.toThrow('API quota exceeded');
  });

  it('passes the correct request shape to the AI service', async () => {
    let capturedSource = '';

    const mockAI: AIService = {
      async *generateReview(request) {
        capturedSource = request.source;
        yield 'ok';
      },
    };

    const orchestrator = new ReviewOrchestrator(mockAI);
    await collectTokens(orchestrator.generateReview(mockResult, 'const x = 42;'));

    expect(capturedSource).toBe('const x = 42;');
  });

});