import { componentCatalog } from '@metriccanvas/page';

/**
 * 临时页面态(ADR-0030)在工作台的呈现模型(#65)。
 *
 * 临时页面 id 命名规范:`ask-transient-` + 8 位十六进制,与 /ask 路由
 * (轨道 F)一致。它满足页面 id 校验(^[a-z0-9][a-z0-9-]*$),但不进入
 * 页面目录、不承载修订归属——工作台据此识别临时页面态:展示徽标并关闭
 * 保存修订入口(修订归属只属于正式页面 id,沉淀时才分配)。
 *
 * 渲染不变量(ADR-0021):统一运行时不按页面 id 选择样式、组件或交互。
 * 本模块产出的视图模型只服务工作台外壳(徽标、组件形态钉住条、修订归属
 * 闸门),交给 RuntimeView 的始终是未经修改的页面文档本身,不存在按 id
 * 分叉的渲染逻辑;临时态与资产态的渲染结果一致由测试对照自证。
 */

/** 临时页面 id 命名规范:`ask-transient-` 前缀 + 8 位十六进制。 */
export const TRANSIENT_PAGE_ID_PATTERN = /^ask-transient-[0-9a-f]{8}$/u;

export function isTransientPageId(pageId: string): boolean {
  return TRANSIENT_PAGE_ID_PATTERN.test(pageId);
}

/** 页面文档里一个组件的工作台视图:钉住条与组件清单用。 */
export interface PageComponentView {
  componentId: string;
  componentType: string;
  /** 组件能力目录里的中文名;目录外类型回退为类型名本身。 */
  componentLabel: string;
  /** 组件数据槽 main 引用的页面数据源;不消费数据的组件为 null。 */
  dataSourceId: string | null;
  title: string | null;
}

export interface WorkbenchPageViewModel {
  pageId: string;
  /** 是否临时页面态(仅决定工作台徽标与修订归属闸门,不影响渲染输入)。 */
  transient: boolean;
  description: string | null;
  dataSourceCount: number;
  components: PageComponentView[];
  /**
   * 页面文档里的临时口径 formula 表达式(#67,ADR-0036):从查询定义的
   * output_metrics 直接检出,文档本身是唯一真源。非空时工作台在结果区
   * 呈现「临时口径」徽标,与已定义指标视觉可区分。
   */
  adHocFormulas: string[];
}

/**
 * 由页面文档派生工作台视图模型。文档已通过页面校验(validate_page /
 * 装配出口),这里的窄化只为类型安全,不做第二次校验。
 */
export function workbenchPageViewModel(
  document: Record<string, unknown>
): WorkbenchPageViewModel {
  const pageId = typeof document.id === 'string' ? document.id : '';
  const meta = isRecord(document.meta) ? document.meta : {};
  const dataSources = isRecord(document.dataSources) ? document.dataSources : {};
  const sections = Array.isArray(document.sections) ? document.sections : [];

  const components: PageComponentView[] = sections.flatMap((section) => {
    if (!isRecord(section) || !Array.isArray(section.components)) return [];
    return section.components.flatMap((component) => {
      if (
        !isRecord(component) ||
        typeof component.id !== 'string' ||
        typeof component.type !== 'string'
      ) {
        return [];
      }
      const data = isRecord(component.data) ? component.data : {};
      const props = isRecord(component.props) ? component.props : {};
      return [
        {
          componentId: component.id,
          componentType: component.type,
          componentLabel: catalogLabel(component.type),
          dataSourceId: typeof data.main === 'string' ? data.main : null,
          title: typeof props.title === 'string' ? props.title : null
        }
      ];
    });
  });

  return {
    pageId,
    transient: isTransientPageId(pageId),
    description:
      typeof meta.description === 'string' ? meta.description : null,
    dataSourceCount: Object.keys(dataSources).length,
    components,
    adHocFormulas: adHocFormulasOf(dataSources)
  };
}

/** 查询定义 output_metrics 里的 formula 项即临时口径(ADR-0032/0036)。 */
function adHocFormulasOf(dataSources: Record<string, unknown>): string[] {
  const formulas: string[] = [];
  for (const dataSource of Object.values(dataSources)) {
    if (!isRecord(dataSource) || !isRecord(dataSource.source)) continue;
    const query = dataSource.source.query;
    if (!isRecord(query) || !isRecord(query.body)) continue;
    const dslList = query.body.dsl_list;
    if (!Array.isArray(dslList)) continue;
    for (const item of dslList) {
      if (!isRecord(item) || !Array.isArray(item.output_metrics)) continue;
      for (const metric of item.output_metrics) {
        if (isRecord(metric) && typeof metric.formula === 'string') {
          formulas.push(metric.formula);
        }
      }
    }
  }
  return formulas;
}

function catalogLabel(componentType: string): string {
  return (
    componentCatalog.find((entry) => entry.type === componentType)?.label ??
    componentType
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
