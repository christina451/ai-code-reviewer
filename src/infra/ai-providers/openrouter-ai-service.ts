import type { AIService, ReviewRequest } from '@/services/ai-service';
import { AIServiceError } from '@/services/ai-service';
import { buildSystemPrompt, buildUserMessage } from './prompt-builder';

export interface OpenRouterConfig {
  apiKey: string;
  // The model string to use. Defaults to claude-3.5-haiku — fast and cheap.
  // Can be overridden to any OpenRouter-supported model string.
  // See https://openrouter.ai/models
  model?: string;
}

const DEFAULT_MODEL = 'anthropic/claude-3.5-haiku';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Parse a single SSE line and return its text content, or null if the line
 * is not a content-bearing data line. Exported for unit testing.
 *
 * SSE format from OpenAI-compatible APIs:
 *   data: {"choices":[{"delta":{"content":"Hello"},"index":0}]}
 *   data: [DONE]
 */
export function parseSSELine(line: string): string | null {
  if (!line.startsWith('data: ')) return null;

  const data = line.slice('data: '.length).trim();
  if (data === '[DONE]') return null;

  try {
    const parsed = JSON.parse(data) as {
      choices?: Array<{ delta?: { content?: string } }>;
    };
    const content = parsed.choices?.[0]?.delta?.content;
    return typeof content === 'string' ? content : null;
  } catch {
    // Malformed JSON chunk — skip it silently.
    return null;
  }
}

/**
 * Concrete AIService implementation backed by OpenRouter.
 *
 * OpenRouter exposes an OpenAI-compatible API that proxies many models —
 * Claude, GPT-4, Gemini, Llama, and others. Using it here means we can
 * swap models by changing one config string, without touching this class.
 *
 * This class is the only file in the codebase that knows:
 *   - That OpenRouter exists
 *   - What URL to call
 *   - How to parse SSE chunks from the response stream
 */
export class OpenRouterAIService implements AIService {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(config: OpenRouterConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? DEFAULT_MODEL;
  }

  async *generateReview(request: ReviewRequest): AsyncIterable<string> {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        // OpenRouter recommends these headers for tracking/rate limits
        'HTTP-Referer': 'https://code-review-platform.dev',
        'X-Title': 'Code Review Platform',
      },
      body: JSON.stringify({
        model: this.model,
        stream: true,
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user',   content: buildUserMessage(request) },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new AIServiceError(
        `OpenRouter API error ${response.status}: ${errorText}`,
        response.status,
      );
    }

    if (!response.body) {
      throw new AIServiceError('No response body from OpenRouter', 500);
    }

    // Read the response body as a stream of SSE lines.
    // We maintain a buffer because a single network chunk may contain
    // partial SSE lines — we only process complete lines.
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Split on newlines. Keep the last element (may be incomplete)
        // in the buffer for the next iteration.
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const content = parseSSELine(line);
          if (content !== null) yield content;
        }
      }

      // Flush any remaining buffer content after the stream ends.
      if (buffer.trim()) {
        const content = parseSSELine(buffer);
        if (content !== null) yield content;
      }
    } finally {
      reader.releaseLock();
    }
  }
}