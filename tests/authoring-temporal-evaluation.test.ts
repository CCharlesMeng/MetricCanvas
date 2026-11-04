import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authoringPageProgramOutputs } from '../tools/scripts/build-authoring-page-program';
import { evaluationTimeValue, temporalEvaluationIssue } from '../packages/page/src/temporal-evaluation';
import { validateTimePointValue } from '../packages/page/src/filter';
import { currentTimeValue, timeFilterBoundaryError } from '../packages/page/src/time-filter-boundary';
import { parsePage } from '../packages/page/src/validate';
import { runAuthoringPageOperation } from '../metriccanvas-authoring/core/page/product';

const root = mkdtempSync(path.join(tmpdir(), 'authoring-temporal-'));
const source = JSON.parse(readFileSync('packages/page/fixtures/contract-valid/time-point-no-future.json', 'utf8'));
const parameter = JSON.parse(readFileSync('metriccanvas-authoring/contract-snapshot/page/conformance/parameter-extraction.json', 'utf8'));
const zones = ['UTC', 'Pacific/Honolulu', 'Asia/Tokyo'];
const shanghai = { instant: '2026-12-31T16:30:00Z', timeZone: 'Asia/Shanghai' };
const losAngeles = { ...shanghai, timeZone: 'America/Los_Angeles' };
beforeAll(async () => {
  for (const [file, content] of await authoringPageProgramOutputs(process.cwd())) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), content);
  }
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

function invoke(operation: string, input: unknown, TZ: string) {
  const child = spawnSync(process.execPath, [path.join(root, 'scripts/authoring-page-program.mjs')], {
    cwd: root, env: { TZ, PATH: process.env.PATH }, input: JSON.stringify({ operation, input }), encoding: 'utf8', timeout: 20_000
  });
  expect(child.stderr).toBe('');
  const receipt = JSON.parse(child.stdout);
  expect(child.status).toBe(receipt.status === 'error' ? 2 : 0);
  return receipt;
}

function acrossZones(operation: string, input: unknown) {
  const before = JSON.stringify(input);
  const results = zones.map(zone => invoke(operation, input, zone));
  for (const receipt of results.slice(1)) expect(receipt).toEqual(results[0]);
  expect(JSON.stringify(input)).toBe(before);
  return results[0];
}

function boundaryDocument() {
  const document = structuredClone(source);
  document.filters[0].default = '2027-01';
  document.filters[1].default = '2027-01-01';
  return document;
}

