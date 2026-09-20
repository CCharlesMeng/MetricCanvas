import type { TypedError } from './errors';
import { collectTextValueReferences } from './page-param';
import { walkDocumentComponents } from './component-walk';

/**
 * 页面协议版本策略(ADR-0051):`schemaVersion` 是 `MAJOR.MINOR`。
 *
 * 2026-09-18 用户确认收窄读取策略：6.x 支持 6.5 与 6.6，5.x 只读例外不变。
 * 能力表保留协议演进信息，不再表示旧 6.x 版本获得读取支持。
 */

export const PAGE_SCHEMA_MAJOR = 6;
const CURRENT_MINOR = 6;
/**
 * 5.x 与 6.0 的主体页面结构兼容，故保留为只读输入版本；读取时只需把
 * 旧导航转换为 6.x 的普通 URL 导航。新文档始终写 6.x。
 */
export const LEGACY_READABLE_PAGE_SCHEMA_VERSIONS = ['5.0', '5.1', '5.2', '5.3', '5.4'] as const;

export interface PageCapabilityDefinition {
  /** 引入该能力的次版本。 */
  minor: number;
  description: string;
  /**
   * 文档中使用该能力的位置(JSON Pointer),空数组表示未使用。
   *
   * 能力探测只关心文档「用没用到某个结构」,因此按结构读取,并且读的是
   * **原始文档**而不是解析产物:文本取值引用在解析接缝就被整值替换掉了,
   * 拿解析产物去探测会漏判它。
   */
  usedAt(document: unknown): string[];
}

