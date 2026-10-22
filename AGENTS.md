# Working in this repo

See [CLAUDE.md](./CLAUDE.md) — same conventions apply regardless of which AI tool you are. In short:

- Commit messages and PR titles **must** follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`, `style:`, `ci:`, `perf:`, `revert:`). This isn't just style — the `version-bump` job in `.github/workflows/docker-build.yml` parses these prefixes to auto-bump `package.json`'s version on every merge to `main`, and `.github/workflows/pr-title-check.yml` enforces the format on PR titles via CI.
- Write commit messages, pull requests, `todo.md` and the server's console output **in English**, titles and bodies both. The app's own UI stays bilingual (NL/EN), and so do the error strings the server sends to clients — `translateServerMsg()` in `public/js/utils/i18n.js` matches on those, so changing one means changing its matcher too.
- Fill in `.github/pull_request_template.md` rather than writing a PR from scratch: what changed and why, how it was verified, what is left open.
- Validate any GitHub Actions workflow YAML locally before pushing: `python -c "import yaml; yaml.safe_load(open('.github/workflows/YOUR_FILE.yml'))"`.
- No unnecessary dependencies — this repo hand-rolls small utilities rather than pulling in a package.
- Tests: `npm test` (Node's built-in test runner). CI blocks the Docker build on a failing suite.
