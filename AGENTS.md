# Working in this repo

See [CLAUDE.md](./CLAUDE.md) — same conventions apply regardless of which AI tool you are. In short:

- Commit messages and PR titles **must** follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`, `style:`, `ci:`, `perf:`, `revert:`). This isn't just style — `.github/workflows/version-bump.yml` parses these prefixes to auto-bump `package.json`'s version on every merge to `main`, and `.github/workflows/pr-title-check.yml` enforces the format on PR titles via CI.
- Validate any GitHub Actions workflow YAML locally before pushing: `python -c "import yaml; yaml.safe_load(open('.github/workflows/YOUR_FILE.yml'))"`.
- No unnecessary dependencies — this repo hand-rolls small utilities rather than pulling in a package.
- Tests: `npm test` (Node's built-in test runner). CI blocks the Docker build on a failing suite.
