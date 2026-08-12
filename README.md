# Code Review Platform

AI-assisted code review with a deterministic static analysis engine.

The key architectural decision: the LLM never sees raw source code and gets asked to "review it." It receives a structured JSON findings report computed by an AST-based analysis engine — only then does it prioritize, explain, and suggest fixes. Deterministic metrics are computed deterministically. The LLM handles reasoning, not fact-finding.

## How it works

```
Source file
    │
    ▼
┌─────────────┐
│ AST Parser  │  @typescript-eslint/typescript-estree
└──────┬──────┘
       │ ParsedFile (typed AST + loc info)
       ▼
┌─────────────────────────┐
│  Static Analysis Rules  │  deterministic, zero network calls
│  • Cyclomatic complexity│
│  • Function length      │
│  • Nesting depth        │
│  • Unreachable code     │
│  • Unused variables     │
│  • TODO/FIXME detection │
└──────────┬──────────────┘
           │ AnalysisResult (structured JSON)
           ▼
┌──────────────────────────┐
│     AI Review Layer      │  OpenRouter or Gemini (swappable)
│  system: be a reviewer   │
│  user: <findings JSON>   │
│         <source code>    │
└──────────┬───────────────┘
           │ AsyncIterable<string> (SSE tokens)
           ▼
     Streaming UI
```

## Architecture

Four-layer design with strict dependency direction (each layer only imports from the layer below it):

```
src/
├── app/              # Next.js App Router — thin route handlers only
├── services/         # Business logic + interfaces (AIService, ReviewRepository)
├── infra/            # Concrete implementations (Postgres, Redis, OpenRouter, Gemini)
│   ├── ai-providers/
│   ├── repositories/
│   └── db/
├── analysis/         # AST parsing + static analysis rules
│   ├── ast/          # parser.ts, visitor.ts, utils.ts
│   └── rules/        # one file per rule + tests
└── domain/           # Pure TypeScript types — no framework imports
```

Key patterns: Repository pattern, Strategy/Adapter (AIService), Dependency Inversion, composition root for manual DI, discriminated union state machines on the frontend.

## Benchmark results

Run `npm run benchmark` to evaluate all static analysis rules against a corpus of known-good and known-bad TypeScript snippets.

## Tech stack

- **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes, layered architecture
- **Database:** PostgreSQL 16 (JSONB for analysis results)
- **Cache:** Redis 7 (content-hash keyed, fail-silent)
- **AST:** @typescript-eslint/typescript-estree
- **AI:** OpenRouter or Google Gemini (swappable via env var)
- **Tests:** Vitest (70+ unit and integration tests)
- **Infra:** Docker Compose, multi-stage Dockerfile

## Setup

**Prerequisites:** Node.js 20+, Docker Desktop

```bash
# 1. Clone and install
git clone https://github.com/<you>/code-review-platform.git
cd code-review-platform
npm install

# 2. Configure environment
cp .env.example .env
# Fill in GEMINI_API_KEY (free) or OPENROUTER_API_KEY

# 3. Start databases
docker compose up postgres redis -d

# 4. Run migrations
npm run migrate
```

## Running

```bash
npm run dev          # http://localhost:3000
npm test             # unit + integration tests
npm run benchmark    # static analysis accuracy report
npx tsc --noEmit     # type checking
```

## Key design decisions

**Why separate AST analysis from the LLM call?**
Cyclomatic complexity has an exact mathematical answer. Letting an LLM compute it produces a probabilistic guess at a deterministic fact. The analysis engine computes metrics precisely; the LLM reasons over them.

**Why `AsyncIterable<string>` for the AIService interface?**
Framework-agnostic, trivially mockable with `async function*`, and easily converted to `ReadableStream` at the HTTP boundary. The interface stays clean; the conversion lives in one place.

**Why two AI provider implementations?**
`OpenRouterAIService` and `GeminiAIService` both implement `AIService`. The composition root selects between them via a single environment variable. This proves the abstraction holds — the orchestrator and route handlers are genuinely unaware of which provider is active.

**Why JSONB for analysis results in Postgres?**
Analysis results are always read as a unit — there is no query that needs findings without their parent review. JSONB is the right call when data is always consumed together.

**Why fail-silent on Redis errors?**
Cache unavailability should degrade to slower responses, not broken reviews. Every Redis call is wrapped in try/catch that returns null on failure.