export const pageCapabilities = {
  'grouped-params': {
    minor: 6, description: '分组参数、多个独立时间区间与查询原位引用',
    usedAt: (document) => record(record(document)?.params) ? ['/params'] : []
  },
  'million-formats': {
    minor: 5, description: '按百万呈现数值，支持0/1/2位小数',
    usedAt: millionFormatPaths
  },
  'inline-page-params': {
    minor: 5,
    description: '页面参数 value、timeRange 与 DQE 取值位置的受控原位引用',
    usedAt: (document) => {
      const raw = record(document);
      const params = Array.isArray(raw?.params) ? raw.params : [];
      const paths = params.flatMap((p, i) => record(p)?.type === 'timeRange' || has(record(p), 'value') ? [`/params/${i}`] : []);
      return [...paths, ...dataSourcePaths(document, d => containsInlineParam(record(record(d.source)?.query)?.body)).map(p => `${p}/source/query/body`)];
    }
  },
  'named-to-date-windows': {
    minor: 4, description: '具名年初/月初至报告基准期窗口',
    usedAt: (document) => dataSourcePaths(document, d =>
      Object.values(record(record(record(d.source)?.query)?.paramBindings) ?? {}).some(b =>
        ['yearToDate', 'monthToDate'].includes(String(record(record(b)?.window)?.kind))
      )).map(p => `${p}/source/query/paramBindings`)
  },
  'time-params': {
    minor: 3, description: '确定性日期/月参数与查询时间窗口绑定',
    usedAt: (document) => {
      const raw = record(document);
      const params = Array.isArray(raw?.params) ? raw.params : [];
      return [
        ...params.flatMap((p, i) => record(p)?.type === 'time' ? [`/params/${i}`] : []),
        ...dataSourcePaths(document, d => Object.values(record(record(record(d.source)?.query)?.paramBindings) ?? {}).some(b => record(b)?.target === 'time')).map(p => `${p}/source/query/paramBindings`)
      ];
    }
  },
  'dimension-params': {
    minor: 2, description: '维度参数、查询目标与筛选初值绑定',
    usedAt: (document) => {
      const raw = record(document);
      const params = Array.isArray(raw?.params) ? raw.params : [];
      return [
        ...params.flatMap((p, i) => record(p)?.type === 'dimension' ? [`/params/${i}`] : []),
        ...filterPaths(document, f => has(f, 'initialParam')).map(p => `${p}/initialParam`),
        ...dataSourcePaths(document, d => has(record(record(d.source)?.query), 'paramBindings')).map(p => `${p}/source/query/paramBindings`)
      ];
    }
  },
  'page-layout': {
    minor: 1,
    description: '顶层 layout:页面布局形态的规范字段',
    usedAt: (document) => record(document)?.layout !== undefined ? ['/layout'] : []
  },
  'page-params': {
    minor: 0,
    description: '顶层 params:页面参数声明(ADR-0047)',
    usedAt: (document) => (nonEmptyArray(record(document)?.params) ? ['/params'] : [])
  },
  'page-layout-form': {
    minor: 0,
    description: '顶层 layoutForm:页面布局形态(看板满宽 / 报表定宽)',
    usedAt: (document) =>
      typeof record(document)?.layoutForm === 'string' ? ['/layoutForm'] : []
  },
  'dashboard-toolbar-visibility': {
    minor: 0,
    description: '顶层 dashboardToolbar:显式关闭 dashboard 统一工具栏',
    usedAt: (document) =>
      typeof record(document)?.dashboardToolbar === 'string' ? ['/dashboardToolbar'] : []
  },
  'project-detail-restoration-variants': {
    minor: 0,
    description: '项目详情页还原专用的组件呈现档',
    usedAt: (document) =>
      componentPaths(document, (component) => {
        const variant = props(component)?.variant;
        return (
          (component.type === 'reportHeader' && variant === 'projectDetail') ||
          (component.type === 'keyValuePanel' &&
            (variant === 'detailSummary' || variant === 'detailNormMatrix')) ||
          (component.type === 'compositeCard' && variant === 'projectNorms') ||
          (component.type === 'table' && variant === 'forecastMatrix') ||
          (component.type === 'fieldText' &&
            (variant === 'narrativeShort' ||
              variant === 'narrativeMeeting' ||
              variant === 'narrativeRisk' ||
              variant === 'narrativeProgress'))
        );
      }).map((path) => `${path}/props/variant`)
  },
  'key-value-panel-six-columns': {
    minor: 0,
    description: 'key-value 信息面板的六列排布',
    usedAt: (document) =>
      componentPaths(
        document,
        (component) =>
          component.type === 'keyValuePanel' && props(component)?.columns === 6
      ).map((path) => `${path}/props/columns`)
  },
  'component-backdrop-layer': {
    minor: 0,
    description: '组件 layout.layer:分区内叠放层,组件铺满分区置于其余组件之下',
    usedAt: (document) => componentLayerPaths(document),
  },
  'text-value-reference': {
    minor: 0,
    description: '文本取值引用页面参数而不是写字面量(ADR-0047)',
    usedAt: (document) =>
      collectTextValueReferences(document).map((usage) => usage.path)
  },
  'data-source-computation': {
    minor: 0,
    description: '页面数据源的受控计算阶段与具名算子(ADR-0046)',
    usedAt: (document) =>
      dataSourcePaths(document, (dataSource) => nonEmptyArray(dataSource.compute)).map(
        (path) => `${path}/compute`
      )
  },
  'collapsible-measure': {
    minor: 0,
    description: '结果字段契约上的可折叠度量声明(ADR-0046)',
    usedAt: (document) => collapsibleFieldPaths(document)
  },
  'table-row-kind-field': {
    minor: 0,
    description: '表格按行类别字段套用明细/小计/合计呈现档位(ADR-0049)',
    usedAt: (document) =>
      componentPaths(
        document,
        (component) => component.type === 'table' && has(props(component), 'rowKindField')
      ).map((path) => `${path}/props/rowKindField`)
  },
  'table-merge-by': {
    minor: 0,
    description: '表格按字段合并相邻同值单元格(ADR-0049)',
    usedAt: (document) =>
      componentPaths(
        document,
        (component) => component.type === 'table' && has(props(component), 'mergeBy')
      ).map((path) => `${path}/props/mergeBy`)
  },
  'key-value-panel-component': {
    minor: 0,
    description: 'key-value 信息面板组件',
    usedAt: (document) =>
      componentPaths(document, (component) => component.type === 'keyValuePanel')
  },
  'field-text-component': {
    minor: 0,
    description: '字段绑定长文本组件',
    usedAt: (document) =>
      componentPaths(document, (component) => component.type === 'fieldText')
  },
  'filter-boolean': {
    minor: 0,
    description: 'boolean 筛选器(ADR-0050)',
    usedAt: (document) => filterPaths(document, (filter) => filter.type === 'boolean')
  },
  'filter-time-point': {
    minor: 0,
    description: 'timePoint 筛选器(ADR-0050)',
    usedAt: (document) => filterPaths(document, (filter) => filter.type === 'timePoint')
  },
  'filter-number-range': {
    minor: 0,
    description: 'numberRange 筛选器(ADR-0050)',
    usedAt: (document) => filterPaths(document, (filter) => filter.type === 'numberRange')
  },
  'filter-search': {
    minor: 0,
    description: 'search 筛选器(ADR-0050)',
    usedAt: (document) => filterPaths(document, (filter) => filter.type === 'search')
  },
  'filter-hierarchy': {
    minor: 0,
    description: '层级维度筛选器(ADR-0050)',
    usedAt: (document) =>
      filterPaths(document, (filter) => nonEmptyArray(filter.hierarchy)).map(
        (path) => `${path}/hierarchy`
      )
  },
  'filter-depends-on': {
    minor: 0,
    description: '筛选器级联 dependsOn(ADR-0050)',
    usedAt: (document) =>
      filterPaths(document, (filter) => typeof filter.dependsOn === 'string').map(
        (path) => `${path}/dependsOn`
      )
  },
  'filter-relative-time': {
    minor: 0,
    description: '结构化相对时间表达(ADR-0035 / ADR-0050)',
    usedAt: (document) =>
      filterPaths(document, (filter) => isRelativeDefault(filter.default)).map(
        (path) => `${path}/default`
      )
  },
  'table-column-link': {
    minor: 0,
    description: '表格列声明为行点击导航入口(ADR-0049)',
    usedAt: (document) => tableColumnLinkPaths(document)
  },
  'tab-container-component': {
    minor: 0,
    description: 'Tab 容器组件',
    usedAt: (document) =>
      componentPaths(document, (component) => component.type === 'tabContainer')
  },
  'gauge-component': {
    minor: 0,
    description: 'gauge 仪表组件',
    usedAt: (document) =>
      componentPaths(document, (component) => component.type === 'gauge')
  },
  'map-hierarchy-filter': {
    minor: 0,
    description: '地图按层级维度筛选器下钻',
    usedAt: (document) =>
      componentPaths(
        document,
        (component) => component.type === 'mapChart' && has(props(component), 'hierarchyFilter')
      ).map((path) => `${path}/props/hierarchyFilter`)
  },
  'composite-card-component': {
    minor: 0,
    description: '组合卡:组件级分组容器(ADR-0053)',
    usedAt: (document) =>
      componentPaths(document, (component) => component.type === 'compositeCard')
  },
  'category-breakdown-component': {
    minor: 0,
    description: '分类明细组件(ADR-0053)',
    usedAt: (document) =>
      componentPaths(document, (component) => component.type === 'categoryBreakdown')
  },
  'map-legend-bands': {
    minor: 0,
    description: '地图分档图例',
    usedAt: (document) =>
      componentPaths(
        document,
        (component) => component.type === 'mapChart' && has(props(component), 'legend')
      ).map((path) => `${path}/props/legend`)
  },
  'map-tooltip-fields': {
    minor: 0,
    description: '地图 tooltip 扩展字段',
    usedAt: (document) =>
      componentPaths(
        document,
        (component) => component.type === 'mapChart' && has(props(component), 'tooltipFields')
      ).map((path) => `${path}/props/tooltipFields`)
  },
  'key-value-panel-single-column': {
    minor: 0,
    description: 'key-value 信息面板的单列排布',
    usedAt: (document) =>
      componentPaths(
        document,
        (component) =>
          component.type === 'keyValuePanel' && props(component)?.columns === 1
      ).map((path) => `${path}/props/columns`)
  },
  'ratio-scale': {
    minor: 0,
    description: 'ratio 算子的输出刻度 scale(ADR-0046)',
    usedAt: (document) => ratioScalePaths(document)
  },
  'section-column-tracks': {
    minor: 0,
    description: '内容分区的受控列轨权重(ADR-0054)',
    usedAt: (document) => sectionColumnTrackPaths(document)
  },
  'filter-empty-label': {
    minor: 0,
    description: '维度筛选器的空选展示文案',
    usedAt: (document) =>
      filterPaths(document, (filter) => typeof filter.emptyLabel === 'string').map(
        (path) => `${path}/emptyLabel`
      )
  },
  'filter-hierarchy-picker': {
    minor: 0,
    description: '层级维度筛选器的显式级别切换器形态',
    usedAt: (document) =>
      filterPaths(document, (filter) => typeof filter.hierarchyPicker === 'string').map(
        (path) => `${path}/hierarchyPicker`
      )
  },
  'metric-row-context': {
    minor: 0,
    description: '指标行与主值同排的短上下文',
    usedAt: (document) => metricRowContextPaths(document)
  },
  'composite-card-compact': {
    minor: 0,
    description: '组合卡紧凑呈现档',
    usedAt: (document) =>
      componentPaths(
        document,
        (component) => component.type === 'compositeCard' && props(component)?.variant === 'compact'
      ).map((path) => `${path}/props/variant`)
  },
  'tab-container-compact': {
    minor: 0,
    description: 'Tab 容器紧凑呈现档',
    usedAt: (document) =>
      componentPaths(
        document,
        (component) => component.type === 'tabContainer' && props(component)?.variant === 'compact'
      ).map((path) => `${path}/props/variant`)
  },
  'table-embedded': {
    minor: 0,
    description: '表格嵌入式密度与底部渐隐',
    usedAt: (document) => [
      ...componentPaths(
        document,
        (component) => component.type === 'table' && props(component)?.variant === 'embedded'
      ).map((path) => `${path}/props/variant`),
      ...componentPaths(
        document,
        (component) => component.type === 'table' && has(props(component), 'bottomFade')
      ).map((path) => `${path}/props/bottomFade`)
    ]
  },
  'key-value-item-unit': {
    minor: 0,
    description: '信息面板条目的展示单位',
    usedAt: (document) => keyValueItemUnitPaths(document)
  },
  'widget-symbol-icons': {
    minor: 0,
    description: '组合卡和信息面板的受控语义图标',
    usedAt: (document) => widgetSymbolIconPaths(document)
  },
  'map-regional-overview': {
    minor: 0,
    description: '地域概览地图与稳定字段匹配的固定摘要',
    usedAt: (document) => [
      ...componentPaths(
        document,
        (component) => component.type === 'mapChart' && props(component)?.variant === 'regionalOverview'
      ).map((path) => `${path}/props/variant`),
      ...componentPaths(
        document,
        (component) => component.type === 'mapChart' && has(props(component), 'pinnedSummary')
      ).map((path) => `${path}/props/pinnedSummary`)
    ]
  },
  'metric-row-link': {
    minor: 0,
    description: '指标行的显式非空值导航入口',
    usedAt: (document) => metricRowLinkPaths(document)
  },
  'tab-container-multi-table': {
    minor: 0,
    description: 'Tab item 按顺序承载非空表格列表',
    usedAt: (document) => tabMultiTablePaths(document)
  },
  'tab-container-analysis-stack': {
    minor: 0,
    description: 'Tab 容器的分析表格堆叠呈现档',
    usedAt: (document) =>
      componentPaths(
        document,
        (component) => component.type === 'tabContainer' && props(component)?.variant === 'analysisStack'
      ).map((path) => `${path}/props/variant`)
  },
  'dashboard-toolbar-compact-read-only': {
    minor: 0,
    description: 'dashboard 紧凑页头与只读筛选说明',
    usedAt: (document) =>
      record(document)?.dashboardToolbar && typeof record(document)?.dashboardToolbar === 'object'
        ? ['/dashboardToolbar']
        : []
  },
  'composite-card-metric-grid': {
    minor: 0,
    description: '组合卡的紧凑指标网格呈现档',
    usedAt: (document) =>
      componentPaths(
        document,
        (component) => component.type === 'compositeCard' && props(component)?.variant === 'metricGrid'
      ).map((path) => `${path}/props/variant`)
  }
} satisfies Record<string, PageCapabilityDefinition>;

