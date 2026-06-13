# Publishing Tech Economist

Standalone repo published to three remotes:

| Remote | URL |
|--------|-----|
| Codeberg | `https://codeberg.org/cubiczan/tech-economist` |
| GitHub (org) | `https://github.com/icohangar-ops/tech-economist` |
| GitHub (user) | `https://github.com/cubiczan/tech-economist` |

## One-time setup

`tech-economist` lives inside `compliance-as-code-agent`. The publish scripts **sync to a standalone sibling directory** (default: `~/Projects/tech-economist`) before pushing — they do not push from the monorepo.

### 1. Create empty repos (if they do not exist)

On each host, create a **private or public** empty repo named `tech-economist` (no README, no .gitignore).

- Codeberg: https://codeberg.org/repo/create
- GitHub icohangar-ops: https://github.com/organizations/icohangar-ops/repositories/new
- GitHub cubiczan: https://github.com/new

### 2. Initialize and wire remotes

```bash
cd ~/Projects/compliance-as-code-agent/tech-economist
./scripts/publish-init-repo.sh
```

This syncs files to `~/Projects/tech-economist`, initializes git there, and adds the three remotes.

Optional: use a different publish directory:

```bash
PUBLISH_ROOT=~/src/tech-economist ./scripts/publish-init-repo.sh
```

### 3. Push

```bash
./scripts/publish-push.sh
```

## Notes

- Publish always runs from the **standalone** copy at `~/Projects/tech-economist` (or `PUBLISH_ROOT`).
- Do not run `git push` from inside `compliance-as-code-agent` — parent remotes point elsewhere.
- `backend/data/*.db`, `.venv/`, `node_modules/`, and `dist/` are gitignored.
