import { describe, expect, it } from 'vitest';
import { PAGE_SCHEMA_MAJOR, pageCapabilities, requiredMinorVersion, supportedVersions, versionErrors, versionPolicy } from '../src/version';
describe('6.0 是 URL 导航的主版本边界', () => {
  it('当前主版本全部原有能力从 0 起算', () => {
    expect(PAGE_SCHEMA_MAJOR).toBe(6);
    expect(supportedVersions()).toEqual(['6.0']);
    expect(versionPolicy.current).toBe('6.0');
    for(const definition of Object.values(pageCapabilities)) expect(definition.minor).toBe(0);
    expect(requiredMinorVersion({params:[{id:'x'}],layoutForm:'dashboard'})).toBe(0);
  });
  it('旧主版本与未来版本都拒绝，当前版本可读', () => {
    expect(versionErrors({schemaVersion:'6.0'})).toEqual([]);
    for(const schemaVersion of ['5.0','5.4','4.0','7.0','6.1','6','6.0.1']) expect(versionErrors({schemaVersion})).toHaveLength(1);
    expect(versionErrors({schemaVersion:'5.4'})[0]?.message).toContain('跨主版本');
  });
  it('次版本策略仍能表达未来增量支持范围', () => {
    expect(supportedVersions({...versionPolicy,minor:2,current:'6.2'})).toEqual(['6.0','6.1','6.2']);
    expect(versionErrors({schemaVersion:'6.1'},{...versionPolicy,minor:2,current:'6.2'})).toEqual([]);
  });
});
