import { describe, it, expect, vi, afterEach } from 'vitest';
import { GeminiAIService } from './gemini-ai-service';
import type { ReviewRequest } from '@/services/ai-service';

const request: ReviewRequest = {
  analysisResult: {
    filename: 'a.ts',
    language: 'TypeScript',
    lineCount: 1,
    summary: { totalFindings: 0, errors: 0, warnings: 0, infos: 0 },
    findings: [],
    functions: [],
  },
  source: 'const x = 1;',
};

const sseOk = () =>
  new Response(
    'data: {"candidates":[{"content":{"parts":[{"text":"Looks good"}]}}]}\n\n',
    { status: 200 },
  );
const overloaded = () => new Response('{"error":{"code":503}}', { status: 503 });

async function collect(iter: AsyncIterable<string>): Promise<string> {
  let out = '';
  for await (const t of iter) out += t;
  return out;
}

describe('GeminiAIService retry', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('retries a 503 and streams the successful response', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(overloaded())
      .mockResolvedValueOnce(sseOk());
    vi.stubGlobal('fetch', fetchMock);

    const service = new GeminiAIService({ apiKey: 'k', retryDelayMs: 0 });
    expect(await collect(service.generateReview(request))).toBe('Looks good');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up after 3 attempts and surfaces the status', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => overloaded());
    vi.stubGlobal('fetch', fetchMock);

    const service = new GeminiAIService({ apiKey: 'k', retryDelayMs: 0, fallbackModel: null });
    await expect(collect(service.generateReview(request))).rejects.toThrow(/503/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('falls back to the lite model when the primary stays overloaded', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) =>
      url.includes('/gemini-flash-lite-latest:') ? sseOk() : overloaded(),
    );
    vi.stubGlobal('fetch', fetchMock);

    const service = new GeminiAIService({ apiKey: 'k', retryDelayMs: 0 });
    expect(await collect(service.generateReview(request))).toBe('Looks good');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('does not retry non-transient errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('nope', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);

    const service = new GeminiAIService({ apiKey: 'k', retryDelayMs: 0 });
    await expect(collect(service.generateReview(request))).rejects.toThrow(/404/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
