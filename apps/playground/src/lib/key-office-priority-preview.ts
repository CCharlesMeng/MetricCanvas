import {prepareIocHeaderFilters,createKeyOfficePriorityGateway} from '../../fixtures/key-office-filter/gateway';
/** The demo exercises the same copyable integration bridge as the standalone example. */
export async function prepareKeyOfficePreview(document:unknown,kind:string|undefined,state='ready'):Promise<unknown> {
  if(kind!=='key-office-priority')return document;
  return prepareIocHeaderFilters(document,createKeyOfficePriorityGateway(undefined,state),{signal:new AbortController().signal});
}
