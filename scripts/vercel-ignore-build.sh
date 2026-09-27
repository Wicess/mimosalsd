#!/usr/bin/env bash
#
# Vercel "Ignored Build Step".
#
# Set it in Vercel → Settings → Git → Ignored Build Step → "Run my Bash command":
#
#     bash scripts/vercel-ignore-build.sh
#
# Exit 0 = SKIP the build. Exit 1 = BUILD. (Vercel's convention, and it reads
# backwards, so the echo lines below say which branch was taken.)
#
# WHY THIS EXISTS. Vercel bills build CPU, and a Next 16 + `prisma generate` build
# is not a cheap one. This repo took 49 commits in 35 days, every one of them on a
# branch Vercel is watching, and every one of them paid for a preview deployment
# nobody opened. Build minutes are the one meter that scales with how much you
# COMMIT rather than how much traffic you get, which is why it is the meter that
# bites a developer with a dozen projects and a handful of visitors.
#
# What this does NOT do: it never skips a production build that touched real code.
# Cost work must not cost you a deploy.

set -euo pipefail

# ── Production ───────────────────────────────────────────────────────────────
if [ "${VERCEL_ENV:-}" = "production" ]; then
  # Docs-only pushes still rebuild the whole site for a changed sentence in a
  # markdown file. `docs/` and `*.md` ship nothing to the browser.
  #
  # Guarded: a shallow clone can leave HEAD^ unreachable, and "cannot compare"
  # must mean BUILD, never "skip". Silence is not a reason to not deploy.
  if git rev-parse --verify --quiet HEAD^ >/dev/null; then
    if git diff --quiet HEAD^ HEAD -- . ':!*.md' ':!*.mdx' ':!docs/**'; then
      echo "SKIP · production, but only docs/markdown changed."
      exit 0
    fi
  fi
  echo "BUILD · production."
  exit 1
fi

# ── Previews ─────────────────────────────────────────────────────────────────
# Off by default. Opt IN per commit, so a preview is something you ask for rather
# than something 49 commits hand you.
#
#     git commit -m "feat(pdp): sticky ATC [preview]"
#
# The trailer is read from the commit message Vercel is building, not from the
# branch, so one commit in a long branch can be previewed without turning the
# rest of them back on.
MESSAGE="$(git log -1 --pretty=%B 2>/dev/null || echo '')"

case "$MESSAGE" in
  *"[preview]"*|*"[deploy]"*)
    echo "BUILD · preview requested by a [preview] trailer in the commit message."
    exit 1
    ;;
esac

echo "SKIP · preview build. Add [preview] to the commit message to force one."
exit 0