export type PageCapability = keyof typeof pageCapabilities;

export interface VersionPolicy {
  major: number;
  /** 该主版本内已发布的最新次版本。 */
  minor: number;
  /** `MAJOR.MINOR` 形式的当前版本;新文档应当声明这个值。 */
  current: string;
  /** 能力 → 引入它的次版本。 */
  capabilities: Readonly<Record<PageCapability, number>>;
}

export const versionPolicy: VersionPolicy = {
  major: PAGE_SCHEMA_MAJOR,
  minor: CURRENT_MINOR,
  current: `${PAGE_SCHEMA_MAJOR}.${CURRENT_MINOR}`,
  capabilities: Object.fromEntries(
    Object.entries(pageCapabilities).map(([id, definition]) => [id, definition.minor])
  ) as Record<PageCapability, number>
};

/**
 * 6.x 接受 6.5 兼容版本及当前版本；5.0–5.4 保留为只读输入例外。
 * 能力引入历史仍可查询，但不代表旧 6.x 文档可读。
 */
export function supportedVersions(policy: VersionPolicy = versionPolicy): string[] {
  const currentMajor = policy.major === PAGE_SCHEMA_MAJOR && policy.minor >= 6 ? ['6.5', policy.current] : [policy.current];
  return policy.major === PAGE_SCHEMA_MAJOR
    ? [...LEGACY_READABLE_PAGE_SCHEMA_VERSIONS, ...currentMajor]
    : currentMajor;
}

