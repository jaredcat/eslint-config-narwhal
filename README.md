# eslint-config-narwhal

Underwater unicorn — SonarJS wins when Unicorn conflicts.

Tiny ESLint 10+ flat config that disables Unicorn rules whose autofix fights SonarJS. Install `eslint-plugin-unicorn` and `eslint-plugin-sonarjs` yourself; Narwhal only resolves conflicts.

## Install

```bash
npm install -D github:jaredcat/eslint-config-narwhal
```

Peer dependencies (install separately if needed): `eslint`, `eslint-plugin-unicorn`, `eslint-plugin-sonarjs`.

## Usage

Spread **after** both recommended presets so Narwhal’s offs win:

```js
import unicorn from 'eslint-plugin-unicorn';
import sonarjs from 'eslint-plugin-sonarjs';
import narwhal from 'eslint-config-narwhal';

export default [
  unicorn.configs.recommended,
  sonarjs.configs.recommended,
  narwhal,
  // app-specific overrides after this
];
```

## What it disables

| Rule | Why Sonar wins |
| --- | --- |
| `unicorn/prefer-global-number-constants` | Sonar prefers `Number.NaN` / `Number.*` constants; Unicorn autofixes them to globals |

Duplicate Unicorn rules that Sonar reimplements are left alone — this package only turns off opposing autofix intent.

## License

MIT
