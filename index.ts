import type { Linter } from 'eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';
import tseslint from 'typescript-eslint';
import { conflictOffs } from './generated-offs.ts';

export interface NarwhalOptions {
  /**
  Include typescript-eslint. Default false. Implied true if typechecked, strict, or stylistic.
  */
  typescript?: boolean;
  /**
  Use *TypeChecked typescript-eslint configs. Default false. Requires projectService/project in the consumer.
  */
  typechecked?: boolean;
  /**
  Use strict* typescript-eslint configs instead of recommended*. Default false.
  */
  strict?: boolean;
  /**
  Also include stylistic / stylisticTypeChecked. Default false.
  */
  stylistic?: boolean;
  /**
  Append eslint-config-prettier. Default false.
  */
  prettier?: boolean;
}

type TypescriptEslintConfigKey =
  'recommended' | 'strict' | 'recommendedTypeChecked' | 'strictTypeChecked';

const base: Linter.Config[] = [
  unicorn.configs.recommended,
  sonarjs.configs.recommended,
  {
    name: 'narwhal/sonar-over-unicorn',
    rules: conflictOffs,
  },
  {
    name: 'narwhal/eslint-config-entrypoint',
    files: ['**/eslint.config.{js,cjs,mjs,ts,cts,mts}'],
    rules: {
      // Flat config modules must evaluate top-level exports (defineConfig / arrays).
      'unicorn/no-top-level-side-effects': 'off',
    },
  },
];

function typescriptEslintConfigKey(
  isTypechecked: boolean,
  isStrict: boolean,
): TypescriptEslintConfigKey {
  if (isTypechecked) {
    return isStrict ? 'strictTypeChecked' : 'recommendedTypeChecked';
  }
  return isStrict ? 'strict' : 'recommended';
}

export default function narwhal(options: NarwhalOptions = {}): Linter.Config[] {
  const isTypechecked = Boolean(options.typechecked);
  const isStrict = Boolean(options.strict);
  const isStylistic = Boolean(options.stylistic);
  const isPrettier = Boolean(options.prettier);
  const isTypescript =
    options.typescript ?? (isTypechecked || isStrict || isStylistic);

  const config: Linter.Config[] = [...base];

  if (isTypescript) {
    const key = typescriptEslintConfigKey(isTypechecked, isStrict);
    config.push(...tseslint.configs[key]);

    if (isStylistic) {
      const stylisticConfigs = isTypechecked
        ? tseslint.configs.stylisticTypeChecked
        : tseslint.configs.stylistic;
      config.push(...stylisticConfigs);
    }
  }

  if (isPrettier) {
    config.push(eslintConfigPrettier);
  }

  return config;
}
