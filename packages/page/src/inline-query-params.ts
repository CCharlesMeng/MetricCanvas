export const record = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
export const pointer = (v: string): string => v.replaceAll('~','~0').replaceAll('/','~1');
/** Last sending boundary also protects callers that bypass Page validation. */
export function assertNoQueryParamReferences(value: unknown): void {
  if(Array.isArray(value)) {value.forEach(assertNoQueryParamReferences);return;}
  if(!record(value))return;
  if(Object.hasOwn(value,'param'))throw new Error('DQE请求包含未解析的参数引用');
  Object.values(value).forEach(assertNoQueryParamReferences);
}
