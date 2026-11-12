import { visibilityShape } from '../condition';
import { z } from 'zod';
import { componentIdZ, componentLayoutZ, idZ, nonEmptyTextValueZ, textValueZ } from '../primitives';
import { componentCatalogRegistry } from '../registry';
import { filterGroupComponentZ } from './filter-group';
import { buttonComponentZ } from './button';
import { tableComponentZ } from './table';
import { metricCardComponentZ } from './metric-card';
import { barChartComponentZ, lineChartComponentZ, pieChartComponentZ } from './charts';
import { mapChartComponentZ } from './map-chart';
import { gaugeComponentZ } from './gauge';
import { compositeCardComponentZ } from './composite-card';
import { categoryBreakdownComponentZ } from './category-breakdown';
import { rankingCardComponentZ } from './ranking-card';
import { rankingDetailCardComponentZ } from './ranking-detail-card';
import { keyValuePanelComponentZ } from './key-value-panel';
import { textComponentZ } from './text';
import { fieldTextComponentZ } from './field-text';
import { aiSummaryComponentZ } from './ai-summary';

// 有界内容联合：不引用顶层 componentZ，避免递归和两套类型名单。
const tabContentSchemas: readonly [
  typeof filterGroupComponentZ, typeof buttonComponentZ, typeof tableComponentZ, typeof metricCardComponentZ,
  typeof barChartComponentZ, typeof lineChartComponentZ, typeof pieChartComponentZ, typeof mapChartComponentZ,
  typeof gaugeComponentZ, typeof compositeCardComponentZ, typeof categoryBreakdownComponentZ,
  typeof rankingCardComponentZ, typeof rankingDetailCardComponentZ, typeof keyValuePanelComponentZ,
  typeof textComponentZ, typeof fieldTextComponentZ, typeof aiSummaryComponentZ
] = [
  filterGroupComponentZ, buttonComponentZ, tableComponentZ, metricCardComponentZ, barChartComponentZ, lineChartComponentZ,
  pieChartComponentZ, mapChartComponentZ, gaugeComponentZ, compositeCardComponentZ,
  categoryBreakdownComponentZ, rankingCardComponentZ, rankingDetailCardComponentZ,
  keyValuePanelComponentZ, textComponentZ, fieldTextComponentZ, aiSummaryComponentZ
];
// Preserve schema references in declarations instead of serializing the entire nested component union.
export const tabContentZ: z.ZodDiscriminatedUnion<typeof tabContentSchemas, 'type'> = z.discriminatedUnion('type', tabContentSchemas).meta({ id: 'tabContent' });

const tabItemBaseShape = {id: idZ, ...visibilityShape, label: nonEmptyTextValueZ};
const singleTabItemShape: typeof tabItemBaseShape & {component: typeof tabContentZ} = {
  ...tabItemBaseShape, component: tabContentZ
};
const multipleTabItemShape: typeof tabItemBaseShape & {components: z.ZodArray<typeof tabContentZ>} = {
  ...tabItemBaseShape, components: z.array(tabContentZ).min(1)
};
const singleTabItemZ: z.ZodObject<typeof singleTabItemShape, z.core.$strict> = z.object(singleTabItemShape).strict();
const multipleTabItemZ: z.ZodObject<typeof multipleTabItemShape, z.core.$strict> = z.object(multipleTabItemShape).strict();
const tabItemSchemas: readonly [typeof singleTabItemZ, typeof multipleTabItemZ] = [singleTabItemZ, multipleTabItemZ];
const tabItemZ: z.ZodUnion<typeof tabItemSchemas> = z.union(tabItemSchemas).meta({ id: 'tabItem' });

/**
 * Tab 容器:卡内切换,每个 Tab 接受普通内容或组合卡，兼容旧单表与表格列表。
 * 显式 grid 复用 12 列栅格；缺省纵向全宽。
 */
const tabContainerOptionalPropsShape = {
  title: textValueZ.optional(),
  contentLayout: z.literal('grid').optional(),
  variant: z.enum(['compact', 'analysisStack']).optional(),
  defaultTab: idZ.optional(),
  initialTabUrlParam: z.string().min(1).optional()
};
const tabContainerPropsShape: typeof tabContainerOptionalPropsShape & {tabs: z.ZodArray<typeof tabItemZ>} = {
  ...tabContainerOptionalPropsShape, tabs: z.array(tabItemZ).min(1)
};
const tabContainerPropsZ: z.ZodObject<typeof tabContainerPropsShape, z.core.$strict> = z.object(tabContainerPropsShape).strict();
const tabContainerShape = {
  id: componentIdZ, ...visibilityShape, type: z.literal('tabContainer'), layout: componentLayoutZ,
  props: tabContainerPropsZ
};
export const tabContainerComponentZ: z.ZodObject<typeof tabContainerShape, z.core.$strict> = z.object(tabContainerShape).strict().meta({ id: 'tabContainerComponent' });

componentCatalogRegistry.add(tabContainerComponentZ, {
  label: 'Tab 容器',
  aliases: ['页签', '选项卡'],
  purpose: '在同一区域切换普通内容与组合卡',
  chooseWhen: ['多个分析视角需要共用同一区域，可混合指标卡、图表、文本、表格、组合卡和AI总结'],
  dataShape: '不绑定页面数据源；每个子组件自己声明数据槽',
  authoringShape: { bindsData: false },
  title: 'optional',
  defaultSpan: 4
});
