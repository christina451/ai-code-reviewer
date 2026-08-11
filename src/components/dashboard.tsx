import type { AnalysisResult } from '@/domain/types';

export function SeverityBadge({ severity }: { severity: string }) {
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

export function MetricCard({
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

export function Dashboard({
  result,
  cacheHit,
}: {
  result: AnalysisResult;
  cacheHit: boolean;
}) {
  return (
    <div className="space-y-6">
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Errors" value={result.summary.errors} variant="error" />
        <MetricCard label="Warnings" value={result.summary.warnings} variant="warning" />
        <MetricCard label="Info" value={result.summary.infos} variant="info" />
        <MetricCard label="Functions" value={result.functions.length} variant="neutral" />
      </div>

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
                    <td className="px-4 py-2 font-mono text-gray-200 text-sm">{fn.name}</td>
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