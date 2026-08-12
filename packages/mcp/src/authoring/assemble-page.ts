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

/**
 * 临时页面态装配（创作期）：由若干经真实执行的取数单元与组件选择产出
 * 一份 Schema 5.0 页面文档。出口必须通过 @metriccanvas/page 的 validate()；
 * 分区外观只用分区容器表达；除查询定义自带的筛选绑定外不产生任何隐式
 * 引用。纯函数：不依赖浏览器、不依赖统一运行时、不做 IO。
 */

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
}

export interface AssembleTransientPageInput {
  /** 临时页面 id：不进入页面仓储、不产生页面修订（ADR-0030） */
  pageId: string;
  /** 页面说明，写入 meta.description */
  description?: string;
  units: ExecutedDataRequestUnit[];
  /** 内容分区标题 */
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
    components: TransientPageComponent[];
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
    sections: [
      {
        id: 'main',
        ...(input.sectionTitle === undefined ? {} : { title: input.sectionTitle }),
        ...(input.container === undefined ? {} : { container: input.container }),
        components
      }
    ]
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
 * 默认宽度取组件能力目录的 defaultSpan，可见标题统一走 props.title。
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
