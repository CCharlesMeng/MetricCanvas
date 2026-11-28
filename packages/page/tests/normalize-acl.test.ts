import { describe, expect, it } from 'vitest';
import {
  canonicalIocHeaderControls,
  resolveDashboardHeaderConfig,
  resolvePageCompatibility,
  sourceIocRegionDocument,
  usesLegacyReportHeaderPeriod,
} from '../src/normalize';
import type { Page } from '../src/page-types';
import { parsePage } from '../src/validate';
import { versionPolicy } from '../src/version';

function minimalPage(overrides: Partial<Page> = {}): Page {
  return {
    schemaVersion: versionPolicy.current,
    id: 'acl-test-page',
    layout: 'report',
    dataSources: {
      ds: {
        fields: { k: { type: 'string', role: 'dimension' } },
        source: { type: 'inline', rows: [{ k: 'a' }] },
      },
    },
    sections: [
      {
        id: 'main',
        components: [{ id: 'txt', type: 'text', layout: { span: 12 }, props: { body: 'ok' } }],
      },
    ],
    ...overrides,
  };
}

describe('normalize ACL: resolvePageCompatibility', () => {
  it.each([
    [
      '5.4',
      {
        legacyReportHeaderPeriod: false,
        legacyCandidateSearch: true,
        unrestrictedFilterClear: false,
        independentExclusionCandidates: false,
        nativePreparation: false,
        legacyDefaultHeader: true,
      },
    ],
    [
      '6.5',
      {
        legacyReportHeaderPeriod: false,
        legacyCandidateSearch: true,
        unrestrictedFilterClear: false,
        independentExclusionCandidates: false,
        nativePreparation: false,
        legacyDefaultHeader: true,
      },
    ],
    [
      '6.13',
      {
        legacyReportHeaderPeriod: true,
        legacyCandidateSearch: true,
        unrestrictedFilterClear: false,
        independentExclusionCandidates: false,
        nativePreparation: false,
        legacyDefaultHeader: true,
      },
    ],
    [
      '6.14',
      {
        legacyReportHeaderPeriod: true,
        legacyCandidateSearch: true,
        unrestrictedFilterClear: false,
        independentExclusionCandidates: false,
        nativePreparation: false,
        legacyDefaultHeader: true,
      },
    ],
    [
      '6.15',
      {
        legacyReportHeaderPeriod: false,
        legacyCandidateSearch: true,
        unrestrictedFilterClear: false,
        independentExclusionCandidates: false,
        nativePreparation: false,
        legacyDefaultHeader: true,
      },
    ],
    [
      '6.111',
      {
        legacyReportHeaderPeriod: false,
        legacyCandidateSearch: true,
        unrestrictedFilterClear: false,
        independentExclusionCandidates: false,
        nativePreparation: false,
        legacyDefaultHeader: false,
      },
    ],
    [
      '6.112',
      {
        legacyReportHeaderPeriod: false,
        legacyCandidateSearch: false,
        unrestrictedFilterClear: false,
        independentExclusionCandidates: false,
        nativePreparation: false,
        legacyDefaultHeader: false,
      },
    ],
    [
      '6.123',
      {
        legacyReportHeaderPeriod: false,
        legacyCandidateSearch: false,
        unrestrictedFilterClear: false,
        independentExclusionCandidates: false,
        nativePreparation: true,
        legacyDefaultHeader: false,
      },
    ],
    [
      '6.124',
      {
        legacyReportHeaderPeriod: false,
        legacyCandidateSearch: false,
        unrestrictedFilterClear: true,
        independentExclusionCandidates: false,
        nativePreparation: true,
        legacyDefaultHeader: false,
      },
    ],
    [
      versionPolicy.current,
      {
        legacyReportHeaderPeriod: false,
        legacyCandidateSearch: false,
        unrestrictedFilterClear: true,
        independentExclusionCandidates: true,
        nativePreparation: true,
        legacyDefaultHeader: false,
      },
    ],
  ])('computes compatibility profile for schemaVersion %s', (schemaVersion, expected) => {
    const page = minimalPage({ schemaVersion, layout: undefined });
    const compat = resolvePageCompatibility(page);
    expect(compat).toMatchObject({
      layout: 'report',
      ...expected,
    });
    expect(usesLegacyReportHeaderPeriod(schemaVersion)).toBe(expected.legacyReportHeaderPeriod);
  });
});

