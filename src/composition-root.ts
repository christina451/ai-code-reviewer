/**
 * Composition root.
 *
 * The one file allowed to know about every concrete implementation and
 * wire them into the services that depend only on interfaces.
 *
 * API route handlers import their dependencies from here. This keeps
 * concrete implementations out of business logic and makes swapping
 * providers a one-line change in this file.
 */

import { OpenRouterAIService } from '@/infra/ai-providers/openrouter-ai-service';
import type { AIService } from '@/services/ai-service';

/**
 * Returns the configured AIService implementation.
 * Throws at startup if OPENROUTER_API_KEY is missing so the error
 * surfaces immediately rather than on the first review request.
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
    // Defaults to claude-3.5-haiku — fast, cheap, strong at code analysis.
    model: process.env.OPENROUTER_MODEL,
  });
}