import { analyzeFile, ParseError } from '@/services/analysis-service';
import { createReviewOrchestrator } from '@/composition-root';
import {
  buildAnalysisCacheKey,
  getCachedAnalysis,
  setCachedAnalysis,
} from '@/infra/cache';
import type { AnalysisResult } from '@/domain/types';
import type { ReviewOrchestrator } from '@/services/review-orchestrator';

/**
 * POST /api/review
 *
 * Accepts: multipart/form-data with a "file" field.
 *
 * Returns: text/event-stream with:
 *   { type: 'analysis', payload: AnalysisResult }  — first, always
 *   { type: 'cache_hit', hit: boolean }             — indicates if analysis was cached
 *   { type: 'token',    content: string }           — one per LLM token
 *   { type: 'done' }                                — terminal
 *   { type: 'error',   message: string }            — on AI failure
 */
export async function POST(request: Request): Promise<Response> {
  // --- Parse the upload ---
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return Response.json(
      { error: 'Missing or invalid "file" field in form data' },
      { status: 400 },
    );
  }

  const source = await file.text();
  const filename = file.name;

  // --- Static analysis with cache-aside pattern ---
  // Cache check must happen before streaming starts so we can still
  // return a non-200 status code on analysis failure.
  const cacheKey = buildAnalysisCacheKey(source, filename);
  let analysisResult: AnalysisResult;
  let cacheHit = false;

  const cachedResult = await getCachedAnalysis(cacheKey);

  if (cachedResult) {
    // Cache hit — skip analysis entirely.
    analysisResult = cachedResult;
    cacheHit = true;
  } else {
    // Cache miss — run full analysis.
    try {
      analysisResult = analyzeFile(source, filename);
    } catch (err) {
      if (err instanceof ParseError) {
        return Response.json({ error: err.message }, { status: 422 });
      }
      console.error('Unexpected analysis error:', err);
      return Response.json({ error: 'Static analysis failed' }, { status: 500 });
    }

    // Store in cache for future requests. Fire-and-forget — don't await
    // so the cache write doesn't add latency to the response.
    void setCachedAnalysis(cacheKey, analysisResult);
  }

  const orchestrator = createReviewOrchestrator();

  return new Response(
    buildSSEStream(analysisResult, source, orchestrator, cacheHit),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    },
  );
}

function buildSSEStream(
  analysisResult: AnalysisResult,
  source: string,
  orchestrator: ReviewOrchestrator,
  cacheHit: boolean,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  const encode = (data: object): Uint8Array =>
    encoder.encode(`data: ${JSON.stringify(data)}\n\n`);

  return new ReadableStream({
    async start(controller) {
      controller.enqueue(encode({ type: 'analysis', payload: analysisResult }));
      controller.enqueue(encode({ type: 'cache_hit', hit: cacheHit }));

      try {
        for await (const token of orchestrator.generateReview(analysisResult, source)) {
          controller.enqueue(encode({ type: 'token', content: token }));
        }
        controller.enqueue(encode({ type: 'done' }));
      } catch (err) {
        controller.enqueue(
          encode({
            type: 'error',
            message: err instanceof Error ? err.message : 'Review generation failed',
          }),
        );
      } finally {
        controller.close();
      }
    },
  });
}