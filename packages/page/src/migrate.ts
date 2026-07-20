import { versionPolicy, type VersionPolicy } from './version';

/**
 * 迁移注册表:from 版本 → 一步迁移。多个大版本落后时按链逐步升(0.8→0.9→1.0)。
 * apply 收发裸文档(unknown 结构):历史版本的文档天然不符合当前类型,不做类型伪装。
 */
export type MigrationRegistry = Record<string, Migration>;

export interface Migration {
  to: string;
  apply(document: Record<string, unknown>): Record<string, unknown>;
}

/**
 * 生产注册表:DSL 尚只有 1.0,没有历史版本可迁——出 2.0 时在此登记 '1.0' → '2.0'。
 * 迁移逻辑与版本策略(version.ts)同步维护。
 */
export const migrations: MigrationRegistry = {};

export type MigrateResult =
  | { outcome: 'current' }
  | { outcome: 'migrated'; document: Record<string, unknown>; steps: string[] }
  | { outcome: 'no-path'; from: string };

/**
 * 把单个页面文档升到当前版本:已是当前版本则不动(幂等);
 * 按注册表逐步迁移直至 current;版本无迁移路径时如实报告,不猜。
 */
export function migrateDocument(
  document: Record<string, unknown>,
  registry: MigrationRegistry = migrations,
  policy: VersionPolicy = versionPolicy
): MigrateResult {
  let version = String(document.formatVersion);
  if (version === policy.current) return { outcome: 'current' };

  let migrated = document;
  const steps: string[] = [];
  const visited = new Set<string>();
  while (version !== policy.current) {
    // 成环护栏:注册表写错(如 0.9→0.8→0.9)时如实报 no-path,而不是死循环
    if (visited.has(version)) return { outcome: 'no-path', from: version };
    visited.add(version);
    const migration = registry[version];
    if (!migration) return { outcome: 'no-path', from: version };
    migrated = { ...migration.apply(migrated), formatVersion: migration.to };
    steps.push(`${version} → ${migration.to}`);
    version = migration.to;
  }
  return { outcome: 'migrated', document: migrated, steps };
}
