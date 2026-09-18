# Notes for AI assistants

Human setup, PR expectations, and the AI contribution policy are in [CONTRIBUTING.md](CONTRIBUTING.md). Follow that document. This file is the short working note for agents.

## Commands

Always use Yarn 4 (`yarn`), never npm, for this repo. Corepack provides the release pinned in `package.json` (`yarn@4.18.0`).

```sh
yarn install
yarn dev
yarn test
yarn check-types
yarn lint
yarn format:check
yarn check
```

Before finishing a change, `yarn check` (or format, lint, types, and tests separately) should pass. Do not bypass the pre-commit hook.

## Git

- Do not commit, push, or open a pull request unless the user asked.
- Do not push to a branch other than the one designated for the work.

## Code

- Match the style, naming, and comment density of the surrounding code.
- New function parameters are required. Thread them through call sites. Model a “none” case with `null` instead of making the parameter optional.
- Prefer `import type { … }` for type-only imports.
- When changing behavior, update unit tests in `src/__tests__/`.
- User-visible behavior: update `companion/HELP.md` and add an `[Unreleased]` note in `companion/CHANGELOG.md`.
- Do not invent obs-websocket requests, Companion `@companion-module/base` APIs, or options that are not in this repo or the real protocol.
- Do not add comments that only restate the code. Do not expand scope with unrelated cleanup.
