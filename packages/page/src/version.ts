import type { TypedError } from './errors';

/**
 * 文档格式版本策略(solution.md §3 第 4 条):运行时同时支持当前与前一个大版本(N/N-1),
 * N-1 由 validate CLI 给出升版警告(CI 提示不阻断),N-2 及未知版本拒绝加载。
 * 本表是版本判定与 JSON Schema 版本提示的唯一真源;DSL 出 2.0 时改此处即可。
 */
export interface VersionPolicy {
  current: string;
  /** 前一个大版本;DSL 尚无历史版本时为 null */
  previous: string | null;
}

export const versionPolicy: VersionPolicy = { current: '1.0', previous: null };

/** 受支持的版本集合(N 与 N-1) */
export function supportedVersions(policy: VersionPolicy = versionPolicy): string[] {
  return policy.previous ? [policy.previous, policy.current] : [policy.current];
}

/**
 * 版本判定:N 与 N-1 受支持;其余(N-2、未知、非字符串)报 SCHEMA_ERROR,
 * 错误信息含迁移指引。schemaVersion 缺失由结构校验的 required 负责,这里不重复。
 */
export function versionErrors(document: unknown, policy: VersionPolicy = versionPolicy): TypedError[] {
  const version = schemaVersionOf(document);
  if (version === undefined || supportedVersions(policy).includes(version)) return [];
  return [
    {
      type: 'SCHEMA_ERROR',
      path: '/schemaVersion',
      message:
        `不支持的文档格式版本 ${String(version)}:运行时只支持 ${supportedVersions(policy).join(' / ')}。` +
        `历史文档请执行 pnpm migrate 批量升版(迁移脚本按需执行,输出可评审 diff)`
    }
  ];
}

/** 升版警告:文档仍受支持(N-1)但应尽快升版;不是错误,CI 提示不阻断 */
export interface UpgradeWarning {
  /** JSON Pointer 定位 */
  path: string;
  message: string;
}

export function upgradeWarnings(
  document: unknown,
  policy: VersionPolicy = versionPolicy
): UpgradeWarning[] {
  const version = schemaVersionOf(document);
  if (version === undefined || version !== policy.previous) return [];
  return [
    {
      path: '/schemaVersion',
      message:
        `文档格式版本 ${version} 是前一个大版本(当前 ${policy.current}),仍可正常渲染;` +
        `请尽快执行 pnpm migrate 升版,${version} 将在下个大版本发布后拒绝加载`
    }
  ];
}

function schemaVersionOf(document: unknown): string | undefined {
  const version = (document as { schemaVersion?: unknown } | null)?.schemaVersion;
  return typeof version === 'string' ? version : undefined;
}
