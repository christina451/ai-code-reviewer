import { analyzeFile, ParseError } from '@/services/analysis-service';
import { createReviewOrchestrator } from '@/composition-root';
import type { AnalysisResult } from '@/domain/types';
import type { ReviewOrchestrator } from '@/services/review-orchestrator';

/**
 * POST /api/review
 *
 * Accepts: multipart/form-data with a "file" field containing a
 * TypeScript or JavaScript source file.
 *
 * Returns: text/event-stream with three event types:
 *   { type: 'analysis', payload: AnalysisResult }  — first, always
 *   { type: 'token',    content: string }           — one per LLM token
 *   { type: 'done' }                                — terminal
 *   { type: 'error',   message: string }            — on AI failure
 *
 * Error responses (before streaming starts):
 *   400 — missing or invalid file field
 *   422 — source file has a syntax error (ParseError)
 *   500 — internal analysis failure
 */
export async function POST(request: Request): Promise<Response> {
  // --- Step 1: parse the uploaded file ---
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

  // --- Step 2: run static analysis synchronously ---
  // Must happen before the stream starts so we can return a proper HTTP
  // status code on parse failure. Once streaming begins, status is fixed.
  let analysisResult: AnalysisResult;
  try {
    analysisResult = analyzeFile(source, filename);
  } catch (err) {
    if (err instanceof ParseError) {
      return Response.json({ error: err.message }, { status: 422 });
    }
    console.error('Unexpected analysis error:', err);
    return Response.json({ error: 'Static analysis failed' }, { status: 500 });
  }

  // --- Step 3: stream analysis result + AI review ---
  const orchestrator = createReviewOrchestrator();

  return new Response(
    buildSSEStream(analysisResult, source, orchestrator),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    },
  );
}

/**
 * Converts the orchestrator's AsyncIterable<string> into a
 * ReadableStream of SSE-formatted bytes.
 *
 * Extracted as a named function (rather than inlined) so it can
 * be read and reasoned about independently of the request parsing above.
 */
function buildSSEStream(
  analysisResult: AnalysisResult,
  source: string,
  orchestrator: ReviewOrchestrator,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  const encode = (data: object): Uint8Array =>
    encoder.encode(`data: ${JSON.stringify(data)}\n\n`);

  return new ReadableStream({
    async start(controller) {
      // Always emit the analysis result first. The UI can render metrics
      // immediately while the LLM review is still generating.
      controller.enqueue(encode({ type: 'analysis', payload: analysisResult }));

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