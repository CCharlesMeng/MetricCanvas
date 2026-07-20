import { describe, expect, it } from 'vitest';
import { validate } from '../src/validate';

import minimal from '../fixtures/valid/minimal.json';
import withFilters from '../fixtures/valid/with-filters.json';
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

describe('validate:结构校验(样例集来自 fixtures/)', () => {
  it('合法的最小页面文档通过,无错误', () => {
    expect(validate(minimal)).toEqual([]);
  });

  it('带筛选器声明与交互回写的页面文档通过,无错误', () => {
    expect(validate(withFilters)).toEqual([]);
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
