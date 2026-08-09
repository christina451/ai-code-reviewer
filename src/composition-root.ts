/**
 * Composition root.
 *
 * The one file allowed to know about every concrete implementation and
 * wire them into the services that depend only on interfaces. API route
 * handlers import their dependencies from here.
 */

import { OpenRouterAIService } from '@/infra/ai-providers/openrouter-ai-service';
import { ReviewOrchestrator } from '@/services/review-orchestrator';
import type { AIService } from '@/services/ai-service';

/**
 * Throws at startup if OPENROUTER_API_KEY is missing — fail-fast is better
 * than a cryptic error on the first review request.
 */
export function createAIService(): AIService {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OPENROUTER_API_KEY environment variable is required. ' +
      'Get a key at https://openrouter.ai and add it to your .env file.',
    );
  }

  return new OpenRouterAIService({
    apiKey,
    // Override via OPENROUTER_MODEL env var to switch models without code changes.
    model: process.env.OPENROUTER_MODEL,
  });
}

export function createReviewOrchestrator(): ReviewOrchestrator {
  return new ReviewOrchestrator(createAIService());
}