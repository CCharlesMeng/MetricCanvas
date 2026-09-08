import {
  componentCatalogEntry,
  validate,
  versionPolicy,
  type DataRow,
  type DqeQueryDefinition,
  type FilterDeclaration,
  type QueryFieldDefinition,
  type SectionContainer,
  type TypedError
} from '@metriccanvas/page';
import {
  recommendComponents,
  type AnalysisIntent,
  type ComponentCandidate,
  type ResultShape
} from './auto-visualize';
import { packSectionSpans } from './section-layout';

/**
 * 临时页面态装配（创作期）：由若干经真实执行的取数单元与组件选择产出
 * 一份 Schema 5.0 页面文档。出口必须通过 @metriccanvas/page 的 validate()；
 * 分区外观只用分区容器表达；除查询定义自带的筛选绑定外不产生任何隐式
 * 引用。纯函数：不依赖浏览器、不依赖统一运行时、不做 IO。
 */

/** 取数核对与口径组共用的维度筛选条件。 */
export interface ScopeDimensionFilter {
  dimension: string;
  values: readonly string[];
}

/**
 * 取数单元的口径（CONTEXT.md：口径组）：决定它与哪些单元可以横向对照。
 * 时间窗口与粒度取取数核对呈现用的同一份文案，装配不再二次解释时间语义。
 */
export interface DataRequestUnitScope {
  businessDomain: string;
  /** 分组维度；口径组按组合而非顺序判等 */
  groupBy: readonly string[];
  timeRange: string;
  granularity: string;
  filters: readonly ScopeDimensionFilter[];
}

/**
 * 经清单校验与真实执行后的取数单元（ADR-0032）：携带派生的查询定义、
 * 结果字段契约与可选的内嵌初始行。一个取数单元对应页面的一个页面数据源。
 */
export interface ExecutedDataRequestUnit {
  /** 页面数据源名：成为页面文档 dataSources 的键 */
  dataSourceId: string;
  /** 业务标题；组件标题支持时写入 props.title */
  title?: string;
  /** 结果字段契约（含查询字段映射），字段类型与语义以契约声明为准 */
  fields: Record<string, QueryFieldDefinition>;
  /** 查询定义：DQE 原始请求体与可选筛选绑定 */
  query: DqeQueryDefinition;
  /** 内嵌初始行：采集时点的 DQE 原始输出行（字段键为 DQE 输出字段名） */
  initial?: {
    capturedAt: string;
    rows: DataRow[];
    totalCount?: number;
  };
  /** 分析意图；只影响允许范围内的组件排序 */
  intent?: AnalysisIntent;
  /** 用户显式钉住的组件；钉住后装配不得改写组件类型 */
  pinnedComponent?: ComponentCandidate['type'];
  /**
   * 口径：一个口径组一个内容分区（ADR-0055）。只有全部单元都声明口径时
   * 才按口径组分区；任一单元缺省即整体退回单分区。
   */
  scope?: DataRequestUnitScope;
}

export interface AssembleTransientPageInput {
  /** 临时页面 id：不进入页面仓储、不产生页面修订（ADR-0030） */
  pageId: string;
  /** 页面说明，写入 meta.description */
  description?: string;
  units: ExecutedDataRequestUnit[];
  /** 内容分区标题；只在页面收敛为单个口径组时使用（多组时标题由各组口径派生） */
  sectionTitle?: string;
  /** 分区容器：分区外观的唯一真源 */
  container?: SectionContainer;
  /** 页面筛选状态声明；查询定义的筛选绑定只得引用这里声明的筛选器 */
  filters?: FilterDeclaration[];
}

/** 装配出的组件声明（文档态）。 */
export interface TransientPageComponent {
  id: string;
  type: ComponentCandidate['type'];
  layout: { span: number };
  data: { main: string };
  props: Record<string, unknown>;
}

/** 页面级页头：不承载任何取数单元，因此没有数据槽。 */
export interface TransientPageHeader {
  id: string;
  type: 'reportHeader';
  layout: { span: number };
  props: { title: string; asOf?: { label: string; value: string } };
}

/**
 * 临时页面态：Schema 5.0 文档态页面，内嵌初始行保持 DQE 原始输出字段名，
 * 由统一运行时直接解析渲染。装配出口已整体通过 validate()。
 */
