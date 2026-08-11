import Redis from 'ioredis';
import { createHash } from 'crypto';
import type { AnalysisResult } from '@/domain/types';

// Singleton Redis client — created once and reused across requests.
// Next.js API routes share module scope within the same process, so
// this avoids creating a new connection on every request.
let client: Redis | null = null;

function getClient(): Redis {
  if (!client) {
    client = new Redis(
      process.env.REDIS_URL ?? 'redis://localhost:6379',
      {
        // Fail fast if Redis is unavailable rather than hanging requests.
        maxRetriesPerRequest: 1,
        // Don't connect until the first command is issued.
        lazyConnect: true,
      },
    );
  }
  return client;
}

/**
 * Build a stable cache key for an analysis result.
 *
 * Keyed by content hash + extension, not filename. Identical code in
 * 'foo.ts' and 'bar.ts' produces the same key and hits the same cache
 * entry. The extension is included because it affects language detection.
 *
 * The 'v1:' prefix lets us invalidate the entire cache by bumping the
 * version if we change the analysis engine in a breaking way.
 */
export function buildAnalysisCacheKey(
  source: string,
  filename: string,
): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const hash = createHash('sha256').update(source).digest('hex');
  return `analysis:v1:${ext}:${hash}`;
}

/**
 * Retrieve a cached AnalysisResult. Returns null on cache miss OR on
 * any Redis error — cache unavailability is non-fatal.
 */
export async function getCachedAnalysis(
  key: string,
): Promise<AnalysisResult | null> {
  try {
    const value = await getClient().get(key);
    if (!value) return null;
    return JSON.parse(value) as AnalysisResult;
  } catch {
    // Redis unavailable or parse error — treat as cache miss.
    return null;
  }
}

/**
 * Cache an AnalysisResult. Fails silently on Redis errors so a cache
 * write failure never prevents a review from being returned.
 *
 * TTL is 1 hour by default. Since keys are content-hashed, stale data
 * is impossible — a changed file produces a new key automatically.
 */
export async function setCachedAnalysis(
  key: string,
  result: AnalysisResult,
  ttlSeconds = 3_600,
): Promise<void> {
  try {
    await getClient().setex(key, ttlSeconds, JSON.stringify(result));
  } catch {
    // Cache write failure is non-fatal. The result was computed and will
    // still be returned to the caller — just not cached for next time.
  }
}