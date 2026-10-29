import {createZeroTotalPreview} from '../../fixtures/zero-total-gateway';
import {createPartnerHealthUnionPreview} from '../../fixtures/organization-union/gateway';
import {createHierarchyGateway} from '../../fixtures/hierarchy-gateway';
import {createRejectionPreview} from '../../fixtures/rejection-details/gateway';
import { createUnionPreview } from '../../fixtures/decision-opinion/union-gateway';
import { createIocHeaderPreview } from './ioc-header-preview-inputs';
import { createIocBusinessPreview } from './ioc-business-preview';
import { createVisibilityDemoInputs } from './visibility-inputs';
import { pageExternalInputs } from '../../fixtures/preview-inputs';
import { iocSelectionGateway } from '../../fixtures/selection-gateway';
import { createDecisionOpinionPreview } from '../../fixtures/decision-opinion/preview';
import { dataGateway } from './services';

/** Called only with an example ID resolved from the trusted scenario index, never from edited JSON. */
export function scenarioEnvironment(exampleId: string, state = 'ready') {
  const kind = pageExternalInputs(exampleId);
  if (kind === 'organization-union') return createPartnerHealthUnionPreview(state);
  if (kind === 'zero-total') return createZeroTotalPreview();
  if(kind==='hierarchy')return {dataGateway:createHierarchyGateway()};
  if (kind === 'record-join') return createRejectionPreview();
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
