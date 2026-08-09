import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, buildUserMessage } from './prompt-builder';
import type { ReviewRequest } from '@/services/ai-service';
import type { AnalysisResult } from '@/domain/types';

const mockResult: AnalysisResult = {
  filename: 'auth.ts',
  language: 'TypeScript',
  lineCount: 42,
  summary: { totalFindings: 2, errors: 1, warnings: 1, infos: 0 },
  findings: [
    {
      ruleId: 'cyclomatic-complexity',
      severity: 'error',
      message: "Function 'login' has cyclomatic complexity of 22",
      line: 5,
      column: 0,
      context: 'login',
      value: 22,
    },
  ],
  functions: [
    {
      name: 'login',
      startLine: 5,
      lineCount: 30,
      cyclomaticComplexity: 22,
      maxNestingDepth: 5,
    },
  ],
};

const mockRequest: ReviewRequest = {
  analysisResult: mockResult,
  source: 'function login() { /* ... */ }',
};

describe('prompt-builder', () => {

  describe('buildSystemPrompt', () => {
    it('instructs the LLM not to dispute the analysis findings', () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain('deterministic and accurate');
    });

    it('defines the four required output sections', () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain('## Summary');
      expect(prompt).toContain('## Issues');
      expect(prompt).toContain('## Maintainability');
      expect(prompt).toContain('## Suggested Tests');
    });

    it('asks for a maintainability score', () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain('1');
      expect(prompt).toContain('10');
    });
  });

  describe('buildUserMessage', () => {
    it('includes the filename', () => {
      const message = buildUserMessage(mockRequest);
      expect(message).toContain('auth.ts');
    });

    it('includes the serialized analysis result JSON', () => {
      const message = buildUserMessage(mockRequest);
      expect(message).toContain('cyclomatic-complexity');
      expect(message).toContain('"totalFindings": 2');
    });

    it('includes the source code in a fenced code block', () => {
      const message = buildUserMessage(mockRequest);
      expect(message).toContain('```typescript');
      expect(message).toContain('function login()');
    });

    it('uses lowercase language name in the code fence', () => {
      const message = buildUserMessage(mockRequest);
      // Language is "TypeScript" in the result but "typescript" in the fence
      expect(message).toContain('```typescript');
      expect(message).not.toContain('```TypeScript');
    });
  });

});