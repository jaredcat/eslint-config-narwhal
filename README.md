# eslint-config-narwhal

## Sonar + Unicorn = Narwhal

Callable flat ESLint preset: `@eslint/js` recommended + Unicorn recommended + SonarJS recommended + Unicorn offs for autofix fights, with optional TypeScript and Prettier layers. Consumers only install this package (and `eslint`).

## Install

```bash
npm install -D eslint eslint-config-narwhal
```

`@eslint/js`, `eslint-plugin-unicorn`, `eslint-plugin-sonarjs`, `typescript-eslint`, and `eslint-config-prettier` are bundled as dependencies.

## Usage

```js
import narwhal from 'eslint-config-narwhal';

export default [
  ...narwhal(), // @eslint/js + unicorn + sonarjs + conflict offs
];
```

### Options

| Option        | Default | Effect                                                                                |
| ------------- | ------- | ------------------------------------------------------------------------------------- |
| `eslint`      | `true`  | Include `@eslint/js` recommended.                                                     |
| `typescript`  | `false` | Include typescript-eslint. Implied if `typechecked`, `strict`, or `stylistic` is set. |
| `typechecked` | `false` | Use `*TypeChecked` typescript-eslint configs.                                         |
| `strict`      | `false` | Use `strict*` instead of `recommended*`.                                              |
| `stylistic`   | `false` | Also include `stylistic` / `stylisticTypeChecked`.                                    |
| `prettier`    | `false` | Append `eslint-config-prettier` last.                                                 |

```js
import narwhal from 'eslint-config-narwhal';

export default [
  ...narwhal({
    typescript: true,
    typechecked: true,
    strict: true,
    stylistic: true,
    prettier: true,
  }),
  {
    languageOptions: {
      parserOptions: {
        // Shape is yours — narwhal does not bake this in.
        projectService: {
          allowDefaultProject: ['*.js', 'eslint.config.js'],
        },
        // Must be set in the consumer (path differs per repo).
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];
```

`typechecked: true` does **not** bake in `projectService` or `tsconfigRootDir` — those stay in your config. It does turn off type-checked typescript-eslint rules for `eslint.config.*` files (same glob as the unicorn entrypoint override).

Use `allowDefaultProject` only when the config file sits outside your tsconfig; if it’s included (e.g. via `allowJs: true`), omit it and use `projectService: true` instead.

## What it disables

<!-- narwhal:rules -->

| Rule                                     | Why Sonar wins                                                                           |
| ---------------------------------------- | ---------------------------------------------------------------------------------------- |
| `unicorn/prefer-global-number-constants` | Sonar-aligned prefer-number-properties wants Number.NaN; Unicorn autofix rewrites to NaN |

<!-- /narwhal:rules -->

Duplicate Unicorn rules that Sonar reimplements are left alone — this package only turns off opposing autofix intent.

It also turns off `unicorn/no-top-level-side-effects` for `eslint.config.*` files, which must evaluate a top-level export. With `typechecked: true`, those files also get `typescript-eslint`’s `disableTypeChecked` so typed rules don’t require them to be in a TS project.

Regenerate offs after bumping peers: `npm run sync`.

This repo dogfoods the same entry via [`eslint.config.js`](eslint.config.js) (`npm run lint`).

## Automation

- Daily workflow bumps `eslint` / `@eslint/js` / unicorn / sonarjs / typescript-eslint / eslint-config-prettier, runs `npm run sync`, then lint/test.
- If `conflicts.json` is **unchanged**, it patch-bumps the package version and merges without review.
- If conflict offs **change**, it opens a PR and leaves it for review.
- Pushing a new `package.json` version to `main` creates a GitHub release tag (`v*`) and publishes to npm.

## License

MIT
