#!/bin/bash
# Dev corpus for precision/recall validation — the set used to find and fix
# the no-unused-vars / no-unreachable false positives (see
# benchmark/README.md). Pinned to fixed commits so it's reproducible without
# depending on live GitHub state. NOTE: the corpus currently on disk (if any)
# may predate this pin and was pulled unpinned — see README for that history.
set -e

VSCODE_SHA=150119bd223150e10f6bf341435e680cd8f26d4b
NEXTJS_SHA=5770bfc5b138e58aaeb39146bf1f41307b6634d7

TARGET=benchmark/corpus
rm -rf "$TARGET"
mkdir -p "$TARGET"

echo "Cloning VS Code (pinned $VSCODE_SHA) — src/vs/base/common..."
git clone --filter=blob:none --sparse https://github.com/microsoft/vscode.git /tmp/vscode-dev
cd /tmp/vscode-dev
git sparse-checkout set src/vs/base/common
git checkout "$VSCODE_SHA"
cd -
cp /tmp/vscode-dev/src/vs/base/common/*.ts "$TARGET"/ 2>/dev/null || true
rm -rf /tmp/vscode-dev

echo "Cloning Next.js (pinned $NEXTJS_SHA) — packages/next/src/lib..."
git clone --filter=blob:none --sparse https://github.com/vercel/next.js.git /tmp/nextjs-dev
cd /tmp/nextjs-dev
git sparse-checkout set packages/next/src/lib
git checkout "$NEXTJS_SHA"
cd -
cp /tmp/nextjs-dev/packages/next/src/lib/*.ts "$TARGET"/ 2>/dev/null || true
rm -rf /tmp/nextjs-dev

find "$TARGET" -name "*.d.ts" -delete

echo "Done. Files in $TARGET/:"
ls "$TARGET" | wc -l
echo "files"
