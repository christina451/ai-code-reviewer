/**
 * AIService.
 *
 * The interface every AI provider implementation must satisfy. The
 * service layer and review orchestrator depend ONLY on this interface,
 * never on a concrete provider. This is what lets us swap OpenRouter
 * for a direct Anthropic/OpenAI SDK later without touching business
 * logic — concrete implementations live in /infra/ai-providers.
 *
 * Filled in during Milestone 7 (AIService interface + OpenRouter adapter).
 */

export {};