describe('explicit instant and business time zone', () => {
  it('offers the same semantic checker to program-only non-page routes', () => {
    expect(acrossZones('internal.evaluation.validate', { evaluation: shanghai })).toEqual({ status: 'ok', data: { ok: true }, diagnostics: [] });
    expect(acrossZones('internal.evaluation.validate', {})).toMatchObject({ status: 'error', data: { ok: false }, diagnostics: [{ code: 'EVALUATION_CONTEXT_REQUIRED' }] });
    expect(acrossZones('internal.evaluation.validate', { evaluation: { ...shanghai, timeZone: 'Not/AZone' } })).toMatchObject({ status: 'error', data: { ok: false }, diagnostics: [{ code: 'INVALID_EVALUATION_CONTEXT' }] });
  }, 20_000);
  it.each([
    ['2026-12-31T16:30:00Z', 'Asia/Shanghai', '2027-01-01T00:30'],
    ['2026-12-31T16:30:00Z', 'America/Los_Angeles', '2026-12-31T08:30'],
    ['2028-02-29T23:30:00Z', 'Asia/Shanghai', '2028-03-01T07:30'],
    ['2026-03-08T10:30:00Z', 'America/Los_Angeles', '2026-03-08T03:30'],
    ['2026-01-01T00:30:00+08:00', 'America/Los_Angeles', '2025-12-31T08:30']
  ])('uses Gregorian calendar at %s in %s', (instant, timeZone, expected) => {
    const evaluation = { instant, timeZone };
    expect(temporalEvaluationIssue(evaluation)).toBeUndefined();
    expect(evaluationTimeValue('datetime', evaluation)).toBe(expected);
    expect(currentTimeValue('date', new Date('1900-01-01Z'), evaluation)).toBe(expected.slice(0, 10));
    expect(currentTimeValue('month', undefined, evaluation)).toBe(expected.slice(0, 7));
  });

  it.each([
    null, {}, { instant: '2026-02-30T00:00:00Z', timeZone: 'UTC' },
    { instant: '2026-01-01T00:00:00', timeZone: 'UTC' },
    { instant: '2026-01-01T00:00:00Z', timeZone: 'Not/AZone' },
    { instant: '2026-01-01T00:00:00Z', timeZone: '+08:00' },
    { instant: '2026-01-01T00:00:00Z', timeZone: 'UTC', extra: 1 }
  ])('refuses invalid contexts without consulting machine defaults: %j', evaluation => {
    expect(temporalEvaluationIssue(evaluation)).toEqual(expect.any(String));
    expect(runAuthoringPageOperation('page.validate', { document: source, evaluation })).toMatchObject({ status: 'error', diagnostics: [{ code: 'INVALID_EVALUATION_CONTEXT' }] });
  });

  it('requires a context only for time-sensitive public operations', () => {
    for (const operation of ['page.validate', 'page.project', 'page.upgrade']) {
      expect(acrossZones(operation, { document: source })).toMatchObject({ status: 'error', diagnostics: [{ code: 'EVALUATION_CONTEXT_REQUIRED' }] });
    }
    expect(acrossZones('page.scan', { document: source }).status).toBe('ok');
    expect(acrossZones('page.parameters', { action: 'resolve', document: parameter.template, suppliedValues: parameter.originalValues })).toMatchObject({ status: 'error', diagnostics: [{ code: 'EVALUATION_CONTEXT_REQUIRED' }] });
  }, 20_000);

  it.each(['page.validate', 'page.upgrade', 'page.project'])('retains full ordered %s results across process zones', operation => {
    const document = boundaryDocument();
    const accepted = acrossZones(operation, { document, evaluation: shanghai });
    expect(accepted.status).toBe('ok');
    const rejected = acrossZones(operation, { document, evaluation: losAngeles });
    expect(rejected.diagnostics).toHaveLength(2);
    expect(rejected.diagnostics.map((item: any) => item.path)).toEqual(['/filters/0/default', '/filters/1/default']);
  }, 20_000);

  it.each(['extract', 'prepare'])('retains full %s results across process zones', action => {
    const document = boundaryDocument();
    const input = { action, document, context: { baseline: 'frozen-r1' }, selectedIds: [], evaluation: shanghai };
    expect(acrossZones('page.parameters', input).status).toBe('ok');
    expect(acrossZones('page.parameters', { ...input, evaluation: losAngeles }).status).toBe('error');
  }, 20_000);

  it('applies time-range parameters at the business month boundary and preserves originals', () => {
    const suppliedValues = { ...parameter.originalValues, 'report-period': { start: '2027-01', end: '2027-01' } };
    const input = { action: 'resolve', document: parameter.template, suppliedValues, evaluation: shanghai };
    const accepted = acrossZones('page.parameters', input);
    expect(accepted.status).toBe('ok');
    expect(accepted.data.resolvedPage.filters[0].default).toEqual({ from: '2027-01', to: '2027-01' });
    const rejected = acrossZones('page.parameters', { ...input, evaluation: losAngeles });
    expect(rejected.status).toBe('error');
    expect(rejected.diagnostics).toEqual(rejected.data.issues);
    const futureAllowed = structuredClone(parameter.template);
    futureAllowed.filters[0].disableFuture = false;
    expect(acrossZones('page.parameters', { ...input, document: futureAllowed, evaluation: losAngeles }).status).toBe('ok');
  }, 20_000);

  it('keeps period, month and date boundaries on the same explicit calendar', () => {
    expect(validateTimePointValue('2027-01', 'month', undefined, true, undefined, shanghai)).toBeUndefined();
    expect(validateTimePointValue('2027-01', 'month', undefined, true, undefined, losAngeles)).toBe('时间点不得晚于当前月份');
    expect(validateTimePointValue('2099-01', 'month', undefined, false, undefined, losAngeles)).toBeUndefined();
    const declaration = { id: 'period', type: 'timeRange' as const, display: 'period' as const, required: true, initialMode: 'quarter' as const };
    const value = { type: 'timeRange' as const, from: '2027-01-01', to: '2027-03-31', selection: { mode: 'quarter' as const, value: '2027-Q1' } };
    expect(timeFilterBoundaryError(declaration, value, undefined, shanghai)).toBeUndefined();
    expect(timeFilterBoundaryError(declaration, value, undefined, losAngeles)).toBe('期间不得晚于 2026-Q4');
    // Existing runtime callers can keep their explicit Date and omit the new context.
    expect(currentTimeValue('month', new Date(2020, 1, 20))).toBe('2020-02');
    expect(parsePage(source).ok).toBe(true);
  });
});
