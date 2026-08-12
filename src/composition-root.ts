import { OpenRouterAIService } from '@/infra/ai-providers/openrouter-ai-service';
import { GeminiAIService } from '@/infra/ai-providers/gemini-ai-service';
import { PostgresReviewRepository } from '@/infra/repositories/postgres-review-repository';
import { ReviewOrchestrator } from '@/services/review-orchestrator';
import { getDbPool } from '@/infra/db/client';
import type { AIService } from '@/services/ai-service';
import type { ReviewRepository } from '@/services/review-repository';

/**
 * Composition root — the only file allowed to instantiate concrete
 * implementations and wire them into the services that depend on interfaces.
 */
export function createAIService(): AIService {
  if (process.env.GEMINI_API_KEY) {
    return new GeminiAIService({
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL,
    });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Either GEMINI_API_KEY or OPENROUTER_API_KEY must be set. ' +
      'Get a free Gemini key at https://aistudio.google.com',
    );
  }

  return new OpenRouterAIService({ apiKey, model: process.env.OPENROUTER_MODEL });
}

export function createReviewRepository(): ReviewRepository {
  return new PostgresReviewRepository(getDbPool());
}

export function createReviewOrchestrator(): ReviewOrchestrator {
  return new ReviewOrchestrator(createAIService(), createReviewRepository());
}