# Working in this repo

See [CLAUDE.md](./CLAUDE.md) — same conventions apply regardless of which AI tool you are. In short:

- Commit messages and PR titles **must** follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`, `style:`, `ci:`, `perf:`, `revert:`). This isn't just style — the `version-bump` job in `.github/workflows/docker-build.yml` parses these prefixes to auto-bump `package.json`'s version on every merge to `main`, and `.github/workflows/pr-title-check.yml` enforces the format on PR titles via CI.
- **System in English, UI bilingual.** Commit messages, PRs, `todo.md`, the server's console output, API error bodies and the error strings sent over the socket are all English; there is no Dutch left in `src/`. Only the app's UI is bilingual (NL/EN), through `public/js/utils/i18n.js`. `translateServerMsg()` there matches the server's sentences by substring, so rewording one in `src/` means updating its matcher and `tests/serverMessages.test.js` in the same commit.
- Fill in `.github/pull_request_template.md` rather than writing a PR from scratch: what changed and why, how it was verified, what is left open.
- Validate any GitHub Actions workflow YAML locally before pushing: `python -c "import yaml; yaml.safe_load(open('.github/workflows/YOUR_FILE.yml'))"`.
- No unnecessary dependencies — this repo hand-rolls small utilities rather than pulling in a package.
- Tests: `npm test` (Node's built-in test runner). CI blocks the Docker build on a failing suite.
