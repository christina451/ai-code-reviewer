/**
 * Domain layer — pure TypeScript types, no framework imports.
 */

export type Severity = 'error' | 'warning' | 'info';

export interface Finding {
  ruleId: string;
  severity: Severity;
  message: string;
  line: number;
  column: number;
  context?: string;
  value?: number;
}

export interface FunctionMetrics {
  name: string;
  startLine: number;
  lineCount: number;
  cyclomaticComplexity: number;
  maxNestingDepth: number;
}

export interface AnalysisResult {
  filename: string;
  language: string;
  lineCount: number;
  summary: {
    totalFindings: number;
    errors: number;
    warnings: number;
    infos: number;
  };
  findings: Finding[];
  functions: FunctionMetrics[];
}

/**
 * A persisted review record. Mirrors the `reviews` table in Postgres.
 * status lifecycle: 'pending' → 'complete' | 'error'
 */
export type ReviewStatus = 'pending' | 'complete' | 'error';

export interface Review {
  id: string;
  filename: string;
  language: string;
  lineCount: number;
  analysisResult: AnalysisResult;
  reviewText: string | null;
  status: ReviewStatus;
  errorMessage: string | null;
  createdAt: Date;
  completedAt: Date | null;
}