import type { Finding } from '@/domain/types';
import type { ParsedFile } from '@/analysis/ast/parser';

const RULE_ID = 'todo-fixme';

const TODO_PATTERN = /\b(TODO|FIXME|HACK|XXX)\b[:\s]*(.*)/i;

export function runTodoFixme(file: ParsedFile): Finding[] {
  const findings: Finding[] = [];
  const comments = file.ast.comments ?? [];

  for (const comment of comments) {
    const match = TODO_PATTERN.exec(comment.value);
    if (!match) continue;

    const tag = match[1].toUpperCase();
    const description = match[2].trim();

    findings.push({
      ruleId: RULE_ID,
      severity: tag === 'FIXME' || tag === 'HACK' ? 'warning' : 'info',
      message: description ? `${tag}: ${description}` : `${tag} comment found`,
      line: comment.loc?.start.line ?? 0,
      column: comment.loc?.start.column ?? 0,
    });
  }

  return findings;
}