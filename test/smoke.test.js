import { ESLint } from 'eslint';
import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';
import assert from 'node:assert/strict';
import narwhal from '../index.js';

const fixture = 'export const x = Number.NaN;\n';

async function lintFix(configs) {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: configs,
    fix: true,
  });
  const [result] = await eslint.lintText(fixture, { filePath: 'fixture.js' });
  return result.output ?? fixture;
}

const withoutNarwhal = await lintFix([
  unicorn.configs.recommended,
  sonarjs.configs.recommended,
]);

assert.match(
  withoutNarwhal,
  /\bNaN\b/,
  'expected Unicorn to rewrite Number.NaN without narwhal',
);
assert.doesNotMatch(
  withoutNarwhal,
  /Number\.NaN/,
  'expected Number.NaN to be gone without narwhal',
);

const withNarwhal = await lintFix([
  unicorn.configs.recommended,
  sonarjs.configs.recommended,
  narwhal,
]);

assert.equal(
  withNarwhal,
  fixture,
  'with narwhal, Number.NaN must not be autofixed to NaN',
);

console.log('smoke ok: Number.NaN preserved when narwhal is applied');
