/**
 * Domain layer — pure TypeScript types, no framework imports.
 *
 * These types are the contract between the analysis layer and the AI layer.
 * The AnalysisResult is exactly what gets serialized and sent to the LLM.
 */

export type Severity = 'error' | 'warning' | 'info';

/**
 * A single issue found by a static analysis rule.
 */
export interface Finding {
  ruleId: string;
  severity: Severity;
  message: string;
  line: number;
  column: number;
  // The function or class where the issue was found.
  // Lets the LLM say "function processUser has..." instead of "line 42 has..."
  context?: string;
  // The numeric value that triggered the finding (complexity score, line count, etc).
  // Lets the LLM reference exact numbers rather than vague descriptions.
  value?: number;
}

/**
 * Numeric measurements for a single function — collected for every function
 * in the file, not just those that exceeded a threshold. Gives the LLM
 * the full picture when estimating overall maintainability.
 */
export interface FunctionMetrics {
  name: string;
  startLine: number;
  lineCount: number;
  cyclomaticComplexity: number;
  maxNestingDepth: number;
}

/**
 * The complete output of the analysis pipeline for a single file.
 * This is the structured JSON sent to the LLM alongside the source code.
 */
export interface AnalysisResult {
  filename: string;
  // Inferred from the file extension: "TypeScript", "JavaScript", etc.
  // Used by the LLM when generating language-appropriate suggestions.
  language: string;
  lineCount: number;
  summary: {
    totalFindings: number;
    errors: number;
    warnings: number;
    infos: number;
  };
  // All findings from all rules, sorted by line number.
  findings: Finding[];
  // Per-function metrics for every function in the file.
  functions: FunctionMetrics[];
}