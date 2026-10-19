import { describe, expect, it } from 'vitest';
import { PAGE_SCHEMA_MAJOR, pageCapabilities, requiredMinorVersion, supportedVersions, versionErrors, versionPolicy } from '../src/version';
describe('5.x 的兼容读取与 6.x 版本边界', () => {
  it('当前主版本全部原有能力从 0 起算', () => {
    expect(PAGE_SCHEMA_MAJOR).toBe(6);
    expect(supportedVersions()).toEqual(['5.0', '5.1', '5.2', '5.3', '5.4', '6.5', '6.11', '6.12', '6.13', '6.14', '6.15', '6.16', '6.17', '6.18', '6.19', '6.20', '6.21', '6.22', '6.23', '6.24', '6.25', '6.26', '6.27', '6.28', '6.29', '6.30', '6.31','6.32','6.33']);
    expect(versionPolicy.current).toBe('6.33');
    for(const [id, definition] of Object.entries(pageCapabilities)) expect(definition.minor).toBe(id === 'tab-url-initial-state' ? 33 : id === 'chart-echarts-option' ? 32 : id === 'report-header-export-buttons' ? 31 : id === 'report-header-png-export' ? 30 : id === 'period-filter' ? 27 : id === 'chart-local-filter' ? 29 : id === 'report-header-pdf-export' ? 28 : id === 'time-point-disable-future' ? 25 : id === 'time-point-min' ? 24 : id === 'text-value-composition' ? 23 : id === 'paged-join' ? 22 : id === 'table-toolbar' ? 21 : id === 'query-result-page-window' ? 20 : id === 'query-result-row-filter' ? 19 : id === 'signed-number-format-family' ? 18 : id === 'signed-number-formats' ? 17 : (id === 'explicit-value-colors' || id === 'chart-label-presentation') ? 16 : id === 'filter-text-values' ? 15 : (id === 'query-result-bindings' || id === 'multi-value-pivot') ? 14 : id === 'report-header-date-filters' ? 13 : (id === 'folding-all-missing' || id === 'cross-source-computation' || id === 'mixed-chart-series' || id === 'section-navigation' || id === 'detail-views' || id === 'binding-missing-text' || id === 'table-column-actions') ? 12 : id === 'initial-param-beyond-flat-dimensions' ? 11 : id === 'open-detail-action' ? 10 : id === 'filter-binding-non-dimension-targets' ? 9 : id === 'filter-binding-level-query-fields' ? 7 : id === 'grouped-params' ? 6 : (id === 'inline-page-params' || id === 'million-formats') ? 5 : id === 'named-to-date-windows' ? 4 : id === 'time-params' ? 3 : id === 'dimension-params' ? 2 : id === 'page-layout' ? 1 : 0);
    expect(requiredMinorVersion({params:[{id:'x'}],layoutForm:'dashboard'})).toBe(0);
  });
  it('兼容读取全部 5.x，拒绝其他旧主版本与未来版本', () => {
    expect(versionErrors({schemaVersion:'6.0'})).toHaveLength(1);
    for(const schemaVersion of ['5.0','5.1','5.2','5.3','5.4']) expect(versionErrors({schemaVersion})).toEqual([]);
    for(const schemaVersion of ['4.0','6.2','6.3','6.4','6.6','6.7','6.8','6.9','6.10','7.0',`6.${versionPolicy.minor + 1}`,'6','6.0.1']) expect(versionErrors({schemaVersion})).toHaveLength(1);
    expect(versionErrors({schemaVersion:'4.0'})[0]?.message).toContain('跨主版本');
  });
  it('次版本策略仍能表达未来增量支持范围', () => {
    expect(supportedVersions({...versionPolicy,minor:2,current:'6.2'})).toEqual(['5.0','5.1','5.2','5.3','5.4','6.2']);
    expect(versionErrors({schemaVersion:'6.1'},{...versionPolicy,minor:2,current:'6.2'})).toHaveLength(1);
  });
});