export function versionErrors(
  document: unknown,
  policy: VersionPolicy = versionPolicy
): TypedError[] {
  const version = schemaVersionOf(document);
  if (version === undefined) return [];
  const parsed = parseVersion(version);
  if (parsed !== undefined && (
    version === policy.current || (policy.major === PAGE_SCHEMA_MAJOR && policy.minor >= 6 && version === '6.5') ||
    (policy.major === PAGE_SCHEMA_MAJOR && LEGACY_READABLE_PAGE_SCHEMA_VERSIONS.includes(
      version as (typeof LEGACY_READABLE_PAGE_SCHEMA_VERSIONS)[number]
    ))
  )) {
    return [];
  }
  return [
    {
      type: 'SCHEMA_ERROR',
      path: '/schemaVersion',
      message:
        parsed?.major === policy.major && parsed.minor > policy.minor
          ? `文档格式版本 ${version} 高于运行时当前次版本 ${policy.current}`
          : `不支持的文档格式版本 ${version}:` +
            `运行时只接受 ${supportedVersions(policy).join(' / ')}，` +
            '兼容读取 5.0–5.4，其他跨主版本文档不提供自动迁移'
    }
  ];
}

/** 文档实际结构所需的最低次版本;0 表示只用到该主版本首个次版本的能力。 */
export function requiredMinorVersion(document: unknown): number {
  let required = 0;
  for (const definition of Object.values(pageCapabilities)) {
    if (definition.usedAt(document).length > 0) {
      required = Math.max(required, definition.minor);
    }
  }
  return required;
}

