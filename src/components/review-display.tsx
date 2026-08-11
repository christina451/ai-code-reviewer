export function ReviewDisplay({
  text,
  isStreaming = false,
}: {
  text: string;
  isStreaming?: boolean;
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