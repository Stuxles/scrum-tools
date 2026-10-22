<!--
Write pull requests and commit messages in English, as todo.md and the
server's console output now are. The app's UI is bilingual (NL/EN) and so are
the error strings the server sends to clients — this is about the repo's
history and its logs, not its UI.

The PR title must follow Conventional Commits: `<type>(<scope>): <subject>`.
`.github/workflows/pr-title-check.yml` enforces it on every PR, and the type
decides the version bump on merge (`feat:` minor, `fix:` patch, `!`/
`BREAKING CHANGE:` major, anything else no bump). See CLAUDE.md for why
getting this wrong fails silently.
-->

## What this changes

<!--
The problem first, then the fix. For a bug, lead with how it showed up — the
symptom someone actually noticed, not the line of code. State the root cause
rather than the symptom, and say so plainly if you only have a plausible
cause rather than a proven one.

Trade-offs taken on purpose belong here too, not in a review comment later.
-->

## How it was verified

<!--
`npm test` is the floor, not the answer — CI runs it anyway and blocks the
Docker build on a failure. What earns trust is what you checked beyond it: a
reproduction that failed before the fix and passes after, the screen width
and browser for anything visual, a log line before and after, the numbers out
of a measurement.

If something genuinely cannot be tested here, say that and say why.
-->

- [ ] `npm test` passes
- [ ] Reproduced the problem before fixing it, where this is a bug
- [ ] Regression test added, or a note above on why it isn't testable here
- [ ] Workflow YAML parsed locally, if `.github/workflows/` changed:
      `python -c "import yaml; yaml.safe_load(open('.github/workflows/FILE.yml'))"`

## Anything left open

<!--
Known gaps, deliberate omissions, follow-ups parked in todo.md. Delete this
section if there are none — an empty heading is worse than no heading.
-->
