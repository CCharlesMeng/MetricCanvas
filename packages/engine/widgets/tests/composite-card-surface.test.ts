import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compositeCardChildTypes } from '@metriccanvas/page';

/**
 * 「卡里不套卡」的机器判据(ADR-0053 要求的那次准入实证)。
 *
 * 白名单子组件如果自己有一张卡面(白底、圆角、内边距、边框、阴影),放进组合卡
 * 就成了两层卡面,而子组件不认识自己被谁装着,压不平只能由卡壳来做。因此协议侧
 * 的白名单与呈现侧的压平清单必须逐项对上——`keyValuePanel` 曾经就是白名单里
 * 唯一一个表面写成字面量、压不平的成员,这份测试钉住的正是那个缺口。
 *
 * 口径:表面量族的名字以 `-surface` / `-padding` / `-radius` / `-border` /
 * `-border-width` / `-shadow` 结尾,这正是既有两族(`--mc-metric-panel-*`、
 * `--mc-gauge-*`)的词汇;`--mc-color-*` 是色板层的名字,不是谁的表面量。
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const componentsDir = path.join(here, '../src/components');

/** 白名单成员 → 它的纯渲染组件文件。新准入一种就必须在这里给出文件。 */
const WIDGET_FILES: Record<string, string> = {
  metricCard: 'metric-card/MetricCard.svelte',
  pieChart: 'pie-chart/PieChart.svelte',
  gauge: 'gauge/Gauge.svelte',
  keyValuePanel: 'key-value-panel/KeyValuePanel.svelte',
  categoryBreakdown: 'category-breakdown/CategoryBreakdown.svelte'
};

const SURFACE_SUFFIXES = [
  '-surface',
  '-padding',
  '-radius',
  '-border',
  '-border-width',
  '-shadow'
];

/** 压平值:表面必须真的消失,而不是换一个别的表面。 */
const FLAT_VALUES = new Set(['transparent', 'none', '0', '0px']);

function source(relative: string): string {
  return readFileSync(path.join(componentsDir, relative), 'utf8');
}

