import { describe, it, expect, vi } from 'vitest';
import { ReviewOrchestrator } from './review-orchestrator';
import type { AIService } from './ai-service';
import type { ReviewRepository } from './review-repository';
import type { AnalysisResult, Review } from '@/domain/types';

const mockResult: AnalysisResult = {
  filename: 'test.ts',
  language: 'TypeScript',
  lineCount: 5,
  summary: { totalFindings: 0, errors: 0, warnings: 0, infos: 0 },
  findings: [],
  functions: [],
};

const mockReview: Review = {
  id: 'test-uuid',
  filename: 'test.ts',
  language: 'TypeScript',
  lineCount: 5,
  analysisResult: mockResult,
  reviewText: null,
  status: 'pending',
  errorMessage: null,
  createdAt: new Date(),
  completedAt: null,
};

function makeMockRepository(overrides?: Partial<ReviewRepository>): ReviewRepository {
  return {
    create: vi.fn().mockResolvedValue(mockReview),
    findById: vi.fn().mockResolvedValue(mockReview),
    findRecent: vi.fn().mockResolvedValue([mockReview]),
    markComplete: vi.fn().mockResolvedValue({ ...mockReview, status: 'complete' }),
    markError: vi.fn().mockResolvedValue({ ...mockReview, status: 'error' }),
    ...overrides,
  };
}

async function collectTokens(iterable: AsyncIterable<string>): Promise<string[]> {
  const tokens: string[] = [];
  for await (const token of iterable) tokens.push(token);
  return tokens;
}

describe('ReviewOrchestrator', () => {

  it('creates a pending review before yielding any tokens', async () => {
    const repo = makeMockRepository();
    const mockAI: AIService = { async *generateReview() { yield 'hello'; } };
    const orchestrator = new ReviewOrchestrator(mockAI, repo);

    await collectTokens(orchestrator.generateReview(mockResult, 'const x = 1;'));

    expect(repo.create).toHaveBeenCalledWith({
      filename: 'test.ts',
      language: 'TypeScript',
      lineCount: 5,
      analysisResult: mockResult,
    });
  });

  it('yields all tokens from the AI service in order', async () => {
    const repo = makeMockRepository();
    const mockAI: AIService = {
      async *generateReview() {
        yield 'Hello';
        yield ', ';
        yield 'world';
      },
    };

    const orchestrator = new ReviewOrchestrator(mockAI, repo);
    const tokens = await collectTokens(
      orchestrator.generateReview(mockResult, 'const x = 1;'),
    );

    expect(tokens).toEqual(['Hello', ', ', 'world']);
  });

  it('marks the review complete with accumulated text after all tokens', async () => {
    const repo = makeMockRepository();
    const mockAI: AIService = {
      async *generateReview() {
        yield 'Hello';
        yield ', world';
      },
    };

    const orchestrator = new ReviewOrchestrator(mockAI, repo);
    await collectTokens(orchestrator.generateReview(mockResult, 'const x = 1;'));

    expect(repo.markComplete).toHaveBeenCalledWith('test-uuid', 'Hello, world');
  });

  it('marks the review as error and re-throws when the AI service throws', async () => {
    const repo = makeMockRepository();
    const mockAI: AIService = {
      async *generateReview() {
        throw new Error('API quota exceeded');
        yield '';
      },
    };

    const orchestrator = new ReviewOrchestrator(mockAI, repo);

    await expect(
      collectTokens(orchestrator.generateReview(mockResult, 'const x = 1;')),
    ).rejects.toThrow('API quota exceeded');

    expect(repo.markError).toHaveBeenCalledWith('test-uuid', 'API quota exceeded');
  });

  it('does not call markComplete if an error occurs', async () => {
    const repo = makeMockRepository();
    const mockAI: AIService = {
      async *generateReview() {
        throw new Error('fail');
        yield '';
      },
    };

    const orchestrator = new ReviewOrchestrator(mockAI, repo);
    await expect(
      collectTokens(orchestrator.generateReview(mockResult, 'const x = 1;')),
    ).rejects.toThrow();

    expect(repo.markComplete).not.toHaveBeenCalled();
  });

});