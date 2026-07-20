import { describe, expect, it } from 'vitest';
import { migrateDocument, type MigrationRegistry } from '../src/migrate';
import type { VersionPolicy } from '../src/version';

/** 注入的版本表与迁移注册表(独立事实):0.8→0.9 改字段名,0.9→1.0 补默认布局 */
const policy: VersionPolicy = { current: '1.0', previous: '0.9' };
const registry: MigrationRegistry = {
  '0.8': {
    to: '0.9',
    apply(document) {
      const { name, ...rest } = document;
      return { ...rest, title: name };
    }
  },
  '0.9': {
    to: '1.0',
    apply(document) {
      return { ...document, layout: document.layout ?? { type: 'grid', columns: 12 } };
    }
  }
};

describe('migrate:按注册表批量升版,幂等', () => {
  it('N-1 文档升至当前版本,应用该步迁移的变换', () => {
    const result = migrateDocument({ formatVersion: '0.9', id: 'demo', title: '演示' }, registry, policy);
    expect(result).toMatchObject({ outcome: 'migrated', steps: ['0.9 → 1.0'] });
    if (result.outcome !== 'migrated') throw new Error('unreachable');
    expect(result.document.formatVersion).toBe('1.0');
    expect(result.document.layout).toEqual({ type: 'grid', columns: 12 });
  });

  it('多个大版本落后时按链逐步升(0.8→0.9→1.0),各步变换全部生效', () => {
    const result = migrateDocument({ formatVersion: '0.8', id: 'demo', name: '旧字段名' }, registry, policy);
    expect(result).toMatchObject({ outcome: 'migrated', steps: ['0.8 → 0.9', '0.9 → 1.0'] });
    if (result.outcome !== 'migrated') throw new Error('unreachable');
    expect(result.document.title).toBe('旧字段名');
    expect(result.document).not.toHaveProperty('name');
    expect(result.document.formatVersion).toBe('1.0');
  });

  it('幂等:已是当前版本的文档不动', () => {
    expect(migrateDocument({ formatVersion: '1.0', id: 'demo' }, registry, policy)).toEqual({
      outcome: 'current'
    });
  });

  it('无迁移路径的版本如实报告,不猜', () => {
    expect(migrateDocument({ formatVersion: '0.5', id: 'demo' }, registry, policy)).toEqual({
      outcome: 'no-path',
      from: '0.5'
    });
  });

  it('生产注册表当前为空:除当前版本外一律 no-path(出 2.0 时登记迁移)', () => {
    expect(migrateDocument({ formatVersion: '1.0' })).toEqual({ outcome: 'current' });
    expect(migrateDocument({ formatVersion: '0.9' })).toMatchObject({ outcome: 'no-path' });
  });
});
