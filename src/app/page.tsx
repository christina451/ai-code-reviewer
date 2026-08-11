'use client';

import { useState, useCallback, useRef } from 'react';
import type { AnalysisResult } from '@/domain/types';

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

// ─── Small components ─────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    error: 'bg-red-950 text-red-400 border border-red-800',
    warning: 'bg-yellow-950 text-yellow-400 border border-yellow-800',
    info: 'bg-blue-950 text-blue-400 border border-blue-800',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-mono ${styles[severity] ?? 'bg-gray-800 text-gray-400'}`}>
      {severity}
    </span>
  );
}

function MetricCard({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant: 'error' | 'warning' | 'info' | 'neutral';
}) {
  const styles = {
    error: 'bg-red-950 border-red-800 text-red-400',
    warning: 'bg-yellow-950 border-yellow-800 text-yellow-400',
    info: 'bg-blue-950 border-blue-800 text-blue-400',
    neutral: 'bg-gray-900 border-gray-700 text-gray-300',
  };
  return (
    <div className={`rounded-lg border p-4 ${styles[variant]}`}>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs mt-1 opacity-60">{label}</div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard({
  result,
  cacheHit,
}: {
  result: AnalysisResult;
  cacheHit: boolean;
}) {
  return (
    <div className="space-y-6">
      {/* File header */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-mono text-lg">{result.filename}</span>
        <span className="px-2 py-0.5 bg-gray-800 rounded text-xs text-gray-400">
          {result.language}
        </span>
        <span className="text-xs text-gray-500">{result.lineCount} lines</span>
        {cacheHit && (
          <span className="px-2 py-0.5 bg-emerald-950 border border-emerald-800 rounded text-xs text-emerald-400">
            ⚡ cached
          </span>
        )}
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Errors" value={result.summary.errors} variant="error" />
        <MetricCard label="Warnings" value={result.summary.warnings} variant="warning" />
        <MetricCard label="Info" value={result.summary.infos} variant="info" />
        <MetricCard label="Functions" value={result.functions.length} variant="neutral" />
      </div>

      {/* Functions table */}
      {result.functions.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
            Functions
          </h3>
          <div className="rounded-lg border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-900">
                <tr className="text-xs text-gray-500 uppercase">
                  <th className="text-left px-4 py-2">Name</th>
                  <th className="text-right px-4 py-2">Complexity</th>
                  <th className="text-right px-4 py-2">Lines</th>
                  <th className="text-right px-4 py-2">Depth</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {result.functions.map((fn, i) => (
                  <tr key={i} className="bg-gray-950 hover:bg-gray-900 transition-colors">
                    <td className="px-4 py-2 font-mono text-gray-200 text-sm">
                      {fn.name}
                    </td>
                    <td className={`px-4 py-2 text-right tabular-nums font-mono text-sm ${
                      fn.cyclomaticComplexity > 20 ? 'text-red-400' :
                      fn.cyclomaticComplexity > 10 ? 'text-yellow-400' :
                      'text-gray-400'
                    }`}>
                      {fn.cyclomaticComplexity}
                    </td>
                    <td className={`px-4 py-2 text-right tabular-nums font-mono text-sm ${
                      fn.lineCount > 100 ? 'text-red-400' :
                      fn.lineCount > 50 ? 'text-yellow-400' :
                      'text-gray-400'
                    }`}>
                      {fn.lineCount}
                    </td>
                    <td className={`px-4 py-2 text-right tabular-nums font-mono text-sm ${
                      fn.maxNestingDepth > 6 ? 'text-red-400' :
                      fn.maxNestingDepth > 4 ? 'text-yellow-400' :
                      'text-gray-400'
                    }`}>
                      {fn.maxNestingDepth}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Findings */}
      {result.findings.length > 0 ? (
        <div>
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
            Findings ({result.findings.length})
          </h3>
          <div className="space-y-2">
            {result.findings.map((finding, i) => (
              <div
                key={i}
                className="flex gap-3 items-start bg-gray-900 rounded-lg px-4 py-3 border border-gray-800"
              >
                <div className="pt-0.5 shrink-0">
                  <SeverityBadge severity={finding.severity} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200">{finding.message}</p>
                  <p className="text-xs text-gray-500 mt-1 font-mono">
                    line {finding.line}
                    {finding.context ? ` · ${finding.context}` : ''}
                    {' · '}{finding.ruleId}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-800 bg-emerald-950 px-4 py-3 text-sm text-emerald-400">
          ✓ No static analysis issues detected
        </div>
      )}
    </div>
  );
}

// ─── Review display ───────────────────────────────────────────────────────────

function ReviewDisplay({
  text,
  isStreaming,
}: {
  text: string;
  isStreaming: boolean;
}) {
  if (!text) return null;

  return (
    <div className="mt-10">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          AI Review
        </h2>
        {isStreaming && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            generating
          </span>
        )}
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">
          {text}
          {isStreaming && (
            <span className="inline-block w-2 h-[1em] bg-emerald-400 ml-0.5 align-middle animate-pulse" />
          )}
        </pre>
      </div>
    </div>
  );
}

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