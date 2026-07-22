# Working in this repo

## Commit & PR title convention (required)

Every commit message and PR title **must** follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <subject>
```

Allowed types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `style`, `ci`, `perf`, `revert`.

Examples:
- `feat: add auto-reveal option`
- `fix(reconnect): close race where a flaky reconnect creates a duplicate row`
- `chore(deps): bump express to 5.2.1`

### Why this actually matters here (not just tidiness)

`.github/workflows/version-bump.yml` reads commit messages on every merge to `main` and auto-bumps `package.json`'s version:

- `feat:` → minor bump
- `fix:` → patch bump
- `feat!:` / `fix!:` / a `BREAKING CHANGE:` footer → major bump
- anything else → no bump

Get the prefix wrong (or skip it) and the automation silently does nothing — the version display in the app's options modal (`/api/config` → `options-modal`) will quietly go stale, same failure mode that motivated adding this file.

`.github/workflows/pr-title-check.yml` enforces this on every PR title via CI (`amannn/action-semantic-pull-request`) — a red check means the title needs fixing before merge.

## Before pushing a new/changed GitHub Actions workflow

Validate the YAML locally first — GitHub's own error messages for workflow syntax errors are terse and the mistake is easy to make (see `fix(ci): fix invalid YAML in version-bump.yml`, PR #16, where a colon+space inside an unquoted `run:` value broke the parse). Quick check:

```bash
python -c "import yaml; yaml.safe_load(open('.github/workflows/YOUR_FILE.yml'))"
```

Prefer `run: |` (block scalar) over a single-line `run: <text>` whenever the text might contain a colon followed by a space — block scalars take content literally and sidestep this whole class of bug.

## General

- No unnecessary dependencies. This repo hand-rolls small utilities (rate limiter, logger, etc.) rather than pulling in a package for something a dozen lines of code covers. Match that when adding something new.
- Tests live in `tests/*.test.js`, run via `npm test` (Node's built-in test runner, no framework). CI (`docker-build.yml`) blocks the Docker build on a failing suite.
- See `todo.md` for the current backlog and what's already been done.
