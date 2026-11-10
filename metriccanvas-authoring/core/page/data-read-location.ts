type Json = Record<string, any>;
export const within = (path: string, parent: string) => path === parent || path.startsWith(parent + '/');
export const encode = (key: string) => key.replaceAll('~', '~0').replaceAll('/', '~1');

export function pointerValue(document: unknown, pointer: string): any {
  if (!pointer.startsWith('/') || /~(?![01])/u.test(pointer)) throw new TypeError('Expected an absolute JSON Pointer');
  return pointer.slice(1).split('/').reduce((value: any, token) => {
    const key = token.replaceAll('~1', '/').replaceAll('~0', '~');
    if (Array.isArray(value) && !/^(0|[1-9]\d*)$/u.test(key)) throw new TypeError('Invalid array position');
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, key)) throw new TypeError('Unknown document position');
    return value[key];
  }, document);
}
