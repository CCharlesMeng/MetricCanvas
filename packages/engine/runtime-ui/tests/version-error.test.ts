import { describe, expect, it } from 'vitest';
import { supportedVersions, versionPolicy } from '@metriccanvas/page';
import { ERROR_TYPES } from '@metriccanvas/page/internal';
import { runtimeVersionError } from '../src/version-error';

describe('引擎协议版本能力检查', () => {
  it.each(['5.4', '6.1', '7.0'])('版本 %s 不在支持区间时给出独立事件', (schemaVersion) => {
    const error = runtimeVersionError({ schemaVersion });
    expect(error).toMatchObject({
      type: 'version-error',
      requiredSchemaVersion: schemaVersion,
      currentSchemaVersion: versionPolicy.current,
      supportedSchemaVersions: supportedVersions()
    });
    expect(error?.message).toContain(schemaVersion);
    expect(error?.message).toContain(versionPolicy.current);
    expect(ERROR_TYPES).not.toContain('version-error');
  });

  it.each([undefined, null, [], {}, { schemaVersion: 7 }, { schemaVersion: 'bad' },
    { schemaVersion: '7.0.0' }, { schemaVersion: '' }])('缺失或非法格式交给文档校验：%j', (input) => {
    expect(runtimeVersionError(input)).toBeUndefined();
  });

  it('接受所有受支持版本并与协议数字版本判断保持一致', () => {
    for (const schemaVersion of [...supportedVersions(), '06.00']) {
      expect(runtimeVersionError({ schemaVersion })).toBeUndefined();
    }
  });
});
