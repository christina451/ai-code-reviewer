import { createReviewRepository } from '@/composition-root';

/**
 * GET /api/reviews
 * Returns the 20 most recent reviews for the history page.
 * Returns a slimmed-down shape — history doesn't need full reviewText.
 */
export async function GET(): Promise<Response> {
  try {
    const repository = createReviewRepository();
    const reviews = await repository.findRecent(20);

    return Response.json(
      reviews.map((r) => ({
        id: r.id,
        filename: r.filename,
        language: r.language,
        lineCount: r.lineCount,
        status: r.status,
        summary: r.analysisResult.summary,
        createdAt: r.createdAt,
        completedAt: r.completedAt,
      })),
    );
  } catch (err) {
    console.error('Failed to fetch reviews:', err);
    return Response.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }
}