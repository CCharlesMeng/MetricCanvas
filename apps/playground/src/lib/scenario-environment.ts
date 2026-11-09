import {createObjectPeriodPreview} from '../../fixtures/object-period-query';
import {createIocHeaderControlsPreview} from '../../fixtures/ioc-header-controls';
import {createFilterBindingWhenPreview} from '../../fixtures/filter-binding-when';
import {createPeriodAggregationPreview} from '../../fixtures/period-aggregation';
import {createSourceCandidatesPreview} from '../../fixtures/source-candidates';
import {createRegionURLGateway} from '../../fixtures/region-url';
import {createGlobalBenchmarkPreview} from '../../fixtures/global-benchmark';
import {createRowCachePreview} from '../../fixtures/row-expansion-cache';
import {createPeriodComparisonPreview} from '../../fixtures/period-comparison';
import {createQueryComparisonPreview} from '../../fixtures/query-comparison-gateway';
import {createPagedJoinPreview} from '../../fixtures/query-join-gateway';
import { createFullQueryCandidatesPreview } from '../../fixtures/full-query-candidates';
import {withIocRegionCandidates} from './ioc-region-preview';
import {createKeyOfficeGateway,createKeyOfficePriorityGateway} from '../../fixtures/key-office-filter/gateway';
import {createZeroTotalPreview} from '../../fixtures/zero-total-gateway';
import {createPartnerHealthUnionPreview} from '../../fixtures/organization-union/gateway';
import {createTableRecoveryPreview} from '../../fixtures/table-recovery';
import {createHierarchyGateway} from '../../fixtures/hierarchy-gateway';
import {createRejectionPreview} from '../../fixtures/rejection-details/gateway';
import { createUnionPreview } from '../../fixtures/decision-opinion/union-gateway';
import { createIocHeaderPreview } from './ioc-header-preview-inputs';
import { createIocBusinessPreview } from './ioc-business-preview';
import { createVisibilityDemoInputs } from './visibility-inputs';
import { pageExternalInputs,rejectionPreviewRowCount,rejectionPreviewDelay } from '../../fixtures/preview-inputs';
import { iocSelectionGateway } from '../../fixtures/selection-gateway';
import { createDecisionOpinionPreview } from '../../fixtures/decision-opinion/preview';
import { dataGateway } from './services';

/** Called only with an example ID resolved from the trusted scenario index, never from edited JSON. */
export function scenarioEnvironment(exampleId: string, state = 'ready') {
  const kind = pageExternalInputs(exampleId);
  const table=tablePreview(kind,state);
  if(table)return table;
  if (kind === 'organization-union') return createPartnerHealthUnionPreview(state);
  if (kind === 'table-recovery') return createTableRecoveryPreview(state);
  if (kind === 'ioc-region'||kind==='ioc-region-dept') return {dataGateway:withIocRegionCandidates(dataGateway,kind==='ioc-region')};
  if (kind === 'zero-total') return createZeroTotalPreview();
  if(kind==='hierarchy')return {dataGateway:createHierarchyGateway()};
  if (kind === 'record-join') return createRejectionPreview({rows:rejectionPreviewRowCount(exampleId,'catalog'),delayMs:rejectionPreviewDelay(exampleId)});
  if (kind === 'ioc-header') return createIocHeaderPreview();
  if (kind === 'ioc-business') return createIocBusinessPreview(exampleId, state, 'catalog-preview');
  if (kind === 'selection') return { dataGateway: iocSelectionGateway };
  if (kind === 'paged-union') return createUnionPreview();
  if (kind === 'decision-opinion') return createDecisionOpinionPreview({});
  if (kind === 'visibility') {
    const visibility = createVisibilityDemoInputs();
    return { dataGateway, displayInputs: visibility.source, setFact: visibility.publish };
  }
  return { dataGateway };
}

function tablePreview(kind:string|undefined,state:string){
  if(kind==='object-period')return createObjectPeriodPreview(state);
  if(kind==='binding-when')return createFilterBindingWhenPreview(state);
  if(kind==='period-aggregation')return createPeriodAggregationPreview(state);
  if(kind==='header-controls')return createIocHeaderControlsPreview();
  if(kind==='source-candidates')return createSourceCandidatesPreview(state);
  if(kind==='global-benchmark')return createGlobalBenchmarkPreview(state);
  if (kind === 'key-office') return {dataGateway:createKeyOfficeGateway()};
  if (kind === 'key-office-priority') return {dataGateway:createKeyOfficePriorityGateway()};
  if(kind==='region-url')return {dataGateway:createRegionURLGateway()};
  if(kind==='row-cache')return createRowCachePreview();

  if(kind==='query-comparison')return createQueryComparisonPreview(state);
  if(kind==='period-comparison')return createPeriodComparisonPreview(state);
  if(kind==='query-join')return createPagedJoinPreview();
  if(kind==='full-query-candidates')return createFullQueryCandidatesPreview(state);
  return undefined;
}
