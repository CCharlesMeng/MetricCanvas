import { describe, expect, it } from 'vitest';
import { validate } from '../src/validate';

import minimal from '../fixtures/valid/minimal.json';
import withFilters from '../fixtures/valid/with-filters.json';
import withNavigate from '../fixtures/valid/with-navigate.json';
import withTable from '../fixtures/valid/with-table.json';
import missingFormatVersion from '../fixtures/invalid/missing-format-version.json';
import misspelledPosition from '../fixtures/invalid/misspelled-position.json';
import wrongTypeWidth from '../fixtures/invalid/wrong-type-width.json';
import unknownWidgetType from '../fixtures/invalid/unknown-widget-type.json';
import layoutOverflow from '../fixtures/invalid/layout-overflow.json';
import emptyMetrics from '../fixtures/invalid/empty-metrics.json';
import duplicateWidgetId from '../fixtures/invalid/duplicate-widget-id.json';
import duplicateFilterId from '../fixtures/invalid/duplicate-filter-id.json';
import subscribeUnknownFilter from '../fixtures/invalid/subscribe-unknown-filter.json';
import writeFilterNotDimension from '../fixtures/invalid/write-filter-not-dimension.json';
import interactionDimensionNotQueried from '../fixtures/invalid/interaction-dimension-not-queried.json';
import interactionDimensionMismatch from '../fixtures/invalid/interaction-dimension-mismatch.json';
import navigateMissingPage from '../fixtures/invalid/navigate-missing-page.json';
import navigateCarryUnknownFilter from '../fixtures/invalid/navigate-carry-unknown-filter.json';
import navigateSetDimensionNotQueried from '../fixtures/invalid/navigate-set-dimension-not-queried.json';
import pieMultipleMetrics from '../fixtures/invalid/pie-multiple-metrics.json';
import tableFilterableMissingMode from '../fixtures/invalid/table-filterable-missing-mode.json';
import tableColumnFieldEmpty from '../fixtures/invalid/table-column-field-empty.json';
import tableColumnNotInQuery from '../fixtures/invalid/table-column-not-in-query.json';
import tableFilterableMetricColumn from '../fixtures/invalid/table-filterable-metric-column.json';
import tableMultipleMetrics from '../fixtures/invalid/table-multiple-metrics.json';
import tableDuplicateColumnField from '../fixtures/invalid/table-duplicate-column-field.json';
import withMapAndText from '../fixtures/valid/with-map-and-text.json';
import mapMultipleMetrics from '../fixtures/invalid/map-multiple-metrics.json';
import mapMissingBasemap from '../fixtures/invalid/map-missing-basemap.json';
import mapNameMapDuplicateTarget from '../fixtures/invalid/map-namemap-duplicate-target.json';
import textLinkCarryUnknownFilter from '../fixtures/invalid/text-link-carry-unknown-filter.json';

