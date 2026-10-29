import type { DataGateway } from '../../../packages/data-execution/src/ports';
import { createUnionPreview } from './decision-opinion/union-gateway';
import { createRejectionPreview } from './rejection-details/gateway';

/** Only synthetic fixtures: switch to ready to demonstrate recovery after data preparation. */
export function createTableRecoveryPreview(state = 'mixed') {
  const healthy = state === 'ready';
  const union = createUnionPreview({ generatedCount: 0, rowFailure: healthy ? undefined : 'duplicate' });
  const records = createRejectionPreview({ rows: 8, duplicateBasic: !healthy });
  const dataGateway: DataGateway = { async fetchData(query, diagnostics, signal) {
    const isUnion = Object.keys(query.fieldMappings).some(field => field.startsWith('contract-') || field.startsWith('commercial-'));
    const result = await (isUnion ? union.dataGateway : records.dataGateway).fetchData(query, diagnostics, signal);
    if (!healthy && 'contract-localRowId' in query.fieldMappings && result.rows.length > 1) {
      delete result.rows[0]['contract-approver'];
      result.rows[0]['contract-office'] = { invalid: true } as never;
      result.rows[1] = null as never;
    }
    return result;
  } };
  return { dataGateway };
}
