import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { parsePage } from '../../packages/page/src/validate';
import { upgradePageDocument } from '../../packages/page/src/upgrade-document';
import { pageCapabilities, versionPolicy } from '../../packages/page/src/version';
import { indexMetricDirectory, planMetricTips } from './local-authoring-metric-tips';

type Catalog = ReturnType<typeof indexMetricDirectory>;
type PageInput = { path: string; directory: string };
type Candidate = { path: string; document: Record<string, unknown> };
type PageReport = { report: Record<string, unknown>; output?: Candidate };
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const minimumMinor = pageCapabilities['metric-card-row-definition-tip'].minor;

function walkDirectory(root: string, directory = ''): PageInput[] {
  return readdirSync(join(root, directory), { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap(entry => {
      if (entry.isDirectory()) return walkDirectory(root, join(directory, entry.name));
      if (entry.isFile() && entry.name.endsWith('.json')) return [{ path: join(root, directory, entry.name), directory }];
      return [];
    });
}

function planPage(input: PageInput, catalog: Catalog | undefined, upgrade: boolean): PageReport {
  const bytes = readFileSync(input.path);
  const baseline = { file: input.path, sha256: hash(bytes) };
  let document: Record<string, unknown>;
  try {
    document = JSON.parse(bytes.toString('utf8'));
  } catch {
    return { report: { ...baseline, status: 'invalid-page', errors: ['页面文件不是有效 JSON'] } };
  }
  const parsed = parsePage(document);
  if (!parsed.ok) return { report: { ...baseline, status: 'invalid-page', errors: parsed.errors } };
  const page = { ...baseline, pageId: parsed.page.id, schemaVersion: parsed.page.schemaVersion };
  const plan = planMetricTips(document, catalog);
  if (!plan.changes) return { report: { ...page, status: 'unchanged', cards: plan.cards } };

  const [major, minor] = parsed.page.schemaVersion.split('.').map(Number);
  if (major === versionPolicy.major && minor >= minimumMinor) return validateCandidate(page, input, plan);
  if (!upgrade) return { report: { ...page, status: 'upgrade-required', cards: plan.cards } };
  return upgradeCandidate(page, input, document, catalog);
}

function upgradeCandidate(page: Record<string, unknown>, input: PageInput, document: Record<string, unknown>, catalog: Catalog | undefined): PageReport {
  const upgraded = upgradePageDocument(document);
  if (!upgraded.ok) return { report: { ...page, status: 'upgrade-failed', errors: upgraded.errors } };
  const plan = planMetricTips(upgraded.document as unknown as Record<string, unknown>, catalog);
  const migrated = { ...page, targetSchemaVersion: upgraded.toVersion, migration: upgraded.changes };
  if (!plan.changes) return { report: { ...migrated, status: 'unchanged', cards: plan.cards } };
  return validateCandidate(migrated, input, plan);
}

function validateCandidate(page: Record<string, unknown>, input: PageInput, plan: ReturnType<typeof planMetricTips>): PageReport {
  const checked = parsePage(plan.candidate);
  const detail = { ...page, cards: plan.cards };
  if (!checked.ok) return { report: { ...detail, status: 'invalid-candidate', errors: checked.errors } };
  return {
    report: { ...detail, status: 'ready', changes: plan.changes },
    output: { path: join(input.directory, checked.page.id + '.json'), document: plan.candidate }
  };
}

function writeCandidates(outputDir: string, results: PageReport[]) {
  const candidates = results.flatMap(({ output }) => output ? [output] : []);
  if (!candidates.length) return;
  if (new Set(candidates.map(candidate => candidate.path)).size !== candidates.length) {
    throw new Error('候选页面输出路径重复，请拆分输入批次');
  }
  mkdirSync(outputDir);
  for (const candidate of candidates) {
    const file = join(outputDir, candidate.path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(candidate.document, null, 2) + '\n', { flag: 'wx' });
  }
}

function run(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      help: { type: 'boolean' }, 'page': { type: 'string', multiple: true },
      'pages-dir': { type: 'string' }, catalog: { type: 'string' },
      'out-dir': { type: 'string' }, upgrade: { type: 'boolean' }
    }
  });
  if (values.help) return {
    usage: 'configure-metric-tips.mjs (--page file.json ... | --pages-dir directory) [--catalog metrics.json] [--out-dir new-directory] [--upgrade]',
    output: '默认输出 JSON 试跑清单。指定 --out-dir 时写出已通过校验的候选页。'
  };
  if (Boolean(values.page?.length) === Boolean(values['pages-dir'])) throw new TypeError('请在 --page 与 --pages-dir 中选择一种输入');
  if (values['out-dir'] && !values.catalog) throw new TypeError('写出候选需要 --catalog');
  const inputs = values['pages-dir'] ? walkDirectory(resolve(values['pages-dir']))
    : [...new Set(values.page!.map(file => resolve(file)))].map(path => ({ path, directory: '' }));
  const bytes = values.catalog ? readFileSync(values.catalog) : undefined;
  const catalog = bytes ? indexMetricDirectory(JSON.parse(bytes.toString('utf8'))) : undefined;
  const results = inputs.map(file => planPage(file, catalog, values.upgrade === true));
  const out = values['out-dir'] ? resolve(values['out-dir']) : undefined;
  if (out) writeCandidates(out, results);
  return {
    catalogSha256: bytes ? hash(bytes) : undefined,
    pages: results.map(({ report, output }) => ({
      ...report,
      ...(out && output ? { candidate: join(out, output.path) } : {})
    }))
  };
}

try {
  process.stdout.write(JSON.stringify(run(process.argv.slice(2)), null, 2) + '\n');
} catch (error) {
  process.stderr.write((error instanceof Error ? error.message : String(error)) + '\n');
  process.exitCode = 2;
}
