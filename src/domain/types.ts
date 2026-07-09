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