# Benchmark Methodology

## Overview

Two independent measurements of the static analysis engine:

**Recall** — Can the analyzer find issues when they exist?
Methodology: take real TypeScript files from open-source projects
(VS Code, Next.js), inject known issues into copies, measure detection rate.

**Precision** — When the analyzer reports an issue, is it correct?
Methodology: run the analyzer against unmodified real-world TypeScript files,
manually classify each finding as true positive or false positive.

## Dev set vs. held-out set

Precision was first measured against `benchmark/corpus/` (microsoft/vscode
`src/vs/base/common/`, vercel/next.js `packages/next/src/lib/`). That pass
surfaced two real bugs:

- `no-unused-vars` — false positive for closure captures: a variable declared
  in an outer function but only referenced inside a nested closure was
  flagged as unused, because the identifier-collection pass didn't descend
  into nested functions. This rule has since been **removed from the
  pipeline** (`src/services/analysis-service.ts`) rather than fixed — the
  underlying bug is still present in `no-unused-vars.ts`, it's just not run.
- `no-unreachable` — a helper `function` declaration placed after a `return`
  in the same block was flagged as dead code, even though function
  declarations are hoisted and the helper was actually called earlier in the
  function body. This one **was fixed**: `no-unreachable.ts` now skips
  `FunctionDeclaration` statements when scanning for code after a
  terminator.

Re-measuring precision against the same corpus after a bug fix is evaluating
on the set that found the bug — it will trivially look better. So precision
was re-measured against `benchmark/corpus-holdout/`, a second corpus pulled
from **different directories** of the same two projects
(`microsoft/vscode` `src/vs/base/node/`, `vercel/next.js`
`packages/next/src/server/lib/`) that was never used to find or fix
anything.

Reproducibility note: both `setup-corpus.sh` and `setup-corpus-holdout.sh`
now pin fixed commit SHAs for both source repos, so either one will always
regenerate the same file set. Neither `benchmark/corpus/` nor
`benchmark/corpus-holdout/` is committed to this repo — they're vendored
third-party source (MIT-licensed, from microsoft/vscode and vercel/next.js
respectively) and are `.gitignore`d rather than checked in; run the setup
scripts to (re)generate them before running the benchmark.

Caveat: the dev-set script's pin was added *after* the 246-finding result
below was produced — that original pull was unpinned, and its exact source
commit wasn't recorded. Re-running `setup-corpus.sh` now will reliably
reproduce the *same* corpus as every future run (it's pinned going
forward), but it is not guaranteed to be byte-for-byte identical to the
corpus that originally produced the 246/246 number, since vscode's
`src/vs/base/common/` may have changed between the original unpinned pull
and the commit now pinned. If you need to re-verify the exact 246 number,
re-run the full manual classification against whatever the pinned script
produces rather than assuming it matches without checking.

| Set | Files | Findings | Rules | Precision |
|---|---|---|---|---|
| Dev (`corpus/`) | 192 | 246 | function-length, cyclomatic-complexity, nesting-depth, todo-fixme | 246/246 (100%) |
| Held-out (`corpus-holdout/`) | 78 | 107 | function-length, cyclomatic-complexity, nesting-depth, todo-fixme | 107/107 (100%) |

`no-unused-vars` and `no-unreachable` are excluded from both totals above:
the former is disabled, the latter produced zero findings on either corpus
(the fixed pattern — dead code after a return, not counting the hoisted-function
case — is simply rare in real code).

## Corpus

**Dev set** (`benchmark/corpus/`) — 30-40+ TypeScript files sourced from:
- microsoft/vscode — `src/vs/base/common/`
- vercel/next.js — `packages/next/src/lib/`

**Held-out set** (`benchmark/corpus-holdout/`) — sourced from:
- microsoft/vscode — `src/vs/base/node/`
- vercel/next.js — `packages/next/src/server/lib/`

Both pulled via `setup-corpus.sh` / `setup-corpus-holdout.sh`, pinned to
fixed commit SHAs for reproducibility. Files selected to represent varied
complexity: simple utilities, complex algorithms, moderate-length functions.
Pure type definition files excluded (no function bodies = no findings to
evaluate).

## Running

```bash
# Dev set
bash benchmark/setup-corpus.sh
npm run benchmark:eval
# review benchmark/precision-review.csv, then:
npx tsx benchmark/precision.ts precision-review.csv

# Held-out set
bash benchmark/setup-corpus-holdout.sh
npx tsx benchmark/evaluate.ts corpus-holdout holdout
# review benchmark/precision-review-holdout.csv, then:
npx tsx benchmark/precision.ts precision-review-holdout.csv
```

`evaluate.ts` takes two optional args: `[corpusDirName] [outputSuffix]`.
With no args it reads `benchmark/corpus/` and writes
`recall-results.csv` / `precision-review.csv` (the dev set, matching the
original default behavior). Passing a corpus dir name and suffix reads a
different corpus and writes suffixed output files instead, so a held-out
run never overwrites the dev-set results.

For each row in the CSV, set `true_positive` to 1 (correct) or 0 (false
positive) — look at the actual file + line number to make the judgment.

## Seeded issues (recall)

For each file in the seeding subset, five issues are injected into a copy:
- Cyclomatic complexity: function with 11 if-statements (complexity 12)
- Function length: function with 55 body lines (58 lines total)
- Nesting depth: 5 nested if-statements (depth 5)
- Unreachable code: return statement followed by a dead statement
- TODO comment: `// TODO: BENCHMARK_SEEDED` line

Injected functions use `__seeded_` prefix to distinguish from original code.

## What the numbers mean

Recall answers: "When an issue exists, does the analyzer find it?"
Precision answers: "When the analyzer reports an issue, is it correct?"

These are separate questions. A rule can have high recall (finds everything)
but lower precision (some false positives) — which is exactly what the dev-set
pass against `no-unused-vars` and `no-unreachable` showed before the fixes
above.
