import {cpSync} from 'node:fs';
import {join} from 'node:path';

export const consumerFixturePaths = [
  "packages/metric-canvas/tests/browser",
  "packages/embed/tests/browser",
  "packages/embed/examples",
  "packages/embed/tests/serve.mjs",
  "packages/embed/tests/dqe-fixture-endpoint.mjs",
  "tools/dqe-sim/fixtures/ioc-opportunity-list.json",
  "tools/dqe-sim/fixtures/ioc-dimension-values.json",
  "tools/dqe-sim/fixtures/ioc-page-datasets.json",
  "tools/dqe-sim/fixtures/chart-local-filter.json",
  "tools/dqe-sim/fixtures/ioc-header-query.mjs",
  "packages/embed/tests/fixtures",
  "packages/engine/widgets/tests/responsive-fixtures.ts",
  "contracts/metriccanvas/page/reference/examples",
  "packages/page/fixtures/contract-valid/report-png-export.json",
  "packages/page/fixtures/contract-valid/report-export-buttons.json",
  "packages/page/fixtures/contract-valid/report-export-scale-fallback.json",
  "packages/page/fixtures/contract-valid/query-cascade-page.json",
  "packages/page/fixtures/contract-valid/query-result-where-page.json",
  "packages/page/fixtures/contract-valid/table-toolbar-page.json",
  "packages/page/fixtures/contract-valid/time-point-min-page.json",
  "packages/page/fixtures/contract-valid/dashboard-period-filter-month.json",
  "packages/page/fixtures/contract-valid/dashboard-period-filter-more.json",
  "packages/page/fixtures/contract-valid/dashboard-period-filter-readonly.json",
  "packages/data-execution/tests/fixtures/offices.json",
  "packages/page/fixtures/contract-valid/detail-views.json",
  "packages/page/fixtures/contract-valid/url-navigation-page.json",
  "packages/page/fixtures/contract-valid/dimension-params-page.json",
  "packages/page/fixtures/parameter-extraction/tokens-parameter-source.json",
  "pages"
];

/** Copy the complete runnable test host into a consumer with no workspace links. */
export function copyConsumerFixtures(source,consumer){
  for(const path of consumerFixturePaths)cpSync(join(source,path),join(consumer,path),{recursive:true});
}
