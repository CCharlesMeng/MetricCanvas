import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parsePage } from '../packages/page/src/validate';
import { upgradePageDocument } from '../packages/page/src/upgrade-document';
import { runPageParameterProgram } from '../packages/page/src/parameter-program';
import { versionPolicy } from '../packages/page/src/version';
import { runAuthoringPageOperation } from '../metriccanvas-authoring/core/page/product';
import { authoringPageProgramOutputs } from '../tools/scripts/build-authoring-page-program';
import { OPERATIONS, SELF_TESTS } from '../metriccanvas-authoring/core/page/product-contract';
import { scanPageData } from '../metriccanvas-authoring/core/page/data-scan';
import { createRequire } from 'node:module';
import { pageSchema } from '../packages/page/src/schema';

const { Ajv } = createRequire(path.resolve('packages/page/package.json'))('ajv');
const root = mkdtempSync(path.join(tmpdir(), 'authoring-page-product-'));
const program = path.join(root, 'scripts/authoring-page-program.mjs');
const vector = JSON.parse(readFileSync('metriccanvas-authoring/contract-snapshot/page/conformance/parameter-extraction.json', 'utf8'));
const evaluation = { instant: '2026-11-03T00:00:00Z', timeZone: 'Asia/Shanghai' };
const document = JSON.parse(readFileSync('packages/page/fixtures/contract-valid/query-dashboard.json', 'utf8'));

beforeAll(async () => {
  for (const [file, content] of await authoringPageProgramOutputs(process.cwd())) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), content);
  }
  writeFileSync(path.join(root, 'deny-network.mjs'), `import net from 'node:net'; import tls from 'node:tls'; import http from 'node:http'; import https from 'node:https';
const deny = () => { throw Error('Network forbidden'); }; globalThis.fetch = deny;
net.connect = deny; net.createConnection = deny; tls.connect = deny; http.request = deny; http.get = deny; https.request = deny; https.get = deny;\n`);
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

function invoke(operation: string, input: unknown) {
  const child = spawnSync(process.execPath, ['--import', path.join(root, 'deny-network.mjs'), program], {
    cwd: root, env: { PATH: process.env.PATH }, input: JSON.stringify({ operation, input }), encoding: 'utf8', timeout: 20_000
  });
  expect(child.stderr).toBe('');
  const receipt = JSON.parse(child.stdout);
  expect(child.status).toBe(receipt.status === 'error' ? 2 : 0);
  if (receipt.status !== 'error') {
    const schema = OPERATIONS[operation as keyof typeof OPERATIONS].outputSchema;
    const valid = new Ajv({ strict: false, allErrors: true }).compile(schema);
    expect(valid(receipt.data), JSON.stringify(valid.errors)).toBe(true);
  }
  return receipt;
}

