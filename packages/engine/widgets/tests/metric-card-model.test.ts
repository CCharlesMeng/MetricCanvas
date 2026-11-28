import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import type { Component } from 'svelte';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import type { MetricCardProps, MetricCardRow } from '@metriccanvas/page/internal';
import type { MetricDataSlots } from '../src/shared/component-data';
import {
  formatMetricFieldText,
  isFieldLoading,
  resolveMetricChangeDisplay,
  resolveMetricProgress,
  resolveMetricValueDisplay,
  resolveRowDefinitionCode
} from '../src/components/metric-card/metric-card-model';

const require = createRequire(import.meta.url);
const srcDir = fileURLToPath(new URL('../src/', import.meta.url));

async function loadMetricCard(): Promise<Component<Record<string, unknown>>> {
  const bundled = await build({
    stdin: {
      resolveDir: srcDir,
      contents: "export { default } from './components/metric-card/MetricCard.svelte';"
    },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    conditions: ['svelte'],
    external: ['svelte', 'svelte/*'],
    plugins: [
      {
        name: 'svelte-server',
        setup(plugin) {
          plugin.onLoad({ filter: /\.svelte$/ }, (args) => ({
            contents: compile(readFileSync(args.path, 'utf8'), {
              generate: 'server',
              filename: args.path
            }).js.code,
            loader: 'js'
          }));
        }
      }
    ]
  });
  const code = bundled.outputFiles[0]!.text.replace(
    /(['"])(svelte(?:\/[^'"]+)?)\1/g,
    (_match, _quote, specifier: string) => JSON.stringify(pathToFileURL(require.resolve(specifier)).href)
  );
  const mod = (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)) as {
    default: Component<Record<string, unknown>>;
  };
  return mod.default;
}

const sampleData: MetricDataSlots = {
  main: {
    sourceStatus: 'ready',
    fields: {
      revenue: { type: 'number', role: 'measure', metricCode: 'REV_001', defaultFormat: 'number-0' },
      yoy: { type: 'number', role: 'measure', defaultFormat: 'number-1-signed' },
      rate: { type: 'number', role: 'measure', defaultFormat: 'percent-1' },
      label: { type: 'string', role: 'dimension' }
    },
    snapshot: { status: 'ready', rows: [{ revenue: 1280, yoy: 12.5, rate: 0.785, label: '华东' }] }
  },
  compare: {
    sourceStatus: 'loading',
    fields: {
      delta: { type: 'number', role: 'measure', defaultFormat: 'number-1-signed' }
    },
    snapshot: { status: 'ready', rows: [{ delta: -3.2 }] }
  }
};

describe('metric-card-model pure helpers', () => {
  it('detects per-slot loading state accurately', () => {
    expect(isFieldLoading('revenue', sampleData, false)).toBe(false);
    expect(isFieldLoading('revenue', sampleData, true)).toBe(false);
    expect(isFieldLoading({ data: 'compare', field: 'delta' }, sampleData, true)).toBe(true);
    expect(isFieldLoading({ data: 'target', field: 'goal' }, sampleData, true)).toBe(true);
  });

  it('resolves measure definition code only when row definition tip is enabled', () => {
    const row: MetricCardRow = { label: '营收', valueField: 'revenue', showDefinition: true };
    expect(resolveRowDefinitionCode(row, sampleData, true)).toBe('REV_001');
    expect(resolveRowDefinitionCode(row, sampleData, false)).toBeUndefined();
    expect(resolveRowDefinitionCode({ ...row, label: '   ' }, sampleData, true)).toBeUndefined();
    expect(resolveRowDefinitionCode({ label: '区域', valueField: 'label', showDefinition: true }, sampleData, true)).toBeUndefined();
  });

  it('formats primary values, units, and explicit color rules', () => {
    const row: MetricCardRow = {
      label: '营收',
      valueField: 'revenue',
      unit: '万元',
      colorRule: { mode: 'sign', positive: 'green', negative: 'red' }
    };
    const display = resolveMetricValueDisplay(row, sampleData, false);
    expect(display.pending).toBe(false);
    expect(display.text).toBe('1,280');
    expect(display.unit).toBe('万元');
    expect(display.colorStyle).toBeDefined();
    expect(formatMetricFieldText('revenue', sampleData, '万元')).toBe('1,280');
  });

  it('resolves change polarity, trend arrow visibility, and percent suppression', () => {
    const signedChange = resolveMetricChangeDisplay(
      { label: '同比', field: 'yoy', unit: '天' },
      sampleData,
      false,
      true
    );
    expect(signedChange.direction).toBe('positive');
    expect(signedChange.showTrendArrow).toBe(true);
    expect(signedChange.unit).toBe('天');

    const percentChange = resolveMetricChangeDisplay(
      { label: '占比', field: 'rate', tone: 'positive' },
      sampleData,
      false,
      true
    );
    expect(percentChange.showTrendArrow).toBe(false);
  });

  it('resolves progress ring display with default label fallback', () => {
    expect(resolveMetricProgress(undefined, sampleData, false)).toBeUndefined();
    const progress = resolveMetricProgress(
      { valueField: { data: 'main', field: 'rate', format: 'percent-1' }, ringPercent: 78.5 },
      sampleData,
      false
    );
    expect(progress).toEqual({
      loading: false,
      value: 0.785,
      missingText: undefined,
      format: 'percent-1',
      ringPercent: 78.5,
      label: '完成率'
    });
  });
});

describe('MetricCard SSR variants and CSS injection', () => {
  it('renders every layout variant with expected root classes and injected styles', async () => {
    const MetricCard = await loadMetricCard();
    const variants: Array<{ variant: MetricCardProps['variant']; expectedClass: string }> = [
      { variant: undefined, expectedClass: 'metric-card' },
      { variant: 'summary', expectedClass: 'summary' },
      { variant: 'activityProgress', expectedClass: 'activity-progress' },
      { variant: 'primaryDetail', expectedClass: 'primary-detail' },
      { variant: 'compactSummary', expectedClass: 'compact-summary' },
      { variant: 'dualSummary', expectedClass: 'dual-summary' },
      { variant: 'compactStrip', expectedClass: 'compact-strip' },
      { variant: 'compactStack', expectedClass: 'compact-stack' }
    ];

    for (const { variant, expectedClass } of variants) {
      const rendered = render(MetricCard, {
        props: {
          data: sampleData,
          props: {
            variant,
            title: '核心指标',
            secondaryTitle: '明细指标',
            showTrendArrows: true,
            rows: [
              {
                label: '营收',
                valueField: 'revenue',
                unit: '万元',
                changes: [{ label: '同比', field: 'yoy' }]
              }
            ],
            secondaryRows: [{ label: '区域', valueField: 'label' }],
            progress: variant === 'activityProgress' ? { valueField: 'rate', label: '达成率' } : undefined
          } satisfies MetricCardProps
        }
      });
      expect(rendered.body, `variant=${variant ?? 'default'}`).toContain(expectedClass);
      expect(rendered.body, `variant=${variant ?? 'default'}`).toContain('1,280');
      expect(rendered.body, `variant=${variant ?? 'default'}`).toContain('万元');
      expect(rendered.head, `variant=${variant ?? 'default'} CSS head`).toMatch(/<style\b[^>]*>/);
    }
  });
});
