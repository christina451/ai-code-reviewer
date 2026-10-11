#!/bin/bash
# Held-out corpus for precision validation — deliberately drawn from
# different directories than benchmark/corpus/ (the development set used
# to find and fix the no-unused-vars / no-unreachable false positives),
# and pinned to fixed commits so results are reproducible.
set -e

VSCODE_SHA=b462a87f74adb1d232705e771b9527ad8ec58f92
NEXTJS_SHA=c0c64a0ab154853f4c792fb7b22a81d1b04ce073

TARGET=benchmark/corpus-holdout
rm -rf "$TARGET"
mkdir -p "$TARGET"

echo "Cloning VS Code (pinned $VSCODE_SHA) — src/vs/base/node..."
git clone --filter=blob:none --sparse https://github.com/microsoft/vscode.git /tmp/vscode-holdout
cd /tmp/vscode-holdout
git sparse-checkout set src/vs/base/node
git checkout "$VSCODE_SHA"
cd -
cp /tmp/vscode-holdout/src/vs/base/node/*.ts "$TARGET"/ 2>/dev/null || true
rm -rf /tmp/vscode-holdout

echo "Cloning Next.js (pinned $NEXTJS_SHA) — packages/next/src/server/lib..."
git clone --filter=blob:none --sparse https://github.com/vercel/next.js.git /tmp/nextjs-holdout
cd /tmp/nextjs-holdout
git sparse-checkout set packages/next/src/server/lib
git checkout "$NEXTJS_SHA"
cd -
cp /tmp/nextjs-holdout/packages/next/src/server/lib/*.ts "$TARGET"/ 2>/dev/null || true
rm -rf /tmp/nextjs-holdout

find "$TARGET" -name "*.d.ts" -delete

echo "Done. Files in $TARGET/:"
ls "$TARGET" | wc -l
echo "files"
