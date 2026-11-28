import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import type { Component } from 'svelte';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import type { TableColumn, TableProps } from '@metriccanvas/page/internal';
import type { NamedDataSlots } from '../src/shared/component-data';
import {
  computeColumnWidthTotal,
  computeFitMinWidth,
  computeNextTableSort,
  computePageWindow,
  computeRateBarMaxima,
  computeRateBarWidth,
  computeStickyOffsets,
  computeValidExpansionKeys,
  formatColumnWidthStyle,
  formatStickyCellStyle
} from '../src/components/table/table-layout';

const require = createRequire(import.meta.url);
const srcDir = fileURLToPath(new URL('../src/', import.meta.url));

async function loadTable(): Promise<Component<Record<string, unknown>>> {
  const bundled = await build({
    stdin: {
      resolveDir: srcDir,
      contents: "export { default } from './components/table/Table.svelte';"
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

describe('table-layout pure helpers', () => {
  it('computes unique expansion keys excluding duplicates and undefined', () => {
    const keys = computeValidExpansionKeys(
      [{ id: 'a' }, { id: 'b' }, { id: 'b' }, {}],
      (row) => (typeof row.id === 'string' ? row.id : undefined)
    );
    expect([...keys]).toEqual(['a']);
    expect([...computeValidExpansionKeys([{ id: 'a' }], undefined)]).toEqual([]);
  });

  it('computes total width, fit min width, and column width styles', () => {
    const leaves: TableColumn[] = [{ field: 'name', width: 100 }, { field: 'amount' }];
    const total = computeColumnWidthTotal(leaves, 64, true);
    expect(total).toBe(100 + 120 + 64 + 40);
    expect(computeFitMinWidth(leaves, total, 64, true)).toBeCloseTo((total * 52) / 64);
    expect(computeFitMinWidth([], 0, 0, false)).toBe(0);
    expect(formatColumnWidthStyle(leaves[0]!, 'container', total)).toBe(`width: ${(100 / total) * 100}%;`);
    expect(formatColumnWidthStyle(leaves[0]!, undefined, total)).toBe('width: 100px; min-width: 100px;');
    expect(formatColumnWidthStyle(leaves[1]!, undefined, total)).toBe('');
  });

  it('accumulates left and right sticky offsets including expand and fixed rowNumber columns', () => {
    const leaves: TableColumn[] = [
      { field: 'a', fixed: 'left', width: 80 },
      { field: 'b', fixed: 'left' },
      { field: 'c', width: 150 },
      { field: 'd', fixed: 'right', width: 90 },
      { field: 'e', fixed: 'right', width: 70 }
    ];
    const offsets = computeStickyOffsets(leaves, true, true, 64);
    expect(formatStickyCellStyle(leaves[0]!, offsets)).toBe('position: sticky; left: 104px;');
    expect(formatStickyCellStyle(leaves[1]!, offsets)).toBe('position: sticky; left: 184px;');
    expect(formatStickyCellStyle(leaves[2]!, offsets)).toBe('');
    expect(formatStickyCellStyle(leaves[4]!, offsets)).toBe('position: sticky; right: 0px;');
    expect(formatStickyCellStyle(leaves[3]!, offsets)).toBe('position: sticky; right: 70px;');
  });

  it('cycles single-column and multi-column Shift+click sort rules', () => {
    expect(computeNextTableSort([], 'a', false, false)).toEqual([{ field: 'a', direction: 'asc' }]);
    expect(computeNextTableSort([{ field: 'a', direction: 'asc' }], 'a', false, false)).toEqual([
      { field: 'a', direction: 'desc' }
    ]);
    expect(computeNextTableSort([{ field: 'a', direction: 'desc' }], 'a', false, false)).toEqual([]);
    expect(computeNextTableSort([{ field: 'a', direction: 'desc' }], 'a', false, true)).toEqual([
      { field: 'a', direction: 'asc' }
    ]);
    expect(computeNextTableSort([{ field: 'a', direction: 'asc' }], 'b', true, false)).toEqual([
      { field: 'a', direction: 'asc' },
      { field: 'b', direction: 'asc' }
    ]);
  });

  it('computes pagination window with ellipses across boundary and middle pages', () => {
    expect(computePageWindow(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(computePageWindow(2, 12)).toEqual([1, 2, 3, 4, 5, 6, '…', 12]);
    expect(computePageWindow(10, 12)).toEqual([1, '…', 7, 8, 9, 10, 11, 12]);
    expect(computePageWindow(6, 12)).toEqual([1, '…', 4, 5, 6, 7, 8, '…', 12]);
  });

  it('computes rateBar maxima and clamped percentages', () => {
    const leaves: TableColumn[] = [{ field: 'rate', visual: 'rateBar' }, { field: 'name' }];
    const data: NamedDataSlots = {
      main: {
        fields: { rate: { type: 'number', role: 'measure' } },
        snapshot: { status: 'ready', rows: [{ rate: 25 }, { rate: -50 }] }
      }
    };
    const rows = [
      { main: { rate: 25 }, bySlot: { main: { rate: 25 } } },
      { main: { rate: -50 }, bySlot: { main: { rate: -50 } } }
    ];
    const maxima = computeRateBarMaxima(leaves, rows, data);
    expect(computeRateBarWidth(leaves[0]!, 25, maxima)).toBe(50);
    expect(computeRateBarWidth(leaves[0]!, -50, maxima)).toBe(100);
    expect(computeRateBarWidth(leaves[0]!, null, maxima)).toBe(0);
  });
});

describe('Table SSR variants, sub-components, and injected CSS', () => {
  const data = {
    main: {
      sourceStatus: 'ready' as const,
      fields: {
        name: { type: 'string' as const, role: 'dimension' as const },
        rate: { type: 'number' as const, role: 'measure' as const, defaultFormat: 'percent-1' as const },
        date: { type: 'string' as const, role: 'dimension' as const },
        amount: { type: 'number' as const, role: 'measure' as const, unit: '万元' }
      },
      snapshot: {
        status: 'ready' as const,
        rows: [
          { name: '华东大区', rate: 0.4, date: '2026-01-01', amount: 120 },
          { name: '华南大区', rate: 0.8, date: '2026-02-01', amount: 240 }
        ]
      }
    }
  };

  it('renders header filters, rate bars, pagination, and injected styles across variants', async () => {
    const Table = await loadTable();
    for (const variant of [undefined, 'reportCompact', 'embedded', 'forecastMatrix'] as const) {
      const tableProps: TableProps = {
        variant,
        title: '区域明细',
        pagination: { mode: 'local', pageSize: 10 },
        columns: [
          { field: 'name', title: '区域', sortable: true, filterable: { mode: 'select' }, fixed: 'left', width: 120 },
          { field: 'rate', title: '达成率', visual: 'rateBar', width: 140 },
          { field: 'date', title: '日期', filterable: { mode: 'dateRange' }, width: 120 },
          { field: 'amount', title: '金额', filterable: { mode: 'numberRange' }, align: 'right', width: 120 }
        ]
      };
      const rendered = render(Table, {
        props: {
          data,
          props: tableProps,
          view: { pageIndex: 0, sort: [{ field: 'name', direction: 'asc' }], headerFilters: {} },
          filterOptions: { name: ['华东大区', '华南大区'] },
          pagination: { pageSize: 10, totalCount: 25 }
        }
      });
      expect(rendered.body).toContain('data-table-title="区域明细"');
      expect(rendered.body).toContain('rate-bar');
      expect(rendered.body).toContain('总条数：');
      expect(rendered.body).toContain('原始单位：万元');
      expect(rendered.head).toMatch(/<style\b[^>]*>/);
    }
  });
});
