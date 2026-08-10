import { z } from 'zod';
import { reportHeaderComponentZ } from './components/report-header';
import { metricCardComponentZ } from './components/metric-card';
import { barChartComponentZ, lineChartComponentZ, pieChartComponentZ } from './components/charts';
import { tableComponentZ } from './components/table';
import { mapChartComponentZ } from './components/map-chart';
import { rankingCardComponentZ } from './components/ranking-card';
import { rankingDetailCardComponentZ } from './components/ranking-detail-card';
import { textComponentZ } from './components/text';
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
  rankingCardComponentZ,
  rankingDetailCardComponentZ,
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
  rankingCardComponentZ,
  rankingDetailCardComponentZ,
  textComponentZ,
  aiSummaryComponentZ
};
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
