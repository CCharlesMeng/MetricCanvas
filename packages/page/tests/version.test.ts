import { describe, expect, it } from 'vitest';
import {
  supportedVersions,
  upgradeWarnings,
  versionErrors,
  type VersionPolicy
} from '../src/version';

const nextEra: VersionPolicy = { current: '2.0', previous: '1.0' };
const doc = (schemaVersion: unknown): unknown => ({ schemaVersion });

describe('schemaVersion 判定', () => {
  it('支持 N/N-1，拒绝其它版本并定位 /schemaVersion', () => {
    expect(supportedVersions(nextEra)).toEqual(['1.0', '2.0']);
    expect(versionErrors(doc('2.0'), nextEra)).toEqual([]);
    expect(versionErrors(doc('1.0'), nextEra)).toEqual([]);
    expect(versionErrors(doc('0.9'), nextEra)).toEqual([
      expect.objectContaining({ type: 'SCHEMA_ERROR', path: '/schemaVersion' })
    ]);
  });

  it('N-1 只产生升版警告，缺失与非字符串交给 JSON Schema', () => {
    expect(upgradeWarnings(doc('1.0'), nextEra)).toEqual([
      expect.objectContaining({ path: '/schemaVersion' })
    ]);
    expect(versionErrors(doc(undefined), nextEra)).toEqual([]);
    expect(versionErrors(doc(1), nextEra)).toEqual([]);
    expect(versionErrors(null, nextEra)).toEqual([]);
  });
});
