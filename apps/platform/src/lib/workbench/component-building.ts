import { componentCatalogEntry, type QueryFieldDefinition, type DqeQueryDefinition, type DataRow } from '@metriccanvas/page/internal';
import { recommendComponents, type ComponentCandidate, type ResultShape } from './component-selection';

/** 工作台局部构造输入，不携带整页装配、口径分组或服务端编排。 */
export interface ComponentInput {
  dataSourceId: string;
  title?: string;
  fields: Record<string, QueryFieldDefinition>;
  query: DqeQueryDefinition;
  initial?: { capturedAt: string; rows: DataRow[]; totalCount?: number };
  pinnedComponent?: ComponentCandidate['type'];
}
interface LocalComponent {
  id: string;
  type: ComponentCandidate['type'];
  layout: { span: number };
  data: { main: string };
  props: Record<string, unknown>;
}

export function resultShapeOfUnit(
  unit: Pick<ComponentInput, 'fields' | 'initial'>
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

/** 只构造一个通过目录准入的组件；调用方保留现有布局并整体校验页面。 */
export function constructComponent(unit: ComponentInput, type: ComponentCandidate['type']):
  | { ok: true; component: LocalComponent }
  | { ok: false; message: string } {
  const candidate = recommendComponents(resultShapeOfUnit(unit), { pinned: type })
    .find((item) => item.type === type);
  if (!candidate?.ok) return { ok: false, message: candidate?.reasons.join(';') ?? '未知组件类型' };
  return { ok: true, component: buildComponent(unit, candidate) };
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
 * 支持面与 component-selection 的准入集合保持一致；可选语义
 * （变化值、徽标、说明等）一律不自动绑定，避免猜测字段语义。
 */
function buildComponent(
  unit: ComponentInput,
  candidate: ComponentCandidate
): LocalComponent {
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
    case 'gauge':
      return { ...base, props: { ...title, valueField: measures[0]?.fieldId } };
    case 'keyValuePanel':
      return { ...base, props: { ...title, items: scalars.map((field) => ({
        label: labelOf(field), field: field.fieldId
      })) } };
    case 'categoryBreakdown':
      return { ...base, props: { ...title, categoryField: dimensions[0]?.fieldId,
        columns: measures.map((field) => ({ label: labelOf(field), field: field.fieldId })) } };
    default:
      // 准入与构造支持集合必须同步，不能向用户暴露未实现的构造。
      throw new Error(`装配不支持的组件类型：${candidate.type}`);
  }
}

function kebabCase(value: string): string {
  return value.replaceAll(/[A-Z]/gu, (char) => `-${char.toLowerCase()}`);
}