describe('normalize ACL: resolveDashboardHeaderConfig', () => {
  it('resolves iocHeader component with hidden legacy toolbar mode', () => {
    const page = minimalPage({
      layout: 'dashboard',
      sections: [
        {
          id: 'header',
          components: [
            {
              id: 'hdr',
              type: 'iocHeader',
              layout: { span: 12 },
              props: { identity: { title: '作战视图' }, readOnly: true, note: '只读提示' },
            },
          ],
        },
      ],
    });
    const config = resolveDashboardHeaderConfig(page);
    expect(config.iocHeader).toBeDefined();
    expect(config.legacyDashboardHeader).toBe(false);
    expect(config.compact).toBe(false);
    expect(config.readOnly).toBe(true);
    expect(config.note).toBe('只读提示');
    expect(config.toolbarMode).toBe('hidden');
  });

  it('resolves legacy dashboardToolbar hidden / visible / compact variants', () => {
    const hidden = resolveDashboardHeaderConfig(
      minimalPage({ layout: 'dashboard', dashboardToolbar: 'hidden' }),
    );
    expect(hidden).toEqual({
      legacyDashboardHeader: false,
      compact: false,
      readOnly: false,
      toolbarMode: 'hidden',
    });

    const visible = resolveDashboardHeaderConfig(
      minimalPage({ layout: 'dashboard', dashboardToolbar: 'visible' }),
    );
    expect(visible).toEqual({
      legacyDashboardHeader: true,
      compact: false,
      readOnly: false,
      toolbarMode: 'visible',
    });

    const compact = resolveDashboardHeaderConfig(
      minimalPage({
        layout: 'dashboard',
        dashboardToolbar: { variant: 'compact', readOnly: true, note: '紧凑模式' },
      }),
    );
    expect(compact).toEqual({
      legacyDashboardHeader: true,
      compact: true,
      readOnly: true,
      note: '紧凑模式',
      toolbarMode: 'compact',
    });
  });

  it('applies legacy default dashboard header only before 6.81 and preserves report layout behavior', () => {
    const pre81 = resolveDashboardHeaderConfig(
      minimalPage({ schemaVersion: '6.80', layout: 'dashboard' }),
    );
    expect(pre81.legacyDashboardHeader).toBe(true);
    expect(pre81.toolbarMode).toBe('visible');

    const post81 = resolveDashboardHeaderConfig(
      minimalPage({ schemaVersion: '6.81', layout: 'dashboard' }),
    );
    expect(post81.legacyDashboardHeader).toBe(false);
    expect(post81.toolbarMode).toBe('hidden');

    const reportCompact = resolveDashboardHeaderConfig(
      minimalPage({
        layout: 'report',
        dashboardToolbar: { variant: 'compact', readOnly: true, note: '报表只读' },
      }),
    );
    expect(reportCompact).toEqual({
      legacyDashboardHeader: false,
      compact: false,
      readOnly: true,
      note: '报表只读',
      toolbarMode: 'compact',
    });
  });
});

describe('normalize ACL: stateless office-navigation projection marker', () => {
  it('marks shallow clone without mutating input or leaking enumerable keys, and round-trips cleanly', () => {
    const officeNavPage = minimalPage({
      layout: 'dashboard',
      filters: [
        {
          id: 'region',
          type: 'dimension',
          dimension: 'region',
          hierarchy: [
            { id: 'region', dimension: 'region', label: '地区部' },
            { id: 'office', dimension: 'office', label: '代表处' },
          ],
        },
        { id: 'month', type: 'timePoint', granularity: 'month' },
      ],
      sections: [
        {
          id: 'header',
          components: [
            {
              id: 'hdr',
              type: 'iocHeader',
              layout: { span: 12 },
              props: {
                identity: { title: '办事处导航' },
                components: [
                  {
                    id: 'region-ctrl',
                    type: 'regionFilter',
                    props: { officeNavigate: { href: '/pages/office-view' } },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    const frozenInput = Object.freeze({ ...officeNavPage });
    const projected = canonicalIocHeaderControls(frozenInput);

    expect(projected).not.toBe(frozenInput);
    expect(Object.keys(projected)).toEqual(Object.keys(frozenInput));
    expect(JSON.stringify(projected)).toBe(JSON.stringify(frozenInput));
    expect(projected).toEqual(frozenInput);

    // Caller input was never marked; sourceIocRegionDocument leaves unmarked input untouched.
    expect(sourceIocRegionDocument(frozenInput)).toBe(frozenInput);

    // Marked projection strips expanded `region` filter cleanly when converted back to source.
    const source = sourceIocRegionDocument(projected) as Page;
    expect(source.filters?.map((f) => f.id)).toEqual(['month']);
    expect(sourceIocRegionDocument(source)).toBe(source);
  });

  it('re-parses office-navigation pages idempotently without module-level state', () => {
    const raw = {
      schemaVersion: versionPolicy.current,
      id: 'office-nav-roundtrip',
      layout: 'dashboard',
      dataSources: {
        ds: {
          fields: { k: { type: 'string', role: 'dimension' } },
          source: { type: 'inline', rows: [{ k: 'a' }] },
        },
      },
      sections: [
        {
          id: 'header',
          components: [
            {
              id: 'hdr',
              type: 'iocHeader',
              layout: { span: 12 },
              props: {
                identity: { title: '办事处导航' },
                components: [
                  {
                    id: 'region-ctrl',
                    type: 'regionFilter',
                    props: { officeNavigate: { href: '/pages/office-view' } },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const first = parsePage(raw);
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error(JSON.stringify(first.errors));
    expect(first.page.filters?.some((filter) => filter.id === 'region')).toBe(true);

    const second = parsePage(first.page);
    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error(JSON.stringify(second.errors));
    expect(second.page).toEqual(first.page);
  });
});
