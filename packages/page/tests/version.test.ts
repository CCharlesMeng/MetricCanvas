import { describe, expect, it } from 'vitest';
import { PAGE_SCHEMA_MAJOR, pageCapabilities, requiredMinorVersion, supportedVersions, versionErrors, versionPolicy } from '../src/version';
describe('5.x 的兼容读取与 6.x 版本边界', () => {
  it('当前主版本全部原有能力从 0 起算', () => {
    expect(PAGE_SCHEMA_MAJOR).toBe(6);
    expect(supportedVersions()).toEqual(['5.0', '5.1', '5.2', '5.3', '5.4', '6.0', '6.1', '6.2', '6.3', '6.4', '6.5', '6.6', '6.7', '6.8', '6.9', '6.10']);
    expect(versionPolicy.current).toBe('6.10');
    for(const [id, definition] of Object.entries(pageCapabilities)) expect(definition.minor).toBe(id === 'open-detail-action' ? 10 : id === 'filter-binding-non-dimension-targets' ? 9 : id === 'filter-binding-level-query-fields' ? 7 : id === 'grouped-params' ? 6 : id === 'million-formats' ? 5 : id === 'named-to-date-windows' ? 4 : id === 'time-params' ? 3 : id === 'dimension-params' ? 2 : id === 'page-layout' ? 1 : 0);
    expect(requiredMinorVersion({params:[{id:'x'}],layoutForm:'dashboard'})).toBe(0);
  });
  it('兼容读取全部 5.x，拒绝其他旧主版本与未来版本', () => {
    expect(versionErrors({schemaVersion:'6.0'})).toEqual([]);
    for(const schemaVersion of ['5.0','5.1','5.2','5.3','5.4']) expect(versionErrors({schemaVersion})).toEqual([]);
    for(const schemaVersion of ['4.0','7.0','6.11','6','6.0.1']) expect(versionErrors({schemaVersion})).toHaveLength(1);
    expect(versionErrors({schemaVersion:'4.0'})[0]?.message).toContain('跨主版本');
  });
  it('次版本策略仍能表达未来增量支持范围', () => {
    expect(supportedVersions({...versionPolicy,minor:2,current:'6.2'})).toEqual(['5.0','5.1','5.2','5.3','5.4','6.0','6.1','6.2']);
    expect(versionErrors({schemaVersion:'6.1'},{...versionPolicy,minor:2,current:'6.2'})).toEqual([]);
  });
});
