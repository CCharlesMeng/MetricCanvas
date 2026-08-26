import { z } from 'zod';
import { reportHeaderComponentZ } from './components/report-header';
import { metricCardComponentZ } from './components/metric-card';
import { barChartComponentZ, lineChartComponentZ, pieChartComponentZ } from './components/charts';
import { tableComponentZ } from './components/table';
import { mapChartComponentZ } from './components/map-chart';
import { gaugeComponentZ } from './components/gauge';
import { tabContainerComponentZ } from './components/tab-container';
import { compositeCardComponentZ } from './components/composite-card';
import { categoryBreakdownComponentZ } from './components/category-breakdown';
import { rankingCardComponentZ } from './components/ranking-card';
import { rankingDetailCardComponentZ } from './components/ranking-detail-card';
import { textComponentZ } from './components/text';
import { fieldTextComponentZ } from './components/field-text';
import { keyValuePanelComponentZ } from './components/key-value-panel';
import { aiSummaryComponentZ } from './components/ai-summary';

/**
 * 组件顺序即 `pages/*.json` 中 `section.components` 的候选顺序，
 * 也是 `componentCatalog` 目录的枚举顺序——三者曾经手写三遍，
 * 现在都从这一个判别联合派生。
 */
export const componentSchemas = [
  reportHeaderComponentZ,
  metricCardComponentZ,
  barChartComponentZ,
  lineChartComponentZ,
  pieChartComponentZ,
  tableComponentZ,
  mapChartComponentZ,
  gaugeComponentZ,
  tabContainerComponentZ,
  compositeCardComponentZ,
  rankingCardComponentZ,
  rankingDetailCardComponentZ,
  keyValuePanelComponentZ,
  categoryBreakdownComponentZ,
  fieldTextComponentZ,
  textComponentZ,
  aiSummaryComponentZ
] as const;

export const componentZ = z.discriminatedUnion('type', componentSchemas);

export {
  reportHeaderComponentZ,
  metricCardComponentZ,
  barChartComponentZ,
  lineChartComponentZ,
  pieChartComponentZ,
  tableComponentZ,
  mapChartComponentZ,
  gaugeComponentZ,
  tabContainerComponentZ,
  compositeCardComponentZ,
  rankingCardComponentZ,
  rankingDetailCardComponentZ,
  keyValuePanelComponentZ,
  categoryBreakdownComponentZ,
  fieldTextComponentZ,
  textComponentZ,
  aiSummaryComponentZ
};
export { compositeCardChildTypes, compositeCardChildZ } from './components/composite-card';
export {
  chartSeriesZ,
  barChartSeriesZ,
  barSeriesRoleZ
} from './components/charts';
export {
  tableColumnNodeZ,
  type TableColumn,
  type TableColumnGroup,
  type TableColumnNode,
  type TableCellSelection,
  type TableSelectionWrite
} from './components/table';
