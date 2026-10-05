import { ESLint, type Linter } from 'eslint';
import unicorn from 'eslint-plugin-unicorn';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);

export interface ConflictInfo {
  why: string;
  fixture: string;
}

export type ConflictMap = Map<string, ConflictInfo>;

interface SeedFixture {
  alignedRule: string;
  options: Record<string, unknown>;
  code: string;
  why: string;
}

interface Snippet {
  code: string;
  options: Record<string, unknown> | undefined;
}

/*
Seed fixture: Sonar (S7773) prefers Number.NaN; Unicorn rewrites it.
*/
const SEED_FIXTURES: SeedFixture[] = [
  {
    alignedRule: 'prefer-number-properties',
    options: { checkNaN: true, checkInfinity: true },
    code: 'export const x = Number.NaN;\n',
    why: 'Sonar-aligned prefer-number-properties wants Number.NaN; Unicorn autofix rewrites to NaN',
  },
  {
    alignedRule: 'prefer-number-properties',
    options: { checkNaN: true, checkInfinity: true },
    code: 'export const x = Number.POSITIVE_INFINITY;\n',
    why: 'Sonar-aligned prefer-number-properties wants Number.POSITIVE_INFINITY; Unicorn autofix rewrites to Infinity',
  },
];

function packageRoot(packageName: string): string {
  const entry = require.resolve(packageName);
  let directory = path.dirname(entry);
  for (let index = 0; index < 6; index++) {
    try {
      const meta = JSON.parse(
        readFileSync(path.join(directory, 'package.json'), 'utf8'),
      ) as {
        name?: string;
      };
      if (meta.name === packageName) return directory;
    } catch {
      // keep walking
    }
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  throw new Error(`Could not resolve package root for ${packageName}`);
}

/*
Bare unicorn rule names Sonar documents as external/aligned.
*/
export function parseSonarAlignedUnicornRules(): Set<string> {
  const readmePath = path.join(
    packageRoot('eslint-plugin-sonarjs'),
    'README.md',
  );
  const readme = readFileSync(readmePath, 'utf8');
  const section =
    readme
      .split('start external rules', 2)[1]
      ?.split('end external rules', 1)[0] ?? '';
  const names = new Set<string>();
  for (const match of section.matchAll(/\[unicorn\/([a-z0-9-]+)\]/g)) {
    names.add(match[1]);
  }
  return names;
}

function toRawUrl(githubBlobUrl: string): string {
  return githubBlobUrl
    .replace('https://github.com/', 'https://raw.githubusercontent.com/')
    .replace('/blob/', '/');
}

function parseOptionsFromBlock(
  fullBlock: string,
  body: string,
  optionRe: RegExp,
): Record<string, unknown> | undefined {
  const optionMatch =
    new RegExp(optionRe).exec(fullBlock) ?? new RegExp(optionRe).exec(body);
  if (!optionMatch?.[1]) return undefined;
  try {
    const parsed: unknown = JSON.parse(optionMatch[1]);
    if (
      Array.isArray(parsed) &&
      parsed[1] &&
      typeof parsed[1] === 'object' &&
      !Array.isArray(parsed[1])
    ) {
      return parsed[1] as Record<string, unknown>;
    }
  } catch {
    // ignore unparseable option comments
  }
  return undefined;
}

interface SnippetParserState {
  snippets: Snippet[];
  buffer: string[];
  isInCorrect: boolean;
  options: Record<string, unknown> | undefined;
}

function commitBuffer(state: SnippetParserState): void {
  const code = state.buffer.join('\n').trim();
  if (code.length > 0 && !code.startsWith('/* eslint')) {
    state.snippets.push({ code: `${code}\n`, options: state.options });
  }
  state.buffer = [];
  state.isInCorrect = false;
}

function startCorrectExample(state: SnippetParserState): void {
  if (state.isInCorrect && state.buffer.length > 0) commitBuffer(state);
  state.isInCorrect = true;
}

function consumeCodeLine(state: SnippetParserState, line: string): void {
  if (!state.isInCorrect) return;
  if (line.trim() === '') {
    if (state.buffer.length > 0) commitBuffer(state);
    return;
  }
  state.buffer.push(line);
}

function extractSnippetsFromBlock(
  body: string,
  currentOptions: Record<string, unknown> | undefined,
): Snippet[] {
  const state: SnippetParserState = {
    snippets: [],
    buffer: [],
    isInCorrect: false,
    options: currentOptions,
  };

  for (const line of body.split('\n')) {
    if (/^\s*\/\/\s*✅/.test(line)) {
      startCorrectExample(state);
      continue;
    }
    if (/^\s*\/\/\s*❌/.test(line)) {
      if (state.isInCorrect) commitBuffer(state);
      continue;
    }
    consumeCodeLine(state, line);
  }

  if (state.isInCorrect && state.buffer.length > 0) commitBuffer(state);
  return state.snippets;
}

/*
Extract ✅ snippets from Unicorn rule docs, with nearest rule-option comment.
*/
export function extractCorrectSnippets(
  markdown: string,
  ruleName: string,
): Snippet[] {
  const snippets: Snippet[] = [];
  let currentOptions: Record<string, unknown> | undefined;

  const optionRe = new RegExp(
    String.raw`eslint\s+unicorn/${ruleName}\s*:\s*(\[.*?\])`,
    's',
  );

  const blocks = markdown.matchAll(
    /```(?:js|javascript|ts|typescript)?\n([\s\S]*?)```/g,
  );
  for (const [fullBlock, body] of blocks) {
    const parsedOptions = parseOptionsFromBlock(fullBlock, body, optionRe);
    if (parsedOptions) currentOptions = parsedOptions;
    snippets.push(...extractSnippetsFromBlock(body, currentOptions));
  }

  return snippets;
}

async function lintText(
  code: string,
  configs: Linter.Config[],
  { fix = false }: { fix?: boolean } = {},
) {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: configs,
    fix,
  });
  const [result] = await eslint.lintText(
    code.endsWith('\n') ? code : `${code}\n`,
    {
      filePath: 'fixture.js',
    },
  );
  return result;
}