/** 全部纯渲染与运行时包的样式承载文件;赋值点判定按仓扫,不按包信任。 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === 'node_modules' ? [] : sourceFiles(full);
    }
    const inSource = full.includes(`${path.sep}src${path.sep}`);
    return inSource && /\.(svelte|ts|css)$/.test(entry.name) ? [full] : [];
  });
}

function isSurfaceToken(name: string): boolean {
  if (name.startsWith('--mc-color-')) return false;
  return SURFACE_SUFFIXES.some((suffix) => name.endsWith(suffix));
}

/** 组件在自己的样式里**读**到的表面量。 */
function surfaceTokensRead(css: string): string[] {
  const names = [...css.matchAll(/var\((--mc-[a-z0-9-]+)/g)].map((match) => match[1]!);
  return [...new Set(names.filter(isSurfaceToken))].sort();
}

/** 组合卡卡内作用域**写**下的量,即压平清单。 */
function flattenedInCardScope(): Map<string, string> {
  const css = source('composite-card/CompositeCard.svelte');
  const scope = /\.composite-card\s*\{([^}]*)\}/.exec(css);
  expect(scope, '组合卡的卡内作用域 .composite-card 必须存在').not.toBeNull();
  return new Map(
    [...scope![1]!.matchAll(/(--mc-[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((match) => [
      match[1]!,
      match[2]!.trim()
    ])
  );
}

describe('组合卡的卡内表面压平', () => {
  it('压平清单覆盖白名单里每一个有自己表面的子组件，一个不漏', () => {
    const flattened = flattenedInCardScope();
    const missing: string[] = [];
    for (const [type, file] of Object.entries(WIDGET_FILES)) {
      for (const token of surfaceTokensRead(source(file))) {
        if (!flattened.has(token)) missing.push(`${type}: ${token}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('压平清单里没有多余项：写下的每个量都真有子组件在读', () => {
    const read = new Set(
      Object.values(WIDGET_FILES).flatMap((file) => surfaceTokensRead(source(file)))
    );
    expect([...flattenedInCardScope().keys()].filter((token) => !read.has(token))).toEqual(
      []
    );
  });

  it('压平值让表面真的消失，而不是换成另一张卡面', () => {
    const kept = [...flattenedInCardScope()].filter(
      ([, value]) => !FLAT_VALUES.has(value)
    );
    expect(kept).toEqual([]);
  });

  it('白名单每个成员都指到一个组件文件：准入一种就得补一次实证', () => {
    expect([...compositeCardChildTypes].sort()).toEqual(Object.keys(WIDGET_FILES).sort());
  });

  it('信息面板的表面全部走 token，不留字面量', () => {
    const css = source('key-value-panel/KeyValuePanel.svelte');
    const panel = /\.key-value-panel\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';

    expect(surfaceTokensRead(panel)).toEqual([
      '--mc-key-value-panel-padding',
      '--mc-key-value-panel-radius',
      '--mc-key-value-panel-surface'
    ]);
    // 报表形态的取值留在消费点的 var() 缺省值里:白底、16px 圆角、19px 内边距。
    expect(panel).toContain('var(--mc-key-value-panel-padding, 19px)');
    expect(panel).toContain('var(--mc-radius-section, 16px)');
  });

  /*
   * 报表形态零回归的机器判据。信息面板的表面在两档形态下取值相同,因此这三个量
   * 按布局形态定义点的规则①不进 `.page-content.layout-dashboard`——它们只为
   * 「卡内压平」而存在。只要卡内作用域是唯一的赋值点,卡外(两档形态都算)读到的
   * 就一定是消费点的 var() 缺省值,也就是改动前的那三个字面量。
   */
  it('信息面板的表面量只在卡内作用域被赋值：卡外两档形态都退回缺省值', () => {
    const definitions = sourceFiles(path.join(here, '../../')).filter((file) =>
      /--mc-key-value-panel-[a-z-]+\s*:/.test(readFileSync(file, 'utf8'))
    );
    expect(definitions.map((file) => path.basename(file))).toEqual([
      'CompositeCard.svelte'
    ]);
  });

  it('饼图与分类明细没有自己的表面，因此不需要压平', () => {
    for (const file of [WIDGET_FILES.pieChart!, WIDGET_FILES.categoryBreakdown!]) {
      expect(surfaceTokensRead(source(file))).toEqual([]);
    }
  });

  it('组合卡给满宽 compactSummary 下发横排上下文，窄容器保留纵排回退', () => {
    const card = source('composite-card/CompositeCard.svelte');
    const metric = source('metric-card/MetricCard.svelte');

    expect(card).toMatch(/\.composite-grid\s*\{[^}]*--mc-compact-summary-flow:\s*column;/s);
    expect(card).toMatch(/\.composite-card\s*\{[^}]*min-height:\s*280px;/s);
    expect(metric).toContain('grid-auto-flow: var(--mc-compact-summary-flow, row);');
    expect(metric).toMatch(
      /@container \(max-width: 230px\)[\s\S]*?\.metric-panel \.metric-values\s*\{[^}]*grid-auto-flow:\s*row;/
    );
  });

  it('详情页还原只靠有限 variant，不把页面 id 写进共享 Widget', () => {
    const files = [
      'report-header/ReportHeader.svelte',
      'key-value-panel/KeyValuePanel.svelte',
      'composite-card/CompositeCard.svelte',
      'table/Table.svelte',
      'field-text/FieldText.svelte'
    ];
    const combined = files.map(source).join('\n');

    expect(combined).not.toContain('ioc-project-detail');
    expect(source('report-header/ReportHeader.svelte')).toContain('project-detail');
    expect(source('key-value-panel/KeyValuePanel.svelte')).toContain('detail-summary');
    expect(source('key-value-panel/KeyValuePanel.svelte')).toContain('detail-norm-matrix');
    expect(source('composite-card/CompositeCard.svelte')).toContain('project-norms');
    expect(source('table/Table.svelte')).toContain('forecast-matrix');
    expect(source('field-text/FieldText.svelte')).toContain('narrative-short');
    expect(source('field-text/FieldText.svelte')).toContain('narrative-long');
  });

  it('指标网格是受控呈现档，不依赖机会点页 id 或文案', () => {
    const card = source('composite-card/CompositeCard.svelte');
    expect(card).toContain("variant?: 'compact' | 'projectNorms' | 'metricGrid'");
    expect(card).toContain("class:metric-grid={variant === 'metricGrid'}");
    expect(card).toMatch(/\.metric-grid\s*\{[^}]*padding:\s*20px;/s);
    expect(card).not.toContain('ioc-opportunity-analysis');
    expect(card).not.toContain('机会点');
  });

  it('详情页指标矩阵把四条边框都收在 90px 容器内', () => {
    const css = source('key-value-panel/KeyValuePanel.svelte');
    const matrixList = /\.detail-norm-matrix dl\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    const matrixHeader = /\.detail-norm-matrix dt\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    const matrixValue = [...css.matchAll(/\.detail-norm-matrix dd\s*\{([^}]*)\}/g)]
      .map((match) => match[1] ?? '')
      .find((block) => block.includes('height: 58px;')) ?? '';

    expect(matrixList).toContain('height: 90px;');
    expect(matrixList).toContain('overflow: hidden;');
    expect(matrixList).not.toContain('border-top:');
    expect(matrixHeader).toContain('height: 32px;');
    expect(matrixHeader).toContain('border-top: 1px solid rgb(0 0 0 / 0.15);');
    expect(matrixValue).toContain('height: 58px;');
  });

  it('详情页头使用可操作的返回箭头，两个标签按 12px 紧凑排列', () => {
    const header = source('report-header/ReportHeader.svelte');
    const tags = /\.project-detail \.tags\s*\{([^}]*)\}/.exec(header)?.[1] ?? '';
    const tag = /\.project-detail \.tags span\s*\{([^}]*)\}/.exec(header)?.[1] ?? '';

    expect(header).toContain('<button');
    expect(header).toContain('aria-label="返回上一页"');
    expect(header).toContain('onclick={onback}');
    expect(tags).toContain('display: flex;');
    expect(tags).toContain('gap: 12px;');
    expect(tag).toContain('position: static;');
    expect(header).not.toContain('left: 390px;');
  });

  it('详情页有限 variant 恒占满组件布局盒并只按容器宽度回流', () => {
    const header = source('report-header/ReportHeader.svelte');
    const summary = source('key-value-panel/KeyValuePanel.svelte');
    const norms = source('composite-card/CompositeCard.svelte');
    const table = source('table/Table.svelte');
    const narrative = source('field-text/FieldText.svelte');

    expect(header).toMatch(/\.report-header\.project-detail\s*\{[^}]*width:\s*100%;/s);
    expect(summary).toMatch(/\.detail-summary\s*\{[^}]*width:\s*100%;/s);
    expect(norms).toMatch(/\.project-norms\s*\{[^}]*width:\s*100%;/s);
    expect(table).toMatch(/\.table-widget\.forecast-matrix\s*\{[^}]*width:\s*100%;/s);
    expect(narrative).toMatch(/\.field-text\.narrative\s*\{[^}]*width:\s*100%;/s);

    for (const component of [header, summary, norms, table, narrative]) {
      expect(component).not.toContain('@media (max-width');
    }
    for (const component of [header, summary, norms]) {
      expect(component).toContain('@container mc-component-box');
    }
    expect(table).not.toContain('@container mc-component-box');
    expect(narrative).not.toContain('@container mc-component-box');
    expect(table).toMatch(
      /\.forecast-matrix > \.scroll\s*\{[^}]*width:\s*100%;[^}]*overflow-x:\s*auto;/s
    );
    expect(table).toContain(
      'style:--table-content-min-width={`${columnWidthTotal}px`}'
    );
    expect(table).toMatch(
      /\.forecast-matrix table\s*\{[^}]*width:\s*100%;[^}]*min-width:\s*var\(--table-content-min-width\);/s
    );
    expect(table).not.toContain('1584px');
    expect(narrative).not.toContain('(max-width: 1678px)');
    expect(narrative).not.toMatch(/padding:\s*14px\s+(?:370|175|1180)px/);
    const shortNarrative = /\.narrative-short\s*\{([^}]*)\}/.exec(narrative)?.[1] ?? '';
    expect(shortNarrative).toContain('min-height: 180px;');
    expect(shortNarrative).not.toMatch(/(?:^|[;\n])\s*height:/);
  });

  it('纯渲染 Widget 不读取 viewport，离散响应只读取组件或自身局部布局盒', () => {
    const widgetSources = sourceFiles(componentsDir)
      .filter((file) => file.endsWith('.svelte'))
      .map((file) => readFileSync(file, 'utf8'));

    for (const component of widgetSources) {
      expect(component).not.toContain('@media (max-width');
    }
    expect(source('metric-card/MetricCard.svelte')).not.toContain(
      '@container mc-component-box'
    );
    expect(source('metric-card/MetricCard.svelte')).toContain('@container (max-width: 230px)');
    expect(source('map-chart/MapChart.svelte')).toContain(
      '@container mc-component-box (max-width: 960px)'
    );
  });
});
