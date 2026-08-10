import type { AIService } from '@/services/ai-service';
import type { ReviewRepository } from '@/services/review-repository';
import type { AnalysisResult } from '@/domain/types';

export class ReviewOrchestrator {
  constructor(
    private readonly aiService: AIService,
    private readonly reviewRepository: ReviewRepository,
  ) {}

  async *generateReview(
    analysisResult: AnalysisResult,
    source: string,
  ): AsyncIterable<string> {
    // Create a 'pending' row before streaming starts so the review
    // appears in history immediately, even if the user closes the tab.
    const review = await this.reviewRepository.create({
      filename: analysisResult.filename,
      language: analysisResult.language,
      lineCount: analysisResult.lineCount,
      analysisResult,
    });

    // Accumulate tokens so we can persist the full text after streaming.
    const tokens: string[] = [];

    try {
      for await (const token of this.aiService.generateReview({
        analysisResult,
        source,
      })) {
        tokens.push(token);
        yield token;
      }

      await this.reviewRepository.markComplete(review.id, tokens.join(''));
    } catch (err) {
      // Persist the error so history shows what went wrong.
      await this.reviewRepository.markError(
        review.id,
        err instanceof Error ? err.message : 'Review generation failed',
      );
      throw err;
    }
  }
}