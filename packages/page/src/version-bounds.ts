/**
 * Pure page schema version bounds and readable-version enumeration.
 * Kept leaf-only so `schema/page.ts` and `page-types.ts` do not depend on `version.ts`.
 */

export const PAGE_SCHEMA_MAJOR = 6;
/**
 * 6.8 只承载一次按 ADR-0051 例外行使的收紧(层级筛选器不再允许恒定
 * `queryField`，ADR-0084)，没有新能力，因此能力表里没有 minor=8 的条目。
 */
export const UNRESTRICTED_FILTER_CLEAR_MINOR = 124;
export const INDEPENDENT_EXCLUSION_CANDIDATES_MINOR = 125;
export const CURRENT_MINOR = 142;

/**
 * 5.x 与 6.0 的主体页面结构兼容，故保留为只读输入版本；读取时只需把
 * 旧导航转换为 6.x 的普通 URL 导航。新文档始终写 6.x。
 */
export const LEGACY_READABLE_PAGE_SCHEMA_VERSIONS = ['5.0', '5.1', '5.2', '5.3', '5.4'] as const;

export interface VersionBounds {
  major: number;
  /** 该主版本内已发布的最新次版本。 */
  minor: number;
  /** `MAJOR.MINOR` 形式的当前版本;新文档应当声明这个值。 */
  current: string;
}

export const defaultVersionBounds: VersionBounds = {
  major: PAGE_SCHEMA_MAJOR,
  minor: CURRENT_MINOR,
  current: `${PAGE_SCHEMA_MAJOR}.${CURRENT_MINOR}`,
};

/**
 * 6.x 接受 6.5 兼容版本及当前版本；5.0–5.4 保留为只读输入例外。
 * 能力引入历史仍可查询，但不代表旧 6.x 文档可读。
 */
export function supportedVersionsFor(policy: VersionBounds = defaultVersionBounds): string[] {
  const readableMinors = [5];
  for (let minor = 11; minor < policy.minor; minor++) readableMinors.push(minor);
  const currentMajor =
    policy.major === PAGE_SCHEMA_MAJOR && policy.minor >= 6
      ? [...new Set([...readableMinors.map((minor) => `${policy.major}.${minor}`), policy.current])]
      : [policy.current];
  return policy.major === PAGE_SCHEMA_MAJOR
    ? [...LEGACY_READABLE_PAGE_SCHEMA_VERSIONS, ...currentMajor]
    : currentMajor;
}