export interface TransientPageDocument {
  schemaVersion: typeof versionPolicy.current;
  id: string;
  meta?: { description: string };
  dataSources: Record<string, unknown>;
  filters?: FilterDeclaration[];
  sections: Array<{
    id: string;
    title?: string;
    container?: SectionContainer;
    components: Array<TransientPageComponent | TransientPageHeader>;
  }>;
}

export interface AssemblyIssue {
  code:
    | 'DUPLICATE_DATA_SOURCE_NAME'
    | 'COMPONENT_GATE_REJECTED'
    | 'PINNED_COMPONENT_REJECTED'
    | 'PAGE_VALIDATION_FAILED';
  /** 出问题的取数单元的数据源名；页面级问题时缺省 */
  dataSourceId?: string;
  message: string;
  /** validate() 的原始错误，逐条透传 */
  errors?: TypedError[];
}

export type AssembleTransientPageResult =
  | { ok: true; document: TransientPageDocument }
  | { ok: false; issues: AssemblyIssue[] };

/**
 * 装配临时页面态。组件选择依赖 recommendComponents 的输出契约：
 * 钉住组件硬闸通过时原样采用，否则装配失败而不是自动改写；未钉住时
 * 采用推荐首位。产出文档在出口通过 validate()，失败时透传原始错误。
 */
export function assembleTransientPage(
  input: AssembleTransientPageInput
): AssembleTransientPageResult {
  const issues: AssemblyIssue[] = [];

  const seen = new Set<string>();
  for (const unit of input.units) {
    if (seen.has(unit.dataSourceId)) {
      issues.push({
        code: 'DUPLICATE_DATA_SOURCE_NAME',
        dataSourceId: unit.dataSourceId,
        message: `数据源名重复：${unit.dataSourceId}；一个取数单元对应一个页面数据源`
      });
    }
    seen.add(unit.dataSourceId);
  }
  if (issues.length > 0) return { ok: false, issues };

  const dataSources: Record<string, unknown> = {};
  const components: TransientPageComponent[] = [];

  for (const unit of input.units) {
    const selection = selectComponent(unit);
    if ('issue' in selection) {
      issues.push(selection.issue);
      continue;
    }
    dataSources[unit.dataSourceId] = {
      fields: unit.fields,
      source: {
        type: 'query',
        ...(unit.initial === undefined ? {} : { initial: unit.initial }),
        query: unit.query
      }
    };
    components.push(buildComponent(unit, selection.candidate));
  }
  if (issues.length > 0) return { ok: false, issues };

  const document: TransientPageDocument = {
    schemaVersion: versionPolicy.current,
    id: input.pageId,
    ...(input.description === undefined
      ? {}
      : { meta: { description: input.description } }),
    dataSources,
    ...(input.filters === undefined ? {} : { filters: input.filters }),
    sections: sectionsOf(input.units, components, input)
  };

  const errors = validate(document);
  if (errors.length > 0) {
    return {
      ok: false,
      issues: [{
        code: 'PAGE_VALIDATION_FAILED',
        message: '装配产物未通过页面校验',
        errors
      }]
    };
  }
  return { ok: true, document };
}

/** 一个口径组：同组结果可以横向对照，跨组不能（CONTEXT.md：口径组）。 */
export interface ScopeGroupSummary {
  scope: DataRequestUnitScope;
  /** 该组口径的完整文案，供对话轨与时间线复用同一份措辞 */
  label: string;
  /** 组内取数单元的数据源名，按首次出现顺序 */
  dataSourceIds: string[];
}

/**
 * 按口径组归并取数单元（ADR-0055）。分组与文案只在这里定义一次：装配用它
 * 划分内容分区，问数回复用它说明哪几块可以横向对照，两处不得各写一份。
 * 任一单元未声明口径时返回 null——此时页面退回单分区。
 */
export function scopeGroupsOfUnits(
  units: ReadonlyArray<Pick<ExecutedDataRequestUnit, 'dataSourceId' | 'scope'>>
): ScopeGroupSummary[] | null {
  const groups: ScopeGroupSummary[] = [];
  const keys: string[] = [];
  for (const unit of units) {
    if (unit.scope === undefined) return null;
    const key = scopeKeyOf(unit.scope);
    const index = keys.indexOf(key);
    if (index >= 0) {
      groups[index]!.dataSourceIds.push(unit.dataSourceId);
      continue;
    }
    keys.push(key);
    groups.push({
      scope: unit.scope,
      label: scopeLabel(unit.scope),
      dataSourceIds: [unit.dataSourceId]
    });
  }
  return groups;
}

