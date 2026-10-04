# eslint-config-narwhal

## Sonar + Unicorn = Narwhal

One flat ESLint preset: Unicorn recommended + SonarJS recommended + Unicorn offs for autofix fights. Consumers only install this package (and `eslint`).

## Install

```bash
npm install -D eslint eslint-config-narwhal
```

`eslint-plugin-unicorn` and `eslint-plugin-sonarjs` are bundled as dependencies.

## Usage

```js
import narwhal from 'eslint-config-narwhal';

export default [
  ...narwhal,
  // app-specific overrides after this
];
```

## What it disables

<!-- narwhal:rules -->

| Rule                                     | Why Sonar wins                                                                           |
| ---------------------------------------- | ---------------------------------------------------------------------------------------- |
| `unicorn/prefer-global-number-constants` | Sonar-aligned prefer-number-properties wants Number.NaN; Unicorn autofix rewrites to NaN |

<!-- /narwhal:rules -->

Duplicate Unicorn rules that Sonar reimplements are left alone — this package only turns off opposing autofix intent.

It also turns off `unicorn/no-top-level-side-effects` for `eslint.config.*` files, which must evaluate a top-level export.

Regenerate offs after bumping peers: `npm run sync`.

This repo dogfoods the same entry via [`eslint.config.js`](eslint.config.js) (`npm run lint`).

## Automation

- Daily workflow bumps `eslint` / unicorn / sonarjs, runs `npm run sync`, then lint/test.
- If `conflicts.json` is **unchanged**, it patch-bumps the package version and merges without review.
- If conflict offs **change**, it opens a PR and leaves it for review.
- Pushing a new `package.json` version to `main` creates a GitHub release tag (`v*`) and publishes to npm.

## License

MIT
