import { describe, expect, it } from 'vitest';
import { migrateDocument, type MigrationRegistry } from '../src/migrate';
import type { VersionPolicy } from '../src/version';

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
      return { ...document, dataSources: document.dataSources ?? {} };
    }
  }
};

describe('migrate:按 schemaVersion 注册表升版', () => {
  it('按迁移链升至当前版本并写回 schemaVersion', () => {
    const result = migrateDocument(
      { schemaVersion: '0.8', id: 'demo', name: '旧标题' },
      registry,
      policy
    );
    expect(result).toMatchObject({
      outcome: 'migrated',
      steps: ['0.8 → 0.9', '0.9 → 1.0']
    });
    if (result.outcome !== 'migrated') throw new Error('unreachable');
    expect(result.document).toMatchObject({
      schemaVersion: '1.0',
      title: '旧标题',
      dataSources: {}
    });
    expect(result.document).not.toHaveProperty('formatVersion');
  });

  it('当前版本幂等，无路径和注册表成环均如实返回 no-path', () => {
    expect(migrateDocument({ schemaVersion: '1.0' }, registry, policy)).toEqual({
      outcome: 'current'
    });
    expect(migrateDocument({ schemaVersion: '0.5' }, registry, policy)).toEqual({
      outcome: 'no-path',
      from: '0.5'
    });
    const cyclic: MigrationRegistry = {
      '0.8': { to: '0.9', apply: (document) => document },
      '0.9': { to: '0.8', apply: (document) => document }
    };
    expect(
      migrateDocument({ schemaVersion: '0.8' }, cyclic, policy)
    ).toMatchObject({ outcome: 'no-path' });
  });
});