/**
 * 能力下限判定:文档使用了高于其声明次版本的能力即报错。
 * 声明版本本身的合法性由 `versionErrors` 负责,这里只在版本可解析且
 * 主版本一致时给出定位到具体使用点的错误。
 */
export function capabilityFloorErrors(
  document: unknown,
  policy: VersionPolicy = versionPolicy
): TypedError[] {
  const version = schemaVersionOf(document);
  const declared = version === undefined ? undefined : parseVersion(version);
  if (declared === undefined || declared.major !== policy.major) return [];
  const errors: TypedError[] = [];
  for (const definition of Object.values(pageCapabilities)) {
    if (definition.minor <= declared.minor) continue;
    for (const path of definition.usedAt(document)) {
      errors.push({
        type: 'SCHEMA_ERROR',
        path,
        message:
          `${definition.description} 由 ${policy.major}.${definition.minor} 引入，` +
          `文档声明的是 ${version}`
      });
    }
  }
  return errors;
}

function schemaVersionOf(document: unknown): string | undefined {
  const version = (document as { schemaVersion?: unknown } | null)?.schemaVersion;
  return typeof version === 'string' ? version : undefined;
}

function parseVersion(value: string): { major: number; minor: number } | undefined {
  const match = /^(\d+)\.(\d+)$/.exec(value);
  if (!match) return undefined;
  return { major: Number(match[1]), minor: Number(match[2]) };
}

type Json = Record<string, unknown>;

