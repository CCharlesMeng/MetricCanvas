import { z } from 'zod';
import { componentIdZ, componentLayoutZ, idZ, nonEmptyTextValueZ, textValueZ } from '../primitives';
import { componentCatalogRegistry } from '../registry';
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
export const tabContentZ = z.discriminatedUnion('type', [
  tableComponentZ, metricCardComponentZ, barChartComponentZ, lineChartComponentZ,
  pieChartComponentZ, mapChartComponentZ, gaugeComponentZ, compositeCardComponentZ,
  categoryBreakdownComponentZ, rankingCardComponentZ, rankingDetailCardComponentZ,
  keyValuePanelComponentZ, textComponentZ, fieldTextComponentZ, aiSummaryComponentZ
]).meta({ id: 'tabContent' });

const tabItemZ = z
  .union([
    z
      .object({
        id: idZ,
        label: nonEmptyTextValueZ,
        component: tabContentZ
      })
      .strict(),
    z
      .object({
        id: idZ,
        label: nonEmptyTextValueZ,
        components: z.array(tabContentZ).min(1)
      })
      .strict()
  ])
  .meta({ id: 'tabItem' });

/**
 * Tab 容器:卡内切换,每个 Tab 接受普通内容或组合卡，兼容旧单表与表格列表。
 * 显式 grid 复用 12 列栅格；缺省纵向全宽。
 */
export const tabContainerComponentZ = z
  .object({
    id: componentIdZ,
    type: z.literal('tabContainer'),
    layout: componentLayoutZ,
    props: z
      .object({
        title: textValueZ.optional(),
        contentLayout: z.literal('grid').optional(),
        variant: z.enum(['compact', 'analysisStack']).optional(),
        defaultTab: idZ.optional(),
        tabs: z.array(tabItemZ).min(1)
      })
      .strict()
  })
  .strict()
  .meta({ id: 'tabContainerComponent' });

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
