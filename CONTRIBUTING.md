# Contributing

Bug reports, feature requests, and pull requests are welcome. For user-facing behavior, start with [companion/HELP.md](companion/HELP.md).

## Setup

This module uses **Node.js 26** and **Yarn 4**. Node 26 does not ship Corepack, so install it once, then enable it so `yarn` matches `packageManager` in `package.json`:

```sh
npm install -g corepack
corepack enable
yarn install
yarn dev
```

`yarn dev` compiles TypeScript in watch mode. Load the module from Companion’s or Buttons’ local module development folder.

Useful checks:

```sh
yarn test
yarn check-types
yarn lint
yarn format:check
```

Run format, lint, and tests together with `yarn check`. A pre-commit hook runs lint on staged files. CI runs format, lint, types, and tests on every push and pull request.

## Layout

- `src/` — module source (`main.ts`, actions, feedbacks, presets, variables, OBS WebSocket client)
- `src/__tests__/` — Vitest unit tests
- `companion/HELP.md` — in-app help
- `companion/CHANGELOG.md` — Keep a Changelog, SemVer
- `companion/manifest.json` — connection metadata

## Pull requests

- Keep the change focused. Do not mix unrelated refactors with a bug fix.
- Match the style and comment density of the surrounding code. Prettier uses tabs, no semicolons, and single quotes.
- Prefer `import type` for type-only imports.
- When you change behavior, add or update tests. Do not rely on manual testing alone.
- User-visible changes belong in `companion/HELP.md` and under `[Unreleased]` in `companion/CHANGELOG.md`.
- Do not commit `dist/`, `node_modules/`, or secrets.

## AI-assisted contributions

Using an AI coding tool is fine. You are still the author of the pull request.

- You must understand every change and be able to explain it in review.
- Run `yarn check` (or the equivalent CI jobs) before you open the PR.
- Do not submit large unreviewed generated diffs, extra comments that only restate the code, or drive-by refactors.
- Do not invent OBS WebSocket APIs, Companion module APIs, or user-facing options. Match existing patterns in this repo and the real `obs-websocket` protocol.

Coding agents should follow [AGENTS.md](AGENTS.md).