function record(value: unknown): Json | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Json)
    : undefined;
}

function containsInlineParam(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsInlineParam);
  const item = record(value);
  if (!item) return false;
  if (typeof item.param === 'string' && Object.keys(item).every(key => ['param', 'part', 'window'].includes(key))) return true;
  return Object.values(item).some(containsInlineParam);
}

function has(value: Json | undefined, key: string): boolean {
  return value !== undefined && value[key] !== undefined;
}

function nonEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

function props(component: Json): Json | undefined {
  return record(component.props);
}

function dataSourcePaths(
  document: unknown,
  matches: (dataSource: Json) => boolean
): string[] {
  const dataSources = record(record(document)?.dataSources) ?? {};
  return Object.entries(dataSources).flatMap(([sourceId, candidate]) => {
    const dataSource = record(candidate);
    return dataSource && matches(dataSource)
      ? [`/dataSources/${escapePointer(sourceId)}`]
      : [];
  });
}

/**
 * `collapsible` 在扁平字段与按角色分组的局部显式字段下位置不同,
 * 因此在 `fields` 子树内按结构递归查找,而不是假定某一种形状。
 */
function collapsibleFieldPaths(document: unknown): string[] {
  const dataSources = record(record(document)?.dataSources) ?? {};
  return Object.entries(dataSources).flatMap(([sourceId, candidate]) => {
    const fields = record(record(candidate)?.fields);
    if (!fields) return [];
    const paths: string[] = [];
    visit(fields, `/dataSources/${escapePointer(sourceId)}/fields`);
    return paths;

    function visit(node: Json, path: string): void {
      if (has(node, 'collapsible')) {
        paths.push(`${path}/collapsible`);
        return;
      }
      for (const [key, child] of Object.entries(node)) {
        const nested = record(child);
        if (nested) visit(nested, `${path}/${escapePointer(key)}`);
      }
    }
  });
}

function ratioScalePaths(document: unknown): string[] {
  const dataSources = record(record(document)?.dataSources) ?? {};
  return Object.entries(dataSources).flatMap(([sourceId, candidate]) => {
    const compute = record(candidate)?.compute;
    if (!Array.isArray(compute)) return [];
    return compute.flatMap((operatorCandidate, index) => {
      const operator = record(operatorCandidate);
      return operator?.op === 'ratio' && has(operator, 'scale')
        ? [`/dataSources/${escapePointer(sourceId)}/compute/${index}/scale`]
        : [];
    });
  });
}

function filterPaths(document: unknown, matches: (filter: Json) => boolean): string[] {
  const filters = record(document)?.filters;
  if (!Array.isArray(filters)) return [];
  return filters.flatMap((candidate, index) => {
    const filter = record(candidate);
    return filter && matches(filter) ? [`/filters/${index}`] : [];
  });
}

function isRelativeDefault(value: unknown): boolean {
  const candidate = record(value);
  return candidate !== undefined && typeof candidate.unit === 'string';
}

function componentLayerPaths(document: unknown): string[] {
  const paths: string[] = [];
  walkDocumentComponents(document, (component, path) => {
    if (has(record(component.layout), 'layer')) paths.push(`${path}/layout/layer`);
  });
  return paths;
}

function sectionColumnTrackPaths(document: unknown): string[] {
  const sections = record(document)?.sections;
  if (!Array.isArray(sections)) return [];
  return sections.flatMap((candidate, index) =>
    has(record(candidate), 'columnTracks')
      ? [`/sections/${index}/columnTracks`]
      : []
  );
}

function keyValueItemUnitPaths(document: unknown): string[] {
  const paths: string[] = [];
  walkDocumentComponents(document, (component, path) => {
    if (component.type !== 'keyValuePanel') return;
    const items = record(component.props)?.items;
    if (!Array.isArray(items)) return;
    items.forEach((candidate, index) => {
      if (has(record(candidate), 'unit')) paths.push(`${path}/props/items/${index}/unit`);
    });
  });
  return paths;
}

