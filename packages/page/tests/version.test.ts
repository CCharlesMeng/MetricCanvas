import { describe, expect, it } from 'vitest';
import {
  supportedVersions,
  upgradeWarnings,
  versionErrors
} from '../src/version';

const doc = (schemaVersion: unknown): unknown => ({ schemaVersion });

describe('schemaVersion 4.0 判定', () => {
  it('只接受 4.0 并拒绝旧版本', () => {
    expect(supportedVersions()).toEqual(['4.0']);
    expect(versionErrors(doc('4.0'))).toEqual([]);
    expect(versionErrors(doc('2.0'))).toEqual([
      expect.objectContaining({
        type: 'SCHEMA_ERROR',
        path: '/schemaVersion'
      })
    ]);
    expect(versionErrors(doc('1.0'))).toEqual([
      expect.objectContaining({
        type: 'SCHEMA_ERROR',
        path: '/schemaVersion'
      })
    ]);
  });

  it('不产生 N-1 升版警告，缺失与非字符串交给 JSON Schema', () => {
    expect(upgradeWarnings()).toEqual([]);
    expect(versionErrors(doc(undefined))).toEqual([]);
    expect(versionErrors(doc(1))).toEqual([]);
    expect(versionErrors(null)).toEqual([]);
  });
});
