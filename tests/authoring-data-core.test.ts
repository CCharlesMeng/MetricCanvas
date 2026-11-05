import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildSync } from 'esbuild';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { scanPageData, projectDataSources } from '../metriccanvas-authoring/core/page/data-scan';
import { scopePageData } from '../metriccanvas-authoring/core/page/data-scope';
import { scanPageData as legacyScan, hashBytes } from '../tools/scripts/local-authoring-data-analysis';
import { scopePageData as legacyScope } from '../tools/scripts/local-authoring-data-scope';

const schema = JSON.parse(readFileSync('metriccanvas-authoring/skill/metriccanvas-local-authoring/references/page-metadata/schema.json', 'utf8'));
interface ScanVector {
  page: string; document?: Record<string, any>; components: string[];
  scanSha256: string; scopeSha256: string | null; diagnostics: unknown[];
}
const parity: { cases: ScanVector[] } = JSON.parse(readFileSync('tools/fixtures/local-authoring-data/scan-parity.json', 'utf8'));
const isolated = mkdtempSync(path.join(tmpdir(), 'authoring-data-core-'));
beforeAll(() => cpSync('metriccanvas-authoring/skill/metriccanvas-local-authoring', path.join(isolated, 'skill'), { recursive: true }));
afterAll(() => rmSync(isolated, { recursive: true, force: true }));

describe('product authoring scan/scope preserve the frozen CLI behavior', () => {
  it.each(parity.cases)('complete ordered output and unchanged inputs: $page', vector => {
    const page = vector.document ?? JSON.parse(readFileSync(vector.page, 'utf8'));
    const before = JSON.stringify({ page, schema });
    const scan = scanPageData(page, schema);
    expect(hashBytes(JSON.stringify(scan))).toBe(vector.scanSha256);
    expect(scan.diagnostics).toEqual(vector.diagnostics);
    expect(legacyScan(page, schema)).toEqual(scan);
    const input = path.join(isolated, 'page.json');
    writeFileSync(input, JSON.stringify(page));
    const args = vector.components.flatMap(id => ['--component', id]);
    const cli = spawnSync(process.execPath, [path.join(isolated, 'skill/scripts/analyze-data.mjs'), 'scan', '--page', input, ...args],
      { cwd: isolated, encoding: 'utf8', timeout: 10_000, env: { PATH: process.env.PATH } });
    expect(cli.status, cli.stderr).toBe(0);
    const { pageSha256, ...cliScan } = JSON.parse(cli.stdout);
    expect(pageSha256).toBe(hashBytes(JSON.stringify(page)));
    if (vector.components.length) {
      const scoped = scopePageData(page, scan, vector.components);
      expect(hashBytes(JSON.stringify(scoped))).toBe(vector.scopeSha256);
      expect(legacyScope(page, scan, vector.components)).toEqual(scoped);
      expect(cliScan).toEqual(scoped);
    } else {
      expect(cliScan).toEqual(scan);
    }
    expect(JSON.stringify({ page, schema })).toBe(before);
  });

  it('the shared dependency graph needs no Node or filesystem adapter', () => {
    const result = buildSync({ entryPoints: ['metriccanvas-authoring/core/page/data-scan.ts', 'metriccanvas-authoring/core/page/data-scope.ts'],
      bundle: true, platform: 'neutral', format: 'esm', outdir: '/unused', write: false, metafile: true });
    expect(Object.keys(result.metafile.inputs).some(file => file.startsWith('tools/'))).toBe(false);
    expect(result.outputFiles).toHaveLength(2);
  });

  it('projection does not expose inline rows or query initial rows', () => {
    const sources = {
      a: { fields: {}, source: { type: 'inline', rows: [{ secret: 'inline' }] } },
      b: { fields: {}, source: { type: 'query', query: { initial: [{ secret: 'query' }] } } }
    };
    const before = JSON.stringify(sources);
    const result = projectDataSources(sources);
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(JSON.stringify(sources)).toBe(before);
  });
});

it('includes source-candidate outputs in complete scans and component reading closures',()=>{
 const page=JSON.parse(readFileSync('pages/capabilities/filters/filter-source-candidates.json','utf8'));
 const scan=scanPageData(page,schema);
 expect(scan.uses.filter(use=>use.path.includes('/candidates/')).map(use=>[use.source,use.field])).toEqual([
  ['organization-options','code'],['organization-options','name'],['organization-options','parent'],['channel-options','code'],['channel-options','name']
 ]);
 const scope=scopePageData(page,scan,['organization-picker']);
 expect(Object.keys(scope.sources)).toContain('organization-options');
 expect(Object.keys(scope.sources)).toContain('channel-options');
 expect(scope.diagnostics).toEqual([]);
});
