import type { AnalysisResult } from '@/domain/types';

/**
 * The input to a review generation request. Contains both the structured
 * findings from static analysis and the original source code. The LLM
 * needs both: findings tell it what's wrong, source lets it suggest fixes.
 */
export interface ReviewRequest {
  analysisResult: AnalysisResult;
  source: string;
}

/**
 * The AIService interface. Every AI provider implementation must satisfy
 * this contract. The service layer and route handlers depend only on this
 * interface — never on a concrete provider like OpenRouter or Anthropic.
 *
 * Returns AsyncIterable<string> rather than ReadableStream because:
 *   - It's framework-agnostic (no Web Streams API dependency)
 *   - Trivially mockable in tests with `async function*`
 *   - Easily converted to ReadableStream at the HTTP boundary
 */
export interface AIService {
  generateReview(request: ReviewRequest): AsyncIterable<string>;
}

/**
 * Thrown when the AI provider returns an error response.
 * Typed separately from generic Error so route handlers can catch it
 * specifically and return appropriate HTTP status codes.
 */
export class AIServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'AIServiceError';
  }
}