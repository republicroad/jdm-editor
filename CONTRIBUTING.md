# Contributing to JDM Editor

Want to contribute to JDM Editor? There are a few things you need to know.

## Install

This repository use pnpm package manager, to install the dependencies run:

`pnpm i`

## Storybook

A storybook is available to check your changes.
To dev with Storybook run:

`pnpm storybook`

## Build

To check the package output run:

`pnpm build`

## Tests

To check tests run:

`pnpm test`

Add tests to cover new code and be sure that coverage didn't decrease with:

`pnpm test:coverage`

## Lint

To check if your code don't have any lint or prettier problem run:

`pnpm format`

To fix problems run:

`pnpm format:fix`

## Verify (full pre-commit gate)

Run the whole battery — lint, types, React-compiler rules, style-debt budget
(`!important` / raw-hex caps) and unit tests — with one command:

`pnpm verify`

Requires `pnpm` on your PATH (`corepack enable` once covers it). Treat any
failure as blocking. New `!important` or raw hex literals need an explicit
`GRL-STYLE-HACK` marker + a registry row in
`docs/shadcn-theming-roadmap.zh-CN.md` Appendix A, or they will fail
`lint:debt`.

Palette work? Open Storybook → **Theming → Seeds Playground** to see seed
derivations live (`computeTheme` in `src/theming/compute.ts`).

## Git commits

This repository use [Commitizen](https://github.com/commitizen/cz-cli).
When you commit with Commitizen, you'll be prompted to fill out any required commit fields at commit time.

You need to run `git cz` and you'll be prompted to fill in any required fields, and your commit messages will be formatted according to the standards defined by react-js-cron.

## Git Hooks (pre-commit)

A husky pre-commit hook runs `lint-staged` on every commit: **prettier --write**
and **eslint --fix** are applied to staged `.ts/.tsx/.mjs/.css/.json/.md` files
automatically. Formatted results are re-staged before the commit lands.

Requires `pnpm` on your PATH (`corepack enable` once covers it). The `prepare`
script in the root `package.json` activates husky on `pnpm install`.

## CI Workflows

CI is defined in `.github/workflows/`. All workflows run on the `reui` branch.

### Validate (`validate.yaml`)

Triggers on **every push** and **pull request** to `reui`/`master`. Runs the
full battery:

| Step                        | What it does                                                                                                    |
| --------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Lint and prettier           | `pnpm format` (eslint + prettier --check)                                                                       |
| React Compiler readiness    | `pnpm lint:compiler`                                                                                            |
| **Style-debt budget**       | `pnpm lint:debt` — fails on `!important`/raw-hex budget growth                                                  |
| Build                       | `pnpm build`                                                                                                    |
| Test                        | `pnpm test` (vitest, 227 tests)                                                                                 |
| Type check                  | `pnpm typecheck`                                                                                                |
| Bundle size budget          | `pnpm size`                                                                                                     |
| Playwright chromium         | `pnpm exec playwright install --with-deps chromium`                                                             |
| Storybook interaction suite | `pnpm --filter @republicroad/jdm-editor test:storybook` (8 suites / 57 stories incl. LazyParity geometry guard) |
| Consumer smoke              | `pnpm test:consumer` (dual-host React 18 & 19 Vite build)                                                       |

### Publish (`publish.yaml`)

Triggers on every push but the job **only executes** when the HEAD commit
message starts with `chore(release)`. Runs `pnpm build` → `lerna publish
from-package --yes` → publishes `@republicroad/jdm-editor` to npm using the
`NPM_TOKEN` secret.

**To release a version:**

```bash
# 1. Ensure all code changes are committed and pushed
# 2. Create the release trigger (empty commit)
git commit --allow-empty -m "chore(release)"
git push
# 3. CI builds and publishes @republicroad/jdm-editor@<current version>
```

### Version (`version.yaml`)

Manual dispatch (`workflow_dispatch`) with a version selector (patch / minor /
major). Uses `lerna version` to bump the package version and create a tagged
release commit. Requires the `PAT` secret for cross-repo push permissions.

## NPM Token Setup (one-time)

1. Log in to [npmjs.com](https://www.npmjs.com)
2. Create the `@republicroad` organization (Free tier is sufficient)
3. Avatar → **Access Tokens** → Generate New Token → **Classic** → type
   **Automation**
4. Copy the token value
5. Go to your GitHub repo → **Settings → Secrets and variables → Actions**
6. Update or create `NPM_TOKEN` with the token value

## Storybook Test Suite

```bash
pnpm --filter @republicroad/jdm-editor test:storybook
```

Builds Storybook, serves it on port 9009, and runs the test-runner (8 suites /
57 stories) in headless Chromium. Includes the **LazyParity** geometry guard.
Requires port 9009 to be free — stop any dev server first.

## Bundle Size

```bash
pnpm size
```

Checks dist output against size budgets defined in `scripts/size-budgets.json`.
