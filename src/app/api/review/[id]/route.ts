import { createReviewRepository } from '@/composition-root';

/**
 * GET /api/review/:id
 * Returns the full review record including reviewText.
 * Used by the history page to display a past review.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  try {
    const repository = createReviewRepository();
    const review = await repository.findById(id);

    if (!review) {
      return Response.json({ error: 'Review not found' }, { status: 404 });
    }

    return Response.json(review);
  } catch (err) {
    console.error('Failed to fetch review:', err);
    return Response.json({ error: 'Failed to fetch review' }, { status: 500 });
  }
}