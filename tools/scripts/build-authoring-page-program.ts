import { localValidatorOutputs } from './local-authoring-projection';
import { versionPolicy } from '../../packages/page/src/version';
import { OPERATIONS, SELF_TESTS, EVALUATION_SCHEMA } from '../../metriccanvas-authoring/core/page/product-contract';
import {EXTENSION_OPERATIONS} from '../../metriccanvas-authoring/core/page/extension-contract';
import {extensionSelfTests} from './authoring-extension-self-tests';
import {PRESENTATION_OPERATIONS,PRESENTATION_SELF_TESTS} from '../../metriccanvas-authoring/core/presentation/contract';

/** Build-time only. Reuse stable module IDs, dependency closure and license capture. */
export async function authoringPageProgramOutputs(root: string): Promise<Map<string, string>> {
  const outputs = await localValidatorOutputs(root, 'tools/scripts/authoring-page-program.ts', 'scripts/authoring-page-program.mjs');
  const licenses = outputs.get('scripts/THIRD-PARTY-LICENSES.md')!;
  outputs.delete('scripts/THIRD-PARTY-LICENSES.md');
  outputs.set('scripts/AUTHORING-PAGE-LICENSES.md', licenses);
  outputs.set('evaluation-schema.json', JSON.stringify(EVALUATION_SCHEMA, null, 2) + '\n');
  outputs.set('program-info.json', JSON.stringify({ schemaVersion: versionPolicy.current, node: '>=22' }, null, 2) + '\n');
  outputs.set('operations.json', JSON.stringify({...OPERATIONS,...EXTENSION_OPERATIONS,...PRESENTATION_OPERATIONS}, null, 2) + '\n');
  outputs.set('self-tests.json', JSON.stringify([...SELF_TESTS,...extensionSelfTests(),...PRESENTATION_SELF_TESTS], null, 2) + '\n');
  return outputs;
}

/** Node-only local authoring projection; no Python, repository or runtime npm dependency. */
export async function localAssociationOutputs(root:string):Promise<Map<string,string>> {
  return localValidatorOutputs(root,'tools/scripts/local-authoring-association.ts','scripts/associate-data.mjs');
}