describe('standalone deterministic authoring program', () => {
  it('validates complete ordered diagnostics and file/layout guards without mutating inputs', () => {
    const invalid = { ...document, id: 3, sections: 'invalid' };
    const before = JSON.stringify(invalid);
    expect(invoke('page.validate', { document: invalid })).toEqual(runAuthoringPageOperation('page.validate', { document: invalid }));
    expect(runAuthoringPageOperation('page.validate', { document: invalid }).diagnostics).toEqual(parsePage(invalid).errors);
    expect(JSON.stringify(invalid)).toBe(before);
    expect(invoke('page.validate', { document })).toMatchObject({ status: 'ok', data: { ok: true, schemaVersion: versionPolicy.current } });
    expect(invoke('page.validate', { document, fileName: 'wrong.json', expectedLayout: 'dashboard' }).diagnostics).toHaveLength(2);
  });

  it('uses the release schema, preserves partial diagnostics, and refuses ambiguous scope', () => {
    const input = { document };
    const before = JSON.stringify(input);
    expect(invoke('page.scan', input).data).toEqual(scanPageData(document, pageSchema));
    const unknown = structuredClone(document);
    unknown.sections[0].components[0].data.main = 'absent';
    expect(invoke('page.scan', { document: unknown })).toMatchObject({ status: 'partial' });
    expect(invoke('page.scan', { ...input, componentIds: ['absent'] })).toMatchObject({ status: 'error', diagnostics: [{ code: 'INVALID_READING_SCOPE' }] });
    expect(JSON.stringify(input)).toBe(before);
  });

  it('projects the existing inspection with no rows or query bodies', () => {
    const source = structuredClone(document);
    const first = Object.values(source.dataSources)[0] as any;
    first.source.initial = { capturedAt: '2026-01-01T00:00:00Z', rows: [{ secret: 'private-cell' }] };
    const output = invoke('page.project', { document: source });
    expect(JSON.stringify(output)).not.toContain('private-cell');
    expect(output.data).toHaveProperty('upgrade');
    expect(output.data).toHaveProperty('fieldUses');
  });

  it('uses the release compiled target and preserves complete upgrade failures', () => {
    const before = JSON.stringify(document);
    expect(invoke('page.upgrade', { document }).data).toEqual(upgradePageDocument(document));
    const unsupported = { ...document, schemaVersion: '99.0' };
    expect(invoke('page.upgrade', { document: unsupported }).data).toEqual(upgradePageDocument(unsupported));
    expect(invoke('page.upgrade', { document, target: '6.0' }).status).toBe('error');
    expect(JSON.stringify(document)).toBe(before);
  });

  it('prepares and resolves the frozen full parameter vector with original values intact', () => {
    const before = JSON.stringify(vector);
    const extract = { action: 'extract' as const, document: vector.input, context: vector.context };
    expect(invoke('page.parameters', extract).data).toEqual(runPageParameterProgram(extract));
    const prepared = invoke('page.parameters', { action: 'prepare', document: vector.input, context: vector.context, evaluation, selectedIds: vector.selectedIds });
    expect(prepared.data.document).toEqual(vector.template);
    expect(prepared.data.candidates).toEqual(vector.candidates);
    expect(prepared.data.originalValues).toEqual(vector.originalValues);
    const resolved = invoke('page.parameters', { action: 'resolve', document: prepared.data.document, evaluation, suppliedValues: vector.originalValues });
    expect(resolved.data.document).toEqual(vector.filled);
    expect(resolved.data.resolvedPage).toEqual(vector.execution);
    const rejected = invoke('page.parameters', { action: 'resolve', document: prepared.data.document, evaluation, suppliedValues: { unknown: 1 } });
    expect(rejected.status).toBe('error');
    expect(rejected.diagnostics).toEqual(rejected.data.issues);
    expect(JSON.stringify(vector)).toBe(before);
  });

  it.each(SELF_TESTS)('ships executable fixed self-test $operation', test => {
    expect(invoke(test.operation, test.input).status).toBe(test.expectedStatus);
  });

  it.each([
    ['page.validate', {}], ['page.parameters', { action: 'prepare', document }],
    ['page.scan', { document, schema: pageSchema }], ['missing', { document }]
  ])('rejects malformed explicit input for %s', (operation, input) => {
    const rejected = invoke(operation as string, input);
    expect(rejected.status).toBe('error');
    expect(rejected.diagnostics).toEqual(expect.arrayContaining([{ code: 'INVALID_REQUEST', path: expect.any(String), message: expect.any(String) }]));
  });

  it('exports deterministic code and contracts with no dependency install on the consumer', async () => {
    const twice = await authoringPageProgramOutputs(process.cwd());
    for (const [file, content] of twice) expect(readFileSync(path.join(root, file), 'utf8')).toBe(content);
    const published = JSON.parse(readFileSync(path.join(root, 'operations.json'), 'utf8'));
    for (const [id, contract] of Object.entries(OPERATIONS)) expect(published[id]).toEqual(contract);
  });
});