/**
 * 按口径组划分内容分区（ADR-0055），并在页首产出页面级页头。页面收敛为
 * 单个口径组时内容仍是单个分区、标题用调用方给的 sectionTitle，不给口径
 * 一致的页面引入多余结构；任一单元未声明口径时整体退回这条路径。
 */
function sectionsOf(
  units: readonly ExecutedDataRequestUnit[],
  components: readonly TransientPageComponent[],
  input: AssembleTransientPageInput
): TransientPageDocument['sections'] {
  return [...headerSectionsOf(units), ...contentSectionsOf(units, components, input)];
}

function contentSectionsOf(
  units: readonly ExecutedDataRequestUnit[],
  components: readonly TransientPageComponent[],
  input: AssembleTransientPageInput
): TransientPageDocument['sections'] {
  const container = input.container === undefined ? {} : { container: input.container };
  const groups = scopeGroupsOfUnits(units);
  if (groups === null || groups.length === 1) {
    return [
      {
        id: 'main',
        ...(input.sectionTitle === undefined ? {} : { title: input.sectionTitle }),
        ...container,
        components: laidOut(components)
      }
    ];
  }
  const titles = scopeGroupTitles(groups.map((group) => group.scope));
  return groups.map((group, index) => ({
    id: `scope-${index + 1}`,
    title: titles[index]!,
    ...container,
    components: laidOut(
      group.dataSourceIds.flatMap((dataSourceId) =>
        components.filter((component) => component.data.main === dataSourceId)
      )
    )
  }));
}

/**
 * 分区内的宽度装箱。组件构造时写下的 span 只是目录 defaultSpan，在这里被
 * 当作比例基线换算成实际宽度，让每个视觉行占满整行（见 section-layout）。
 */
function laidOut(
  components: readonly TransientPageComponent[]
): TransientPageComponent[] {
  const spans = packSectionSpans(components.map((component) => component.layout.span));
  return components.map((component, index) => ({
    ...component,
    layout: { span: spans[index]! }
  }));
}

/**
 * 页面级页头：这一页覆盖哪个业务域、哪个时间窗口，此前这两件事在页面文档
 * 里一个字都没有——时间窗口被分区标题按「全页共用即为噪声」剔掉，只留在
 * 取数核对与助手回复里。判据与 ADR-0055 让口径差异落进页面文档自己的那条
 * 相同：页面会被沉淀、被分享、在别的宿主里打开，只有写在文档里的事实才
 * 跟着走。
 *
 * 页头内容全部由口径派生，因此任一单元缺口径时不产出页头。**不用问题原文
 * 当标题**：部分可答时问句里含缺口指标（ADR-0036），拿它作页面标题等于让
 * 页面承诺自己没有的数字。
 *
 * 页头不承载任何取数单元，因此不经组件推荐的硬闸——硬闸回答的是「哪个组件
 * 能承载这个单元的结果」，页头不是任何单元的呈现。
 */
function headerSectionsOf(
  units: readonly ExecutedDataRequestUnit[]
): TransientPageDocument['sections'] {
  const scopes: DataRequestUnitScope[] = [];
  for (const unit of units) {
    if (unit.scope === undefined) return [];
    scopes.push(unit.scope);
  }
  if (scopes.length === 0) return [];
  const title = [...new Set(scopes.map((scope) => scope.businessDomain))].join('、');
  const windows = new Set(scopes.map(timeLabel));
  return [
    {
      id: 'header',
      container: 'plain',
      components: [
        {
          id: 'page-header',
          type: 'reportHeader',
          layout: { span: componentCatalogEntry('reportHeader').defaultSpan },
          props: {
            title,
            ...(windows.size === 1
              ? { asOf: { label: '数据窗口', value: [...windows][0]! } }
              : {})
          }
        }
      ]
    }
  ];
}

