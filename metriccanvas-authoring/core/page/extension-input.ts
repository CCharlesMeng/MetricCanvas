import {Ajv} from 'ajv';
import {EXTENSION_OPERATIONS} from './extension-contract';

const validators=new Map(Object.entries(EXTENSION_OPERATIONS).map(([id,contract])=>[id,new Ajv({allErrors:true,strict:false}).compile(contract.inputSchema)]));
export function analysisInputIssues(operation:string,input:unknown) {
  const validate=validators.get(operation);
  if(!validate || !validate(input))return [{code:'ANALYSIS_INPUT_INVALID',path:'',message:JSON.stringify(validate?.errors ?? 'Unknown analysis operation')}];
  return [];
}
