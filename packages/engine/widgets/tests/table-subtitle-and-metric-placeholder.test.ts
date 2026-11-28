import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import type { Component } from 'svelte';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const srcDir = fileURLToPath(new URL('../src/', import.meta.url));

async function loadServerComponent(
  relativeEntry: string,
): Promise<Component<Record<string, unknown>>> {
  const bundled = await build({
    stdin: {
      resolveDir: srcDir,
      contents: `export { default } from '${relativeEntry}';`,
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
              filename: args.path,
            }).js.code,
            loader: 'js',
          }));
        },
      },
    ],
  });
  const code = bundled.outputFiles[0]!.text.replace(
    /(['"])(svelte(?:\/[^'"]+)?)\1/g,
    (_match, _quote, specifier: string) =>
      JSON.stringify(pathToFileURL(require.resolve(specifier)).href),
  );
  const mod = (await import(
    `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  )) as {
    default: Component<Record<string, unknown>>;
  };
  return mod.default;
}

describe('Table subtitle neutrality', () => {
  const tableData = {
    main: {
      fields: { name: { type: 'string', role: 'dimension' } },
      snapshot: { status: 'ready', rows: [{ name: '示例行' }] },
    },
  };
  const tableView = { pageIndex: 0, sort: [], headerFilters: {} };

  it('omitting props.subtitle renders no subtitle and no hardcoded business copy', async () => {
    const Table = await loadServerComponent('./components/table/Table.svelte');
    const omitted = render(Table, {
      props: {
        data: tableData,
        props: { title: '通用明细', columns: [{ field: 'name', title: '名称' }] },
        view: tableView,
      },
    });
    expect(omitted.body).not.toContain('class="subtitle');
    expect(omitted.body).not.toContain('合同单');
    expect(omitted.body).not.toContain('商务单');

    const empty = render(Table, {
      props: {
        data: tableData,
        props: { title: '关闭备注', subtitle: '', columns: [{ field: 'name', title: '名称' }] },
        view: tableView,
      },
    });
    expect(empty.body).not.toContain('class="subtitle');
  });

  it('explicit props.subtitle renders as configured', async () => {
    const Table = await loadServerComponent('./components/table/Table.svelte');
    const explicit = render(Table, {
      props: {
        data: tableData,
        props: {
          title: '统一格式',
          subtitle: '— 代表本周期暂无数值',
          columns: [{ field: 'name', title: '名称' }],
        },
        view: tableView,
      },
    });
    expect(explicit.body).toContain('— 代表本周期暂无数值');
    expect(explicit.body).toMatch(/class="subtitle[^"]*">— 代表本周期暂无数值<\/div>/);
  });
});

function stripComments(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, '');
}

describe('MetricCard placeholder neutrality', () => {
  const metricData = {
    main: {
      fields: { total: { type: 'number', role: 'measure', defaultFormat: 'number-0' } },
      snapshot: { status: 'ready', rows: [{ total: 42 }] },
    },
  };

  it('dualSummary with omitted secondaryRows renders a neutral placeholder without hardcoded business labels', async () => {
    const MetricCard = await loadServerComponent('./components/metric-card/MetricCard.svelte');
    const rendered = render(MetricCard, {
      props: {
        data: metricData,
        props: {
          variant: 'dualSummary',
          title: '主面板',
          secondaryTitle: '次级面板',
          rows: [{ label: '总量', valueField: 'total' }],
        },
      },
    });
    const html = stripComments(rendered.body);
    expect(html).toContain('placeholder-values');
    expect(html).toContain('aria-label="次级面板数据待补充"');
    expect(html).toMatch(/class="row-value[^"]*">—<\/span>/);
    for (const forbidden of ['年累计', '同比', '本月', '环比']) {
      expect(html).not.toContain(forbidden);
    }
  });
});