/** 口径判等：分组维度与筛选按组合判等，声明顺序不同不构成两个口径组。 */
function scopeKeyOf(scope: DataRequestUnitScope): string {
  return JSON.stringify([
    scope.businessDomain,
    [...scope.groupBy].sort(),
    scope.timeRange,
    scope.granularity,
    scope.filters
      .map((filter) => `${filter.dimension}=${[...filter.values].sort().join('|')}`)
      .sort()
  ]);
}

/** 口径的完整文案：业务域 · 分组维度 · 时间窗口（粒度）· 维度筛选。 */
function scopeLabel(scope: DataRequestUnitScope): string {
  const filters = filtersLabel(scope);
  return [
    scope.businessDomain,
    dimensionsLabel(scope.groupBy),
    timeLabel(scope),
    ...(filters === '' ? [] : [filters])
  ].join(' · ');
}

/**
 * 分区标题：分组维度恒定出现，其余口径要素只在各组之间不同时出现。差异
 * 才是标题要说的事——全页共用的时间窗口重复几遍只是噪声，它在取数核对与
 * 助手回复里已经完整可见。任一对口径组至少有一项要素不同，该项因此必然
 * 出现在标题里，标题不会撞车。
 */
function scopeGroupTitles(scopes: readonly DataRequestUnitScope[]): string[] {
  const varies = (project: (scope: DataRequestUnitScope) => string): boolean =>
    new Set(scopes.map(project)).size > 1;
  const showDomain = varies((scope) => scope.businessDomain);
  const showTime = varies((scope) => `${scope.timeRange}|${scope.granularity}`);
  const showFilters = varies(filtersLabel);
  return scopes.map((scope) =>
    [
      ...(showDomain ? [scope.businessDomain] : []),
      dimensionsLabel(scope.groupBy),
      ...(showTime ? [timeLabel(scope)] : []),
      ...(showFilters ? [filtersLabel(scope) || '不限筛选'] : [])
    ].join(' · ')
  );
}

function dimensionsLabel(groupBy: readonly string[]): string {
  return groupBy.length === 0 ? '总量' : `按${groupBy.join('、')}`;
}

/** 粒度标识来自 DQE 的 filter.time.period；表外标识原样不译。 */
const GRANULARITY_LABELS: Record<string, string> = {
  day: '日',
  week: '周',
  month: '月',
  quarter: '季',
  year: '年'
};

function timeLabel(scope: DataRequestUnitScope): string {
  const granularity = GRANULARITY_LABELS[scope.granularity];
  return granularity === undefined ? scope.timeRange : `${scope.timeRange}(${granularity})`;
}

function filtersLabel(scope: DataRequestUnitScope): string {
  return scope.filters
    .map((filter) => `${filter.dimension}=${filter.values.join('、')}`)
    .join('、');
}

/** 由取数单元的结果字段契约与真实执行结果推导结果形状；不读样例值语义。 */
export function resultShapeOfUnit(
  unit: Pick<ExecutedDataRequestUnit, 'fields' | 'initial'>
): ResultShape {
  const scalars = scalarFieldsOf(unit.fields);
  const dimensions = scalars.filter(({ definition }) => definition.role === 'dimension');
  const measures = scalars.filter(({ definition }) => definition.role === 'measure');
  return {
    dimensionCount: dimensions.length,
    measureCount: measures.length,
    hasTimeDimension: dimensions.some(
      ({ definition }) => definition.type === 'date' || definition.type === 'datetime'
    ),
    ...(unit.initial === undefined
      ? {}
      : { rowCount: unit.initial.totalCount ?? unit.initial.rows.length })
  };
}

type SelectedComponent = { candidate: ComponentCandidate } | { issue: AssemblyIssue };

