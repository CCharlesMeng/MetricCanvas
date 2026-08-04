import type { TypedError } from './errors';

export interface VersionPolicy {
  current: '4.0';
  previous: null;
}

export const versionPolicy: VersionPolicy = {
  current: '4.0',
  previous: null
};

export function supportedVersions(
  policy: VersionPolicy = versionPolicy
): string[] {
  return [policy.current];
}

export function versionErrors(
  document: unknown,
  policy: VersionPolicy = versionPolicy
): TypedError[] {
  const version = schemaVersionOf(document);
  if (version === undefined || version === policy.current) return [];
  return [
    {
      type: 'SCHEMA_ERROR',
      path: '/schemaVersion',
      message:
        `不支持的文档格式版本 ${String(version)}:` +
        `运行时只接受 ${policy.current}，旧版本必须在接入前完整迁移`
    }
  ];
}

export interface UpgradeWarning {
  path: string;
  message: string;
}

export function upgradeWarnings(): UpgradeWarning[] {
  return [];
}

function schemaVersionOf(document: unknown): string | undefined {
  const version = (document as { schemaVersion?: unknown } | null)?.schemaVersion;
  return typeof version === 'string' ? version : undefined;
}
