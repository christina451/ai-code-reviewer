import type { Pool } from 'pg';
import type { Review } from '@/domain/types';
import type { ReviewRepository, CreateReviewInput } from '@/services/review-repository';

/**
 * The shape of a raw row from the `reviews` table.
 * Column names are snake_case (Postgres convention).
 * We map to camelCase domain types in rowToReview().
 */
interface ReviewRow {
  id: string;
  filename: string;
  language: string;
  line_count: number;
  analysis_result: Review['analysisResult']; // pg parses JSONB automatically
  review_text: string | null;
  status: string;
  error_message: string | null;
  created_at: Date;
  completed_at: Date | null;
}

/**
 * Convert a raw Postgres row to a typed Review domain object.
 * Keeping this as a standalone function makes it easy to unit-test
 * the mapping logic independently of the database.
 */
function rowToReview(row: ReviewRow): Review {
  return {
    id: row.id,
    filename: row.filename,
    language: row.language,
    lineCount: row.line_count,
    analysisResult: row.analysis_result,
    reviewText: row.review_text,
    status: row.status as Review['status'],
    errorMessage: row.error_message,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

/**
 * Postgres implementation of ReviewRepository.
 * This is the only file in the codebase that knows SQL exists.
 */
export class PostgresReviewRepository implements ReviewRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateReviewInput): Promise<Review> {
    const { rows } = await this.pool.query<ReviewRow>(
      `INSERT INTO reviews (filename, language, line_count, analysis_result)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        input.filename,
        input.language,
        input.lineCount,
        JSON.stringify(input.analysisResult),
      ],
    );
    return rowToReview(rows[0]);
  }

  async findById(id: string): Promise<Review | null> {
    const { rows } = await this.pool.query<ReviewRow>(
      'SELECT * FROM reviews WHERE id = $1',
      [id],
    );
    return rows.length > 0 ? rowToReview(rows[0]) : null;
  }

  async findRecent(limit = 20): Promise<Review[]> {
    const { rows } = await this.pool.query<ReviewRow>(
      'SELECT * FROM reviews ORDER BY created_at DESC LIMIT $1',
      [limit],
    );
    return rows.map(rowToReview);
  }

  async markComplete(id: string, reviewText: string): Promise<Review> {
    const { rows } = await this.pool.query<ReviewRow>(
      `UPDATE reviews
       SET status = 'complete',
           review_text = $2,
           completed_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, reviewText],
    );
    if (rows.length === 0) throw new Error(`Review ${id} not found`);
    return rowToReview(rows[0]);
  }

  async markError(id: string, errorMessage: string): Promise<Review> {
    const { rows } = await this.pool.query<ReviewRow>(
      `UPDATE reviews
       SET status = 'error',
           error_message = $2,
           completed_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, errorMessage],
    );
    if (rows.length === 0) throw new Error(`Review ${id} not found`);
    return rowToReview(rows[0]);
  }
}