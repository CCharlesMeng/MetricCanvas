import { supportedVersions, versionPolicy } from '@metriccanvas/page';
import { versionErrors } from '@metriccanvas/page/internal';
import type { RuntimeViewEvent } from './types';

/** 能力检查先于文档解析；缺失或格式错误的版本仍由页面协议校验。 */
export function runtimeVersionError(
  document: unknown
): Extract<RuntimeViewEvent, { type: 'version-error' }> | undefined {
  if (typeof document !== 'object' || document === null || Array.isArray(document)) return;
  const declared = (document as { schemaVersion?: unknown }).schemaVersion;
  if (typeof declared !== 'string' || !/^\d+\.\d+$/.test(declared)) return;
  if (versionErrors(document).length === 0) return;
  const supported = supportedVersions();
  return {
    type: 'version-error',
    requiredSchemaVersion: declared,
    currentSchemaVersion: versionPolicy.current,
    supportedSchemaVersions: supported,
    message: `页面需要协议版本 ${declared}，当前引擎支持 ${supported.join(' / ')}。请使用支持该页面协议版本的引擎。`
  };
}
