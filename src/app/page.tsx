'use client';

import { useState, useCallback, useRef } from 'react';
import type { AnalysisResult } from '@/domain/types';
import { Dashboard } from '@/components/dashboard';
import { ReviewDisplay } from '@/components/review-display';

// ─── SSE event types ──────────────────────────────────────────────────────────

type SSEEvent =
  | { type: 'analysis'; payload: AnalysisResult }
  | { type: 'cache_hit'; hit: boolean }
  | { type: 'token'; content: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

// ─── Page state machine ───────────────────────────────────────────────────────
// One discriminated union instead of multiple booleans. TypeScript enforces
// that analysisResult is only accessible in phases where it exists.

type State =
  | { phase: 'idle' }
  | { phase: 'uploading' }
  | {
      phase: 'streaming' | 'done';
      analysisResult: AnalysisResult;
      cacheHit: boolean;
      reviewText: string;
    }
  | { phase: 'error'; message: string };

// ─── Upload zone ──────────────────────────────────────────────────────────────

function UploadZone({
  onFile,
  isUploading,
}: {
  onFile: (file: File) => void;
  isUploading: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (selectedFile) onFile(selectedFile);
    },
    [selectedFile, onFile],
  );

  return (
    <div className="max-w-lg mx-auto">
      <div className="text-center mb-12">
        <div className="text-5xl mb-5 text-emerald-400">⬡</div>
        <h1 className="text-2xl font-semibold mb-2">Code Review Platform</h1>
        <p className="text-gray-400 text-sm leading-relaxed">
          Deterministic AST-based static analysis followed by AI-powered review.
          <br />
          TypeScript and JavaScript files.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`w-full border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
            dragOver
              ? 'border-emerald-500 bg-emerald-950/20'
              : selectedFile
              ? 'border-emerald-700 bg-gray-900'
              : 'border-gray-700 bg-gray-900 hover:border-gray-600'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".ts,.tsx,.js,.jsx,.mjs,.cjs"
            className="hidden"
            onChange={handleChange}
          />
          {selectedFile ? (
            <div>
              <div className="text-2xl mb-2">📄</div>
              <div className="font-mono text-gray-200 text-sm">{selectedFile.name}</div>
              <div className="text-gray-500 text-xs mt-1">
                {(selectedFile.size / 1024).toFixed(1)} KB · click to change
              </div>
            </div>
          ) : (
            <div>
              <div className="text-4xl mb-3 text-gray-600">↑</div>
              <div className="text-gray-300 text-sm mb-1">
                Drop a file here or click to browse
              </div>
              <div className="text-gray-600 text-xs">.ts .tsx .js .jsx</div>
            </div>
          )}
        </button>

        <button
          type="submit"
          disabled={!selectedFile || isUploading}
          className="w-full py-3 rounded-lg text-sm font-medium transition-colors bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isUploading ? 'Analyzing...' : 'Analyze Code'}
        </button>
      </form>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [state, setState] = useState<State>({ phase: 'idle' });

  const handleFile = useCallback(async (file: File) => {
    setState({ phase: 'uploading' });

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/review', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setState({ phase: 'error', message: body.error ?? `HTTP ${response.status}` });
        return;
      }

      if (!response.body) {
        setState({ phase: 'error', message: 'No response body from server' });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      // Accumulate review text outside setState to avoid stale closure issues
      let reviewText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          let event: SSEEvent;
          try {
            event = JSON.parse(line.slice(6)) as SSEEvent;
          } catch {
            continue;
          }

          if (event.type === 'analysis') {
            setState({
              phase: 'streaming',
              analysisResult: event.payload,
              cacheHit: false,
              reviewText: '',
            });
          } else if (event.type === 'cache_hit') {
            const hit = event.hit;
            setState(prev =>
              prev.phase === 'streaming' || prev.phase === 'done'
                ? { ...prev, cacheHit: hit }
                : prev,
            );
          } else if (event.type === 'token') {
            reviewText += event.content;
            const snapshot = reviewText;
            setState(prev =>
              prev.phase === 'streaming' ? { ...prev, reviewText: snapshot } : prev,
            );
          } else if (event.type === 'done') {
            setState(prev =>
              prev.phase === 'streaming' ? { ...prev, phase: 'done' } : prev,
            );
          } else if (event.type === 'error') {
            setState({ phase: 'error', message: event.message });
          }
        }
      }
    } catch (err) {
      setState({
        phase: 'error',
        message: err instanceof Error ? err.message : 'Something went wrong',
      });
    }
  }, []);

  if (state.phase === 'idle' || state.phase === 'uploading') {
    return (
      <UploadZone onFile={handleFile} isUploading={state.phase === 'uploading'} />
    );
  }

  if (state.phase === 'error') {
    return (
      <div className="max-w-lg mx-auto text-center space-y-4 py-20">
        <div className="text-red-400 text-lg font-medium">Analysis failed</div>
        <div className="text-gray-500 text-sm font-mono bg-gray-900 rounded-lg px-4 py-3">
          {state.message}
        </div>
        <button
          onClick={() => setState({ phase: 'idle' })}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">
          Review Results
        </span>
        <button
          onClick={() => setState({ phase: 'idle' })}
          className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-400 transition-colors"
        >
          ← Review another file
        </button>
      </div>

      <Dashboard result={state.analysisResult} cacheHit={state.cacheHit} />
      <ReviewDisplay
        text={state.reviewText}
        isStreaming={state.phase === 'streaming'}
      />

      {state.phase === 'done' && (
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => setState({ phase: 'idle' })}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
          >
            Review another file
          </button>
        </div>
      )}
    </div>
  );
}