import { ESLint, type Linter } from 'eslint';
import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import narwhal from '../index.ts';
import type { ConflictInfo } from '../scripts/detect-conflicts.ts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const conflicts = JSON.parse(
  readFileSync(path.join(root, 'conflicts.json'), 'utf8'),
) as Record<string, ConflictInfo>;

async function lintFix(
  configs: Linter.Config[],
  code: string,
): Promise<string> {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: configs,
    fix: true,
  });
  const [result] = await eslint.lintText(code, { filePath: 'fixture.js' });
  return result.output ?? code;
}

function offsConfig(configs: Linter.Config[]): Linter.Config {
  const config = configs.find(
    (entry) => 'name' in entry && entry.name === 'narwhal/sonar-over-unicorn',
  );
  assert.ok(config, 'narwhal must include narwhal/sonar-over-unicorn offs');
  return config;
}

function hasNamedConfig(configs: Linter.Config[], name: string): boolean {
  return configs.some((entry) => 'name' in entry && entry.name === name);
}

describe('narwhal()', () => {
  const entries = Object.entries(conflicts);
  const base = narwhal();

  it('returns eslint + unicorn + sonarjs + offs', () => {
    assert.ok(Array.isArray(base), 'narwhal() must return a flat-config array');
    assert.ok(entries.length > 0, 'conflicts.json must list at least one off');
    assert.ok(offsConfig(base).rules, 'offs config must expose rules');
    assert.ok(
      hasNamedConfig(base, '@eslint/js/recommended'),
      'narwhal() should include @eslint/js recommended by default',
    );
    assert.ok(
      hasNamedConfig(base, 'narwhal/eslint-config-entrypoint'),
      'narwhal must include eslint.config.* entrypoint override',
    );
    assert.ok(
      !hasNamedConfig(narwhal({ eslint: false }), '@eslint/js/recommended'),
      'eslint: false should omit @eslint/js recommended',
    );
  });

  it('layers typescript-eslint and prettier from options', () => {
    const withTs = narwhal({ typescript: true });
    assert.ok(
      withTs.length > base.length,
      'typescript: true should add configs',
    );

    const withStrict = narwhal({ typescript: true, strict: true });
    assert.ok(
      withStrict.length > base.length,
      'strict should add typescript-eslint configs',
    );

    const withTypechecked = narwhal({ typechecked: true });
    assert.ok(
      withTypechecked.length > base.length,
      'typechecked implies typescript',
    );
    assert.ok(
      hasNamedConfig(
        withTypechecked,
        'narwhal/disable-type-checked-eslint-config',
      ),
      'typechecked should disable typed rules for eslint.config.*',
    );
    assert.ok(
      !hasNamedConfig(withTs, 'narwhal/disable-type-checked-eslint-config'),
      'non-typechecked typescript should not add disableTypeChecked',
    );

    const withStylistic = narwhal({ stylistic: true });
    assert.ok(
      withStylistic.length > withTs.length,
      'stylistic should add more configs than typescript alone',
    );

    const withPrettier = narwhal({ prettier: true });
    assert.equal(
      withPrettier.length,
      base.length + 1,
      'prettier appends one config',
    );

    const full = narwhal({
      typescript: true,
      typechecked: true,
      strict: true,
      stylistic: true,
      prettier: true,
    });
    assert.ok(full.length > withTypechecked.length);
    assert.ok(offsConfig(full).rules);
  });

  for (const [ruleId, { fixture, why }] of entries) {
    it(`preserves fixture when ${ruleId} is off`, async () => {
      assert.equal(
        offsConfig(base).rules?.[ruleId],
        'off',
        `generated offs must disable ${ruleId}`,
      );

      const withoutOffs = await lintFix(
        [unicorn.configs.recommended, sonarjs.configs.recommended],
        fixture,
      );
      assert.notEqual(
        withoutOffs,
        fixture,
        `expected ${ruleId} to rewrite fixture without offs (${why})`,
      );

      const withNarwhal = await lintFix(base, fixture);
      assert.equal(
        withNarwhal,
        fixture,
        `with narwhal(), fixture for ${ruleId} must be preserved`,
      );
    });
  }
});
