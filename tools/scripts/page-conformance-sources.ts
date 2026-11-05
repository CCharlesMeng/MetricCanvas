import {upgradePageDocument} from '../../packages/page/src/upgrade-document';

export const featureConformancePages=['chart-series-visibility','yoy-p-format-demo','table-header-filter-param-source','authoring-analysis-rebind','relay-multislot-presentation','authoring-percent-coverage','authoring-evaluation-context','table-header-filter-defaults','table-header-filter-defaults-query','ioc-header-section-placement','ioc-header-section-groups','ioc-header-section-sticky','table-column-enums','record-join-query-params','ioc-region-url-demo','key-office-filter-demo','key-office-filter-target','key-office-priority-demo','key-office-priority-target','chart-constant-values-page','page-visibility-region-linkage','page-visibility-inputs','page-visibility-report','report-ai-summary','report-ai-summary-regions','dashboard-title-styles','report-title-styles','query-missing-measures','chart-global-benchmark'] as const;

export function appendIocComponentFixtures(fixtures:Map<string,unknown>,outputs:Map<string,string>):void {
  // Exercise every existing IOC property through the new envelope as well as legacy input.
  for(const [name,document] of [...fixtures]) {
    if(!(document as {iocHeader?:unknown}).iocHeader)continue;
    const upgraded=upgradePageDocument(document);
    if(!upgraded.ok)throw Error(JSON.stringify(upgraded.errors));
    const key=`ioc-component-${name}`;
    fixtures.set(key,upgraded.document);
    outputs.set(`page/conformance/valid/${key}.json`,JSON.stringify(upgraded.document,null,2)+'\n');
  }
 }
