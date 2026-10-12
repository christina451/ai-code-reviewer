# Code Review Platform — Claude Code Reference

## What this project is
A full-stack AI-assisted code review platform. The core architectural decision:
the LLM is never just handed source code and asked to "review it." It receives
the source together with a structured JSON findings report from a deterministic
AST-based analysis engine, and is told to treat that report as ground truth.
The LLM handles reasoning (prioritize, explain, suggest). The engine handles facts
(complexity scores, nesting depth, line counts). Anything the LLM flags beyond the
report goes in a separate "Other Observations" section labelled as its own judgement.

## Architecture — layer order (strict, enforced by import paths)
domain → services → infra → app

- `src/domain/types.ts` — pure TypeScript types, no imports from anywhere
- `src/services/` — business logic + interfaces (AIService, ReviewRepository)
- `src/infra/` — concrete implementations (Postgres, Redis, OpenRouter, Gemini)
- `src/analysis/` — AST parsing + 6 static analysis rules
- `src/app/` — Next.js App Router pages and API route handlers (thin)
- `src/composition-root.ts` — the ONLY file allowed to wire concrete implementations

## Key files to understand
- `src/analysis/ast/visitor.ts` — typed visitor pattern, parent pointer assignment, 'skip' support
- `src/analysis/ast/parser.ts` — wraps typescript-estree, returns ParsedFile
- `src/analysis/rules/cyclomatic-complexity.ts` — sub-walk isolation pattern
- `src/analysis/rules/nesting-depth.ts` — why recursive function beats visitor here
- `src/services/ai-service.ts` — AIService interface, AsyncIterable<string> return type
- `src/services/review-orchestrator.ts` — sequences analysis → AI → persistence
- `src/infra/ai-providers/openrouter-ai-service.ts` — SSE parsing, streaming loop
- `src/infra/repositories/postgres-review-repository.ts` — rowToReview() mapping
- `src/infra/cache.ts` — content-hash keying, fail-silent pattern, fire-and-forget writes
- `src/app/api/review/route.ts` — why analysis runs BEFORE the stream starts
- `src/app/page.tsx` — discriminated union state machine

## Commands
npm run dev          # start dev server (requires docker compose up postgres redis -d first)
npm test             # run all tests (no database needed — all tests use mocks)
npm run benchmark    # accuracy evaluation for all 6 analysis rules
npm run migrate      # apply database migrations
npx tsc --noEmit     # type check

## Key design decisions to know
1. Why AsyncIterable not ReadableStream for AIService — testability, framework-agnostic
2. Why analysis runs before the stream starts — HTTP status codes are fixed once streaming begins
3. Why JSONB for analysis_result — always read as a unit, no cross-review queries
4. Why Redis fails silently — cache is optimization, not critical path
5. Why composition root not DI framework — serverless-style routes, no long-lived app container
6. Why sub-walk isolation in complexity — nested function complexity must not inflate outer score
7. Why recursive function for nesting depth — accumulated state across stack frames

## Known limitations to be aware of
- no-unused-vars: disabled in the pipeline (see `src/services/analysis-service.ts`) due to
  a false positive for closure captures (variable used in nested function flagged as unused
  in outer function). The underlying bug is still present in the rule itself and would need
  a full scope graph to fix; until then the rule is simply not run.
- Function names sometimes show as 'anonymous' for complex destructuring patterns
- Parser supports TS/JS/JSX/TSX only, not other languages

## Test strategy
Every rule has a test file co-located in src/analysis/rules/. 
All service tests use vi.fn() mocks — zero tests need a real database or network.
The orchestrator tests specifically verify the persistence lifecycle (pending → complete/error).