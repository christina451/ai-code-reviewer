import type { AIService, ReviewRequest } from '@/services/ai-service';
import { AIServiceError } from '@/services/ai-service';
import { buildSystemPrompt, buildUserMessage } from './prompt-builder';

export interface GeminiConfig {
  apiKey: string;
  model?: string;
  /** Tried after `model` keeps returning 429/503. Pass null to disable. */
  fallbackModel?: string | null;
  /** Base delay for retry backoff. Exposed so tests can set it to 0. */
  retryDelayMs?: number;
}

// 429 (rate limit) and 503 (model overloaded) are transient on Gemini's
// free tier — usually a retry a second later succeeds.
const RETRYABLE_STATUSES = new Set([429, 503]);
const MAX_ATTEMPTS = 3;

// Alias that tracks Google's current Flash model — pinned versions get
// retired and start returning 404.
const DEFAULT_MODEL = 'gemini-flash-latest';
// Lite models have far more free-tier capacity and stay up when the full
// Flash model is overloaded.
const DEFAULT_FALLBACK_MODEL = 'gemini-flash-lite-latest';
const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Parse a single SSE line from the Gemini streaming API.
 * Exported for unit testing without network calls.
 */
export function parseGeminiSSELine(line: string): string | null {
  if (!line.startsWith('data: ')) return null;
  const data = line.slice('data: '.length).trim();
  if (!data || data === '[DONE]') return null;

  try {
    const parsed = JSON.parse(data) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
    return typeof text === 'string' && text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

/**
 * Concrete AIService implementation backed by Google Gemini.
 * Free tier available via Google AI Studio — https://aistudio.google.com
 *
 * This class demonstrates the Strategy pattern: swapping providers means
 * writing a new class that satisfies the AIService interface. The
 * composition root decides which implementation to construct — the
 * orchestrator and route handlers never know which provider is in use.
 */
export class GeminiAIService implements AIService {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly fallbackModel: string | null;
  private readonly retryDelayMs: number;

  constructor(config: GeminiConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || DEFAULT_MODEL;
    this.fallbackModel =
      config.fallbackModel === undefined ? DEFAULT_FALLBACK_MODEL : config.fallbackModel;
    this.retryDelayMs = config.retryDelayMs ?? 1_000;
  }

  async *generateReview(request: ReviewRequest): AsyncIterable<string> {
    const body = JSON.stringify({
      system_instruction: {
        parts: [{ text: buildSystemPrompt() }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: buildUserMessage(request) }],
        },
      ],
      generationConfig: { temperature: 0.7 },
    });

    // Retrying is safe here because no tokens have been yielded yet —
    // once streaming starts, a failure propagates to the caller.
    const models = [this.model];
    if (this.fallbackModel && this.fallbackModel !== this.model) {
      models.push(this.fallbackModel);
    }

    let response!: Response;
    for (const [i, model] of models.entries()) {
      response = await this.fetchWithRetry(model, body);
      if (!RETRYABLE_STATUSES.has(response.status) || i === models.length - 1) break;
      await response.body?.cancel();
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new AIServiceError(
        `Gemini API error ${response.status}: ${errorText}`,
        response.status,
      );
    }

    if (!response.body) {
      throw new AIServiceError('No response body from Gemini', 500);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const content = parseGeminiSSELine(line);
          if (content !== null) yield content;
        }
      }
      if (buffer.trim()) {
        const content = parseGeminiSSELine(buffer);
        if (content !== null) yield content;
      }
    } finally {
      reader.releaseLock();
    }
  }

  private async fetchWithRetry(model: string, body: string): Promise<Response> {
    const url =
      `${GEMINI_API_URL}/${model}:streamGenerateContent` +
      `?alt=sse&key=${this.apiKey}`;
    for (let attempt = 1; ; attempt++) {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (!RETRYABLE_STATUSES.has(response.status) || attempt >= MAX_ATTEMPTS) {
        return response;
      }
      await response.body?.cancel();
      await new Promise(r => setTimeout(r, this.retryDelayMs * 2 ** (attempt - 1)));
    }
  }
}