function unicornRuleConfig(
  ruleName: string,
  options: Record<string, unknown> | undefined,
): Linter.Config {
  const value: Linter.RuleEntry = options ? ['error', options] : 'error';
  return {
    plugins: { unicorn },
    rules: { [`unicorn/${ruleName}`]: value },
  };
}

async function collectFights(
  alignedRule: string,
  code: string,
  options: Record<string, unknown> | undefined,
  sonarAligned: Set<string>,
  why: string,
): Promise<[string, ConflictInfo][]> {
  const baseline = await lintText(code, [
    unicornRuleConfig(alignedRule, options),
  ]);
  const baselineCount = baseline.messages.filter(
    (message) => message.ruleId === `unicorn/${alignedRule}`,
  ).length;

  const recommended = await lintText(code, [unicorn.configs.recommended]);
  const suspects = [
    ...new Set(
      recommended.messages
        .map((message) => message.ruleId)
        .filter(
          (id): id is string =>
            typeof id === 'string' &&
            id.startsWith('unicorn/') &&
            !sonarAligned.has(id.slice('unicorn/'.length)),
        ),
    ),
  ];

  const findings = await Promise.all(
    suspects.map(async (ruleId) => {
      const onlyRule = await lintText(
        code,
        [
          {
            plugins: { unicorn },
            rules: {
              [ruleId]: unicorn.configs.recommended.rules?.[ruleId] ?? 'error',
            },
          },
        ],
        { fix: true },
      );
      const fixed = onlyRule.output;
      if (!fixed || fixed === code) return;

      const after = await lintText(fixed, [
        unicornRuleConfig(alignedRule, options),
      ]);
      const afterCount = after.messages.filter(
        (message) => message.ruleId === `unicorn/${alignedRule}`,
      ).length;

      if (afterCount <= baselineCount) return;
      return ruleId;
    }),
  );

  return findings
    .filter((ruleId): ruleId is string => typeof ruleId === 'string')
    .map((ruleId) => [ruleId, { why, fixture: code }]);
}

function mergeConflicts(
  conflicts: ConflictMap,
  batches: [string, ConflictInfo][][],
): void {
  for (const batch of batches) {
    for (const [ruleId, info] of batch) {
      if (!conflicts.has(ruleId)) {
        conflicts.set(ruleId, info);
      }
    }
  }
}

export async function detectConflicts(): Promise<ConflictMap> {
  const sonarAligned = parseSonarAlignedUnicornRules();
  const conflicts: ConflictMap = new Map();

  const unicornRules = unicorn.rules ?? {};

  const seedFindings = await Promise.all(
    SEED_FIXTURES.filter((seed) =>
      Object.hasOwn(unicornRules, seed.alignedRule),
    ).map((seed) =>
      collectFights(
        seed.alignedRule,
        seed.code,
        seed.options,
        sonarAligned,
        seed.why,
      ),
    ),
  );
  mergeConflicts(conflicts, seedFindings);

  const alignedPresent = [...sonarAligned].filter((name) =>
    Object.hasOwn(unicornRules, name),
  );
  const documentation = await Promise.all(
    alignedPresent.map(async (ruleName) => {
      const url = unicornRules[ruleName].meta?.docs?.url;
      if (!url) return { ruleName, markdown: undefined as string | undefined };
      try {
        const response = await fetch(toRawUrl(url));
        return {
          ruleName,
          markdown: response.ok ? await response.text() : undefined,
        };
      } catch {
        return { ruleName, markdown: undefined };
      }
    }),
  );

  const documentFindings = await Promise.all(
    documentation.flatMap(({ ruleName, markdown }) =>
      markdown
        ? extractCorrectSnippets(markdown, ruleName).map(({ code, options }) =>
            collectFights(
              ruleName,
              code,
              options,
              sonarAligned,
              `Sonar-aligned unicorn/${ruleName} preferred form is rewritten by Unicorn recommended`,
            ),
          )
        : [],
    ),
  );
  mergeConflicts(conflicts, documentFindings);

  return new Map(
    Iterator.from(conflicts)
      .toArray()
      .toSorted(([left], [right]) => left.localeCompare(right)),
  );
}

const isMain =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const conflicts = await detectConflicts();
  console.log(JSON.stringify(Object.fromEntries(conflicts), undefined, 2));
}
