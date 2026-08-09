import type { AIService } from '@/services/ai-service';
import type { AnalysisResult } from '@/domain/types';

/**
 * Sequences the steps of generating one code review:
 *   1. Call the AI service with the analysis result
 *   2. Yield tokens as they arrive
 *   3. (Milestone 9) Persist the completed review via ReviewRepository
 *
 * Accepting AIService via the constructor keeps this class testable —
 * tests pass a mock generator, never touching the network.
 */
export class ReviewOrchestrator {
  constructor(private readonly aiService: AIService) {}

  async *generateReview(
    analysisResult: AnalysisResult,
    source: string,
  ): AsyncIterable<string> {
    // Milestone 9: save the pending review to the database before the AI call.
    
    yield* this.aiService.generateReview({ analysisResult, source });

    // Milestone 9: save the completed review to the database after streaming.
  }
}