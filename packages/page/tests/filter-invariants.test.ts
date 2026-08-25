import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parsePage, validate } from '../src';
import queryDashboard from '../fixtures/contract-valid/query-dashboard.json';

describe('筛选器不变式', () => {
  it('拒绝级联循环与未知上游', () => {
    const cycle: any = structuredClone(queryDashboard);
    cycle.schemaVersion = '5.1';
    cycle.filters = [
      { id: 'a', type: 'dimension', dimension: 'region', dependsOn: 'b' },
      { id: 'b', type: 'dimension', dimension: 'city', dependsOn: 'a' }
    ];
    expect(validate(cycle).map((error) => error.path)).toEqual(
      expect.arrayContaining(['/filters/0/dependsOn', '/filters/1/dependsOn'])
    );

    const missing: any = structuredClone(queryDashboard);
    missing.schemaVersion = '5.1';
    missing.filters = [
      { id: 'child', type: 'dimension', dimension: 'city', dependsOn: 'nope' }
    ];
    expect(validate(missing)).toContainEqual(
      expect.objectContaining({ path: '/filters/0/dependsOn' })
    );
  });

  it('拒绝未知 defaultLevel', () => {
    const page: any = structuredClone(queryDashboard);
    page.schemaVersion = '5.1';
    page.filters = [
      {
        id: 'region',
        type: 'dimension',
        dimension: 'geo',
        hierarchy: [
          { id: 'geo', dimension: 'geo' },
          { id: 'office', dimension: 'office' }
        ],
        defaultLevel: 'missing'
      }
    ];
    expect(validate(page)).toContainEqual(
      expect.objectContaining({ path: '/filters/0/defaultLevel' })
    );
  });
});

describe('ioc-project-overview 页面文档', () => {
  it('通过页面校验', () => {
    const document = JSON.parse(
      readFileSync(
        fileURLToPath(new URL('../../../pages/ioc-project-overview.json', import.meta.url)),
        'utf8'
      )
    );
    const parsed = parsePage(document);
    expect(parsed.ok, JSON.stringify(parsed.errors)).toBe(true);
    expect(validate(document)).toEqual([]);
  });
});

describe('ioc-opportunity-list 页面文档', () => {
  it('通过页面校验', () => {
    const document = JSON.parse(
      readFileSync(
        fileURLToPath(new URL('../../../pages/ioc-opportunity-list.json', import.meta.url)),
        'utf8'
      )
    );
    const parsed = parsePage(document);
    expect(parsed.ok, JSON.stringify(parsed.errors)).toBe(true);
    expect(validate(document)).toEqual([]);
  });
});
