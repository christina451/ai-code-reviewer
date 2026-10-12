import Markdown, { type Components } from 'react-markdown';

// The LLM replies in Markdown. react-markdown renders it to React elements
// and ignores raw HTML by default, so model output can't inject markup.
const markdownComponents: Components = {
  h2: ({ children }) => (
    <h3 className="text-base font-semibold text-gray-100 mt-6 mb-2 first:mt-0">{children}</h3>
  ),
  h3: ({ children }) => (
    <h4 className="text-sm font-semibold text-gray-200 mt-4 mb-2">{children}</h4>
  ),
  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1.5">{children}</ol>,
  strong: ({ children }) => <strong className="font-semibold text-gray-100">{children}</strong>,
  em: ({ children }) => <em className="text-gray-400">{children}</em>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline">
      {children}
    </a>
  ),
  // Inline code gets a pill; code inside <pre> resets it via the pre's selector.
  code: ({ children }) => (
    <code className="font-mono text-[0.85em] text-emerald-300 bg-gray-800 rounded px-1 py-0.5">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="bg-gray-950 border border-gray-800 rounded-md p-4 my-3 overflow-x-auto text-xs leading-relaxed [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-gray-300">
      {children}
    </pre>
  ),
};

export function ReviewDisplay({
  text,
  isStreaming = false,
  error,
}: {
  text: string;
  isStreaming?: boolean;
  error?: string;
}) {
  if (!text && !isStreaming && !error) return null;

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
        {(text || isStreaming) && (
          <div className="text-sm text-gray-300 leading-relaxed">
            {text ? (
              <Markdown components={markdownComponents}>{text}</Markdown>
            ) : (
              <span className="text-gray-500">Waiting for the model…</span>
            )}
            {isStreaming && (
              <span className="inline-block w-2 h-[1em] bg-emerald-400 ml-0.5 align-middle animate-pulse" />
            )}
          </div>
        )}
        {error && (
          <div className={`text-sm text-red-400 font-mono break-words ${text ? 'mt-4 pt-4 border-t border-gray-800' : ''}`}>
            AI review failed: {error}
            <div className="text-gray-500 font-sans mt-2">
              The static analysis above is complete. Upload the file again to retry the AI review.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
