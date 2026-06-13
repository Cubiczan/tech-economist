#!/usr/bin/env bash
# Push tech-economist to Codeberg and both GitHub owners.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_NAME="tech-economist"
PUBLISH_ROOT="${PUBLISH_ROOT:-$(dirname "$(dirname "${SOURCE_ROOT}")")/${REPO_NAME}}"

parent_toplevel="$(git -C "${SOURCE_ROOT}" rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -n "${parent_toplevel}" && "${parent_toplevel}" != "${SOURCE_ROOT}" ]]; then
  if [[ ! -d "${PUBLISH_ROOT}/.git" ]]; then
    echo "ERROR: Standalone publish repo not initialized."
    echo "Run ./scripts/publish-init-repo.sh first."
    exit 1
  fi
  ROOT="${PUBLISH_ROOT}"
else
  ROOT="${SOURCE_ROOT}"
fi

cd "${ROOT}"

if [[ ! -d .git ]]; then
  echo "ERROR: No git repo in ${ROOT}. Run ./scripts/publish-init-repo.sh first."
  exit 1
fi

for remote in codeberg github-icohangar github-cubiczan; do
  if ! git remote get-url "${remote}" >/dev/null 2>&1; then
    echo "ERROR: Missing remote '${remote}'. Run ./scripts/publish-init-repo.sh first."
    exit 1
  fi
  url="$(git remote get-url "${remote}")"
  if [[ "${url}" != *"${REPO_NAME}"* ]]; then
    echo "ERROR: Remote '${remote}' points to ${url}"
    echo "       Expected a URL containing '${REPO_NAME}'. Run publish-init-repo.sh again."
    exit 1
  fi
done

for remote in codeberg github-icohangar github-cubiczan; do
  echo "=== Pushing to ${remote} ==="
  git push -u "${remote}" main
done

echo ""
echo "Done. Published from: ${ROOT}"
echo "  Codeberg:        https://codeberg.org/cubiczan/tech-economist"
echo "  GitHub (org):    https://github.com/icohangar-ops/tech-economist"
echo "  GitHub (user):   https://github.com/cubiczan/tech-economist"
