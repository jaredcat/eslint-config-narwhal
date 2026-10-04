import { ESLint, type Linter } from 'eslint';
import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import narwhal from '../index.js';
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
  return result?.output ?? code;
}

function offsConfig(): Linter.Config {
  const config = narwhal.find(
    (entry) =>
      typeof entry === 'object' &&
      entry !== null &&
      'name' in entry &&
      entry.name === 'narwhal/sonar-over-unicorn',
  );
  assert.ok(config, 'narwhal must include narwhal/sonar-over-unicorn offs');
  return config as Linter.Config;
}

describe('narwhal preset', () => {
  const entries = Object.entries(conflicts);

  it('exports unicorn + sonarjs + offs', () => {
    assert.ok(
      Array.isArray(narwhal),
      'default export must be a flat-config array',
    );
    assert.ok(entries.length > 0, 'conflicts.json must list at least one off');
    assert.ok(offsConfig().rules, 'offs config must expose rules');
    assert.ok(
      narwhal.some(
        (entry) =>
          typeof entry === 'object' &&
          entry !== null &&
          'name' in entry &&
          entry.name === 'narwhal/eslint-config-entrypoint',
      ),
      'narwhal must include eslint.config.* entrypoint override',
    );
  });

  for (const [ruleId, { fixture, why }] of entries) {
    it(`preserves fixture when ${ruleId} is off`, async () => {
      assert.equal(
        offsConfig().rules?.[ruleId],
        'off',
        `index.js must disable ${ruleId}`,
      );

      const withoutOffs = await lintFix(
        [
          unicorn.configs.recommended as Linter.Config,
          sonarjs.configs.recommended as Linter.Config,
        ],
        fixture,
      );
      assert.notEqual(
        withoutOffs,
        fixture,
        `expected ${ruleId} to rewrite fixture without offs (${why})`,
      );

      const withNarwhal = await lintFix(narwhal as Linter.Config[], fixture);
      assert.equal(
        withNarwhal,
        fixture,
        `with narwhal, fixture for ${ruleId} must be preserved`,
      );
    });
  }
});
