import { OpenRouterAIService } from '@/infra/ai-providers/openrouter-ai-service';
import { PostgresReviewRepository } from '@/infra/repositories/postgres-review-repository';
import { ReviewOrchestrator } from '@/services/review-orchestrator';
import { getDbPool } from '@/infra/db/client';
import type { AIService } from '@/services/ai-service';
import type { ReviewRepository } from '@/services/review-repository';

export function createAIService(): AIService {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY must be set.');
  }
  return new OpenRouterAIService({
    apiKey,
    model: process.env.OPENROUTER_MODEL,
  });
}

export function createReviewRepository(): ReviewRepository {
  return new PostgresReviewRepository(getDbPool());
}

export function createReviewOrchestrator(): ReviewOrchestrator {
  return new ReviewOrchestrator(createAIService(), createReviewRepository());
}