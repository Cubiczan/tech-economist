#!/usr/bin/env bash
# Initialize tech-economist as a standalone repo and wire remotes for Codeberg + GitHub.
# When run inside compliance-as-code-agent, syncs to a sibling standalone directory first.
set -euo pipefail

SOURCE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO_NAME="tech-economist"
CODEBERG_OWNER="${CODEBERG_OWNER:-cubiczan}"
GITHUB_ICOHANGAR_OWNER="${GITHUB_ICOHANGAR_OWNER:-icohangar-ops}"
GITHUB_CUBICZAN_OWNER="${GITHUB_CUBICZAN_OWNER:-cubiczan}"
USE_SSH="${USE_SSH:-N}"
PUBLISH_ROOT="${PUBLISH_ROOT:-$(dirname "$(dirname "${SOURCE_ROOT}")")/${REPO_NAME}}"

if [[ "${USE_SSH}" =~ ^[Yy] ]]; then
  codeberg_url() { echo "git@codeberg.org:${CODEBERG_OWNER}/${REPO_NAME}.git"; }
  github_icohangar_url() { echo "git@github.com:${GITHUB_ICOHANGAR_OWNER}/${REPO_NAME}.git"; }
  github_cubiczan_url() { echo "git@github.com:${GITHUB_CUBICZAN_OWNER}/${REPO_NAME}.git"; }
else
  codeberg_url() { echo "https://codeberg.org/${CODEBERG_OWNER}/${REPO_NAME}.git"; }
  github_icohangar_url() { echo "https://github.com/${GITHUB_ICOHANGAR_OWNER}/${REPO_NAME}.git"; }
  github_cubiczan_url() { echo "https://github.com/${GITHUB_CUBICZAN_OWNER}/${REPO_NAME}.git"; }
fi

parent_toplevel="$(git -C "${SOURCE_ROOT}" rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -n "${parent_toplevel}" && "${parent_toplevel}" != "${SOURCE_ROOT}" ]]; then
  echo "Nested inside ${parent_toplevel} — syncing to standalone publish dir:"
  echo "  ${PUBLISH_ROOT}"
  mkdir -p "${PUBLISH_ROOT}"
  rsync -a --delete \
    --exclude ".git" \
    --exclude "backend/.venv" \
    --exclude "backend/data" \
    "${SOURCE_ROOT}/" "${PUBLISH_ROOT}/"
  ROOT="${PUBLISH_ROOT}"
else
  ROOT="${SOURCE_ROOT}"
fi

cd "${ROOT}"

if [[ ! -d .git ]]; then
  git init
  git branch -M main
fi

git remote remove codeberg 2>/dev/null || true
git remote remove github-icohangar 2>/dev/null || true
git remote remove github-cubiczan 2>/dev/null || true
git remote remove github 2>/dev/null || true
git remote remove origin 2>/dev/null || true
git remote add codeberg "$(codeberg_url)"
git remote add github-icohangar "$(github_icohangar_url)"
git remote add github-cubiczan "$(github_cubiczan_url)"

git add -A
if git diff --cached --quiet; then
  echo "Nothing to commit."
else
  git commit -m "Initial Tech Economist CFO dashboard for AI token ROI tracking."
fi

echo ""
echo "Publish directory: ${ROOT}"
echo "Remotes:"
git remote -v
echo ""
echo "Next: ./scripts/publish-push.sh"
echo "  (or: cd \"${ROOT}\" && ./scripts/publish-push.sh)"
