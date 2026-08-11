'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { AnalysisResult } from '@/domain/types';
import { Dashboard } from '@/components/dashboard';
import { ReviewDisplay } from '@/components/review-display';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReviewListItem {
  id: string;
  filename: string;
  language: string;
  lineCount: number;
  status: 'pending' | 'complete' | 'error';
  summary: {
    totalFindings: number;
    errors: number;
    warnings: number;
    infos: number;
  };
  createdAt: string;
  completedAt: string | null;
}

interface ReviewDetail extends ReviewListItem {
  analysisResult: AnalysisResult;
  reviewText: string | null;
  errorMessage: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return '—';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function StatusBadge({ status }: { status: ReviewListItem['status'] }) {
  const styles = {
    complete: 'bg-emerald-950 text-emerald-400 border-emerald-800',
    pending:  'bg-yellow-950 text-yellow-400 border-yellow-800',
    error:    'bg-red-950    text-red-400    border-red-800',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs border ${styles[status]}`}>
      {status}
    </span>
  );
}

// ─── List view ────────────────────────────────────────────────────────────────

function ReviewList({
  reviews,
  onSelect,
}: {
  reviews: ReviewListItem[];
  onSelect: (id: string) => void;
}) {
  if (reviews.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500">
        <div className="text-4xl mb-4">📭</div>
        <p className="text-sm">No reviews yet.</p>
        <p className="text-xs mt-1">
          Upload a file on the{' '}
          <Link href="/" className="text-emerald-400 hover:underline">
            home page
          </Link>{' '}
          to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-900">
          <tr className="text-xs text-gray-500 uppercase">
            <th className="text-left px-4 py-3">File</th>
            <th className="text-left px-4 py-3 hidden sm:table-cell">Status</th>
            <th className="text-right px-4 py-3 hidden md:table-cell">Findings</th>
            <th className="text-right px-4 py-3 hidden md:table-cell">Duration</th>
            <th className="text-right px-4 py-3">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {reviews.map((review) => (
            <tr
              key={review.id}
              onClick={() => onSelect(review.id)}
              className="bg-gray-950 hover:bg-gray-900 transition-colors cursor-pointer"
            >
              <td className="px-4 py-3">
                <div className="font-mono text-gray-200 text-sm">
                  {review.filename}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {review.language} · {review.lineCount} lines
                </div>
              </td>
              <td className="px-4 py-3 hidden sm:table-cell">
                <StatusBadge status={review.status} />
              </td>
              <td className="px-4 py-3 text-right hidden md:table-cell">
                <span className="text-red-400 tabular-nums">
                  {review.summary.errors}E
                </span>
                {' '}
                <span className="text-yellow-400 tabular-nums">
                  {review.summary.warnings}W
                </span>
              </td>
              <td className="px-4 py-3 text-right text-gray-500 tabular-nums hidden md:table-cell">
                {formatDuration(review.createdAt, review.completedAt)}
              </td>
              <td className="px-4 py-3 text-right text-gray-500 text-xs">
                {formatDate(review.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Detail view ──────────────────────────────────────────────────────────────

function ReviewDetailView({
  review,
  onBack,
}: {
  review: ReviewDetail;
  onBack: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={onBack}
          className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-400 transition-colors"
        >
          ← Back to history
        </button>
        <div className="flex items-center gap-3">
          <StatusBadge status={review.status} />
          <span className="text-xs text-gray-500">
            {formatDate(review.createdAt)}
            {review.completedAt &&
              ` · ${formatDuration(review.createdAt, review.completedAt)}`}
          </span>
        </div>
      </div>

      {review.status === 'error' && review.errorMessage && (
        <div className="mb-6 rounded-lg border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-400">
          Error: {review.errorMessage}
        </div>
      )}

      <Dashboard result={review.analysisResult} cacheHit={false} />

      {review.reviewText && (
        <ReviewDisplay text={review.reviewText} isStreaming={false} />
      )}

      {review.status === 'pending' && (
        <div className="mt-8 rounded-lg border border-yellow-800 bg-yellow-950 px-4 py-3 text-sm text-yellow-400">
          This review is still in progress.
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type PageState =
  | { view: 'loading' }
  | { view: 'list'; reviews: ReviewListItem[] }
  | { view: 'loadingDetail'; reviews: ReviewListItem[] }
  | { view: 'detail'; reviews: ReviewListItem[]; detail: ReviewDetail }
  | { view: 'error'; message: string };

export default function HistoryPage() {
  const [state, setState] = useState<PageState>({ view: 'loading' });

  useEffect(() => {
  fetch('/api/reviews')
    .then((r) => r.json())
    .then((data: unknown) => {
      if (!Array.isArray(data)) {
        setState({ view: 'error', message: 'Failed to load reviews' });
        return;
      }
      setState({ view: 'list', reviews: data as ReviewListItem[] });
    })
    .catch(() =>
      setState({ view: 'error', message: 'Failed to load reviews' }),
    );
    }, []);

  const handleSelect = async (id: string) => {
    if (state.view !== 'list' && state.view !== 'detail') return;
    const reviews = state.view === 'list' ? state.reviews : state.reviews;

    setState({ view: 'loadingDetail', reviews });

    try {
      const response = await fetch(`/api/review/${id}`);
      if (!response.ok) throw new Error('Review not found');
      const detail = (await response.json()) as ReviewDetail;
      setState({ view: 'detail', reviews, detail });
    } catch {
      setState({ view: 'error', message: 'Failed to load review' });
    }
  };

  const handleBack = () => {
    if (state.view === 'detail') {
      setState({ view: 'list', reviews: state.reviews });
    }
  };

  if (state.view === 'loading' || state.view === 'loadingDetail') {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-500 text-sm animate-pulse">Loading...</div>
      </div>
    );
  }

  if (state.view === 'error') {
    return (
      <div className="text-center py-20 text-red-400 text-sm">
        {state.message}
      </div>
    );
  }

  if (state.view === 'detail') {
    return (
      <ReviewDetailView review={state.detail} onBack={handleBack} />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold">Review History</h1>
        <span className="text-xs text-gray-500">
          {state.reviews.length} review{state.reviews.length !== 1 ? 's' : ''}
        </span>
      </div>
      <ReviewList reviews={state.reviews} onSelect={handleSelect} />
    </div>
  );
}