function widgetSymbolIconPaths(document: unknown): string[] {
  const paths: string[] = [];
  walkDocumentComponents(document, (component, path) => {
    const componentProps = record(component.props);
    if (
      (component.type === 'compositeCard' || component.type === 'keyValuePanel') &&
      has(componentProps, 'titleIcon')
    ) {
      paths.push(`${path}/props/titleIcon`);
    }
    if (component.type !== 'keyValuePanel') return;
    const items = componentProps?.items;
    if (!Array.isArray(items)) return;
    items.forEach((candidate, index) => {
      if (has(record(candidate), 'icon')) paths.push(`${path}/props/items/${index}/icon`);
    });
  });
  return paths;
}

function metricRowContextPaths(document: unknown): string[] {
  const paths: string[] = [];
  walkDocumentComponents(document, (component, path) => {
    if (component.type !== 'metricCard') return;
    for (const rowsKey of ['rows', 'secondaryRows'] as const) {
      const rows = record(component.props)?.[rowsKey];
      if (!Array.isArray(rows)) continue;
      rows.forEach((candidate, index) => {
        if (has(record(candidate), 'context')) {
          paths.push(`${path}/props/${rowsKey}/${index}/context`);
        }
      });
    }
  });
  return paths;
}

function metricRowLinkPaths(document: unknown): string[] {
  const paths: string[] = [];
  walkDocumentComponents(document, (component, path) => {
    if (component.type !== 'metricCard') return;
    for (const rowsKey of ['rows', 'secondaryRows'] as const) {
      const rows = record(component.props)?.[rowsKey];
      if (!Array.isArray(rows)) continue;
      rows.forEach((candidate, index) => {
        if (has(record(candidate), 'link')) {
          paths.push(`${path}/props/${rowsKey}/${index}/link`);
        }
      });
    }
  });
  return paths;
}

function tabMultiTablePaths(document: unknown): string[] {
  const paths: string[] = [];
  walkDocumentComponents(document, (component, path) => {
    if (component.type !== 'tabContainer') return;
    const tabs = record(component.props)?.tabs;
    if (!Array.isArray(tabs)) return;
    tabs.forEach((candidate, index) => {
      if (Array.isArray(record(candidate)?.components)) {
        paths.push(`${path}/props/tabs/${index}/components`);
      }
    });
  });
  return paths;
}

function tableColumnLinkPaths(document: unknown): string[] {
  const paths: string[] = [];
  walkDocumentComponents(document, (component, path) => {
    if (component.type !== 'table') return;
    visitColumns(record(component.props)?.columns, `${path}/props/columns`, paths);
  });
  return paths;
}

function visitColumns(columns: unknown, path: string, paths: string[]): void {
  if (!Array.isArray(columns)) return;
  columns.forEach((candidate, index) => {
    const column = record(candidate);
    if (!column) return;
    const columnPath = `${path}/${index}`;
    if (column.link !== undefined) paths.push(`${columnPath}/link`);
    visitColumns(column.children, `${columnPath}/children`, paths);
  });
}

function componentPaths(
  document: unknown,
  matches: (component: Json) => boolean
): string[] {
  const paths: string[] = [];
  walkDocumentComponents(document, (component, path) => {
    if (matches(component)) paths.push(path);
  });
  return paths;
}

function escapePointer(segment: string): string {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1');
}

/** 只检查格式声明；原始数据行中的同名键不声明展示能力。 */
function millionFormatPaths(document: unknown): string[] {
  const paths: string[] = [];
  function visit(value: unknown, path: string, key: string): void {
    if (Array.isArray(value)) {
      value.forEach((child, index) => visit(child, `${path}/${index}`, key));
      return;
    }
    const node = record(value);
    if (!node) return;
    for (const [name, child] of Object.entries(node)) {
      const childPath = `${path}/${escapePointer(name)}`;
      if (name === key && typeof child === 'string' && /^compact-million-[012]$/.test(child)) paths.push(childPath);
      else visit(child, childPath, key);
    }
  }
  for (const [id, source] of Object.entries(record(record(document)?.dataSources) ?? {})) {
    visit(record(source)?.fields, `/dataSources/${escapePointer(id)}/fields`, 'defaultFormat');
  }
  walkDocumentComponents(document, (component, path) => visit(component.props, `${path}/props`, 'format'));
  for (const { path, reference } of collectTextValueReferences(document)) {
    if (reference.format?.startsWith('compact-million-')) paths.push(`${path}/format`);
  }
  return [...new Set(paths)];
}
