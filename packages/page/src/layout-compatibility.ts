import type { TypedError } from './errors';
import type { PageLayoutForm } from './page';
import { versionPolicy } from './version';

/** 6.1 增量兼容规则；两字段即使同值也不建立双真源。 */
export function layoutCompatibilityErrors(document: unknown): TypedError[] {
  if (typeof document !== 'object' || document === null) return [];
  if ('layout' in document && 'layoutForm' in document) return [{
    type: 'SCHEMA_ERROR', path: '/layoutForm',
    message: 'layout 与 layoutForm 不得同时声明；仅保留一个布局真源'
  }];
  return [];
}

/** 仅供已完成校验的文档/运行态调用；不修改输入。 */
export function canonicalLayoutDocument<T extends {
  schemaVersion: string; layout?: PageLayoutForm; layoutForm?: PageLayoutForm
}>(document: T): Omit<T, 'layoutForm'> & { layout: PageLayoutForm } {
  const { layoutForm, ...rest } = document;
  const [major, minor] = document.schemaVersion.split('.').map(Number);
  const canonicalMinor = major === versionPolicy.major ? Math.max(1, minor) : 1;
  return { ...rest, schemaVersion: `${versionPolicy.major}.${canonicalMinor}`, layout: document.layout ?? layoutForm ?? 'report' };
}