describe('validate:结构校验(样例集来自 fixtures/)', () => {
  it('合法的最小页面文档通过,无错误', () => {
    expect(validate(minimal)).toEqual([]);
  });

  it('带筛选器声明与交互回写的页面文档通过,无错误', () => {
    expect(validate(withFilters)).toEqual([]);
  });

  it('带 navigate 跨页下钻声明的页面文档通过,无错误(目标页存在性属 CLI 层跨文档校验)', () => {
    expect(validate(withNavigate)).toEqual([]);
  });

  it('带表格 widget(列定义含宽度/固定列/可排序/表头筛选两模式)的页面文档通过,无错误', () => {
    expect(validate(withTable)).toEqual([]);
  });

  it('带地图(china/world 底图、散点、nameMap)与文本(文案 + 带参链接)组件的页面文档通过,无错误', () => {
    expect(validate(withMapAndText)).toEqual([]);
  });

  const invalidCases: Array<{ name: string; document: unknown; path: string }> = [
    { name: '缺少必填字段 formatVersion', document: missingFormatVersion, path: '/formatVersion' },
    { name: '字段拼错(positon)视为缺少 position', document: misspelledPosition, path: '/widgets/0/position' },
    { name: '类型不对(position.w 为字符串)', document: wrongTypeWidth, path: '/widgets/0/position/w' },
    { name: '未知组件类型(gauge 不在封闭组件集)', document: unknownWidgetType, path: '/widgets/0/type' },
    { name: '布局越界(x=10, w=4 超出 12 列)', document: layoutOverflow, path: '/widgets/0/position' },
    { name: '结构化查询至少一个指标(metrics 空数组)', document: emptyMetrics, path: '/widgets/0/query/metrics' },
    { name: 'widget id 重复,定位到后一个', document: duplicateWidgetId, path: '/widgets/1/id' },
    { name: '筛选器 id 重复,定位到后一个', document: duplicateFilterId, path: '/filters/1/id' },
    {
      name: '订阅了未声明的筛选器',
      document: subscribeUnknownFilter,
      path: '/widgets/0/query/filters/subscribe/0'
    },
    {
      name: '交互回写目标不是 dimension 型筛选器',
      document: writeFilterNotDimension,
      path: '/widgets/0/interactions/0/writeFilter'
    },
    {
      name: '交互取值占位引用了查询之外的维度',
      document: interactionDimensionNotQueried,
      path: '/widgets/0/interactions/0/value'
    },
    {
      name: '交互取值占位的维度与回写目标筛选器约束的维度不一致(channel 值写不进 region 筛选器)',
      document: interactionDimensionMismatch,
      path: '/widgets/0/interactions/0/value'
    },
    {
      name: 'navigate 缺少必填的目标页 id',
      document: navigateMissingPage,
      path: '/widgets/0/interactions/0/navigate/page'
    },
    {
      name: 'navigate.carryFilters 引用了本页未声明的筛选器',
      document: navigateCarryUnknownFilter,
      path: '/widgets/0/interactions/0/navigate/carryFilters/0'
    },
    {
      name: 'navigate.setFilters 占位引用了查询之外的维度',
      document: navigateSetDimensionNotQueried,
      path: '/widgets/0/interactions/0/navigate/setFilters/f-channel'
    },
    {
      name: '饼图声明多指标(占比无多指标语义,不静默取第一个)',
      document: pieMultipleMetrics,
      path: '/widgets/0/query/metrics'
    },
    {
      name: '表格列 filterable 缺少表头筛选模式 mode',
      document: tableFilterableMissingMode,
      path: '/widgets/0/columns/0/filterable/mode'
    },
    {
      name: '表格列 field 为空串',
      document: tableColumnFieldEmpty,
      path: '/widgets/0/columns/0/field'
    },
    {
      name: '表格列 field 未出现在查询的 dimensions/metrics 中(该列必然无数据)',
      document: tableColumnNotInQuery,
      path: '/widgets/0/columns/1/field'
    },
    {
      name: '表头筛选列的 field 不是查询维度(指标值筛选无 @where 语义)',
      document: tableFilterableMetricColumn,
      path: '/widgets/0/columns/1/filterable'
    },
    {
      name: '表格声明多指标(行式指标表下多指标透视与 @limit/@offset 行级分页语义冲突)',
      document: tableMultipleMetrics,
      path: '/widgets/0/query/metrics'
    },
    {
      name: '表格列 field 重复,定位到后一个',
      document: tableDuplicateColumnField,
      path: '/widgets/0/columns/1/field'
    },
    {
      name: '地图声明多指标(区域着色无多指标语义,不静默取第一个)',
      document: mapMultipleMetrics,
      path: '/widgets/0/query/metrics'
    },
    {
      name: '地图缺少必选的底图声明(display.map)',
      document: mapMissingBasemap,
      path: '/widgets/0/display/map'
    },
    {
      name: 'nameMap 多个维度值映射到同一底图区域名(着色与点击回写相互覆盖,不静默取后写者)',
      document: mapNameMapDuplicateTarget,
      path: '/widgets/0/display/nameMap'
    },
    {
      name: '文本带参链接的 carryFilters 引用了本页未声明的筛选器',
      document: textLinkCarryUnknownFilter,
      path: '/widgets/0/links/0/carryFilters/0'
    }
  ];

  for (const { name, document, path } of invalidCases) {
    it(`${name},报 SCHEMA_ERROR 并定位到 ${path}`, () => {
      expect(validate(document)).toContainEqual(
        expect.objectContaining({ type: 'SCHEMA_ERROR', path })
      );
    });
  }

  it('非对象输入(null),报 SCHEMA_ERROR 而不抛异常', () => {
    const errors = validate(null);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].type).toBe('SCHEMA_ERROR');
  });
});