function selectComponent(unit: ExecutedDataRequestUnit): SelectedComponent {
  const candidates = recommendComponents(resultShapeOfUnit(unit), {
    ...(unit.intent === undefined ? {} : { intent: unit.intent }),
    ...(unit.pinnedComponent === undefined ? {} : { pinned: unit.pinnedComponent })
  });

  if (unit.pinnedComponent !== undefined) {
    const pinned = candidates.find((candidate) => candidate.pinned);
    if (pinned === undefined || !pinned.ok) {
      return {
        issue: {
          code: 'PINNED_COMPONENT_REJECTED',
          dataSourceId: unit.dataSourceId,
          message:
            `钉住组件 ${unit.pinnedComponent} 未通过硬闸，装配不得自动改写：` +
            (pinned?.reasons.join('；') ?? '未知组件')
        }
      };
    }
    return { candidate: pinned };
  }

  const recommended = candidates.find((candidate) => candidate.recommended);
  if (recommended === undefined) {
    const reasons = candidates
      .filter((candidate) => !candidate.ok)
      .map((candidate) => `${candidate.type}：${candidate.reasons.join('；')}`);
    return {
      issue: {
        code: 'COMPONENT_GATE_REJECTED',
        dataSourceId: unit.dataSourceId,
        message: `取数单元 ${unit.dataSourceId} 没有通过硬闸的组件候选。${reasons.join('。')}`
      }
    };
  }
  return { candidate: recommended };
}

interface NamedField {
  fieldId: string;
  definition: Extract<QueryFieldDefinition, { role: 'dimension' | 'measure' }>;
}

function scalarFieldsOf(fields: Record<string, QueryFieldDefinition>): NamedField[] {
  return Object.entries(fields).flatMap(([fieldId, definition]) =>
    definition.role === 'detail' ? [] : [{ fieldId, definition }]
  );
}

function labelOf(field: NamedField): string {
  return field.definition.label ?? field.fieldId;
}

/**
 * 按组件选择构造组件声明。字段绑定按结果字段契约的声明顺序确定，
 * 宽度先写下组件能力目录的 defaultSpan 作为比例基线（实际宽度由分区装箱
 * 换算，见 laidOut），可见标题统一走 props.title。
 * 这里只覆盖硬闸机器判读放行的组件类型；判读收紧过的可选语义
 * （变化值、徽标、说明等）一律不自动绑定，避免猜测字段语义。
 */
function buildComponent(
  unit: ExecutedDataRequestUnit,
  candidate: ComponentCandidate
): TransientPageComponent {
  const entry = componentCatalogEntry(candidate.type);
  const scalars = scalarFieldsOf(unit.fields);
  const dimensions = scalars.filter(({ definition }) => definition.role === 'dimension');
  const measures = scalars.filter(({ definition }) => definition.role === 'measure');
  const timeDimension = dimensions.find(
    ({ definition }) => definition.type === 'date' || definition.type === 'datetime'
  );
  const title =
    entry.title === 'unsupported' || unit.title === undefined
      ? {}
      : { title: unit.title };

  const base = {
    id: `${unit.dataSourceId}-${kebabCase(candidate.type)}`,
    type: candidate.type,
    layout: { span: entry.defaultSpan },
    data: { main: unit.dataSourceId }
  };

  switch (candidate.type) {
    case 'metricCard':
      return {
        ...base,
        props: {
          ...title,
          rows: measures.map((measure) => ({
            label: labelOf(measure),
            valueField: measure.fieldId
          }))
        }
      };
    case 'barChart':
      return {
        ...base,
        props: {
          ...title,
          categoryField: dimensions[0]?.fieldId,
          series: measures.map((measure) => ({
            field: measure.fieldId,
            label: labelOf(measure)
          }))
        }
      };
    case 'lineChart':
      return {
        ...base,
        props: {
          ...title,
          xField: (timeDimension ?? dimensions[0])?.fieldId,
          series: measures.map((measure) => ({
            field: measure.fieldId,
            label: labelOf(measure)
          }))
        }
      };
    case 'table':
      return {
        ...base,
        props: {
          ...title,
          columns: scalars.map((field) => ({
            field: field.fieldId,
            title: labelOf(field)
          }))
        }
      };
    case 'pieChart':
      return {
        ...base,
        props: {
          ...title,
          categoryField: dimensions[0]?.fieldId,
          valueField: measures[0]?.fieldId
        }
      };
    case 'rankingCard':
    case 'rankingDetailCard':
      return {
        ...base,
        props: {
          ...title,
          nameField: dimensions[0]?.fieldId,
          valueField: measures[0]?.fieldId
        }
      };
    default:
      // 硬闸机器判读只放行以上类型；出现其他类型说明判读与装配不同步。
      throw new Error(`装配不支持的组件类型：${candidate.type}`);
  }
}

function kebabCase(value: string): string {
  return value.replaceAll(/[A-Z]/gu, (char) => `-${char.toLowerCase()}`);
}
