import type { AnalysisResult, Review } from '@/domain/types';

/**
 * Input required to create a new review record. The review starts as
 * 'pending' — the repository sets status and timestamps automatically.
 */
export interface CreateReviewInput {
  filename: string;
  language: string;
  lineCount: number;
  analysisResult: AnalysisResult;
}

/**
 * ReviewRepository interface. The orchestrator depends on this interface,
 * never on the Postgres implementation. Swap or mock it by implementing
 * this interface — no other code changes required.
 */
export interface ReviewRepository {
  create(input: CreateReviewInput): Promise<Review>;
  findById(id: string): Promise<Review | null>;
  findRecent(limit?: number): Promise<Review[]>;
  markComplete(id: string, reviewText: string): Promise<Review>;
  markError(id: string, errorMessage: string): Promise<Review>;
}