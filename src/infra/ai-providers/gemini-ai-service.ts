import type { AIService, ReviewRequest } from '@/services/ai-service';
import { AIServiceError } from '@/services/ai-service';
import { buildSystemPrompt, buildUserMessage } from './prompt-builder';

export interface GeminiConfig {
  apiKey: string;
  model?: string;
}

const DEFAULT_MODEL = 'gemini-2.0-flash';
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

  constructor(config: GeminiConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? DEFAULT_MODEL;
  }

  async *generateReview(request: ReviewRequest): AsyncIterable<string> {
    const url =
      `${GEMINI_API_URL}/${this.model}:streamGenerateContent` +
      `?alt=sse&key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
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
      }),
    });

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
}