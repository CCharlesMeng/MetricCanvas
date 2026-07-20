import { describe, expect, it } from 'vitest';
import { validate } from './validate';

import minimal from '../fixtures/valid/minimal.json';
import missingSpecVersion from '../fixtures/invalid/missing-spec-version.json';
import misspelledPosition from '../fixtures/invalid/misspelled-position.json';
import wrongTypeWidth from '../fixtures/invalid/wrong-type-width.json';
import unknownWidgetType from '../fixtures/invalid/unknown-widget-type.json';
import layoutOverflow from '../fixtures/invalid/layout-overflow.json';
import emptyMetrics from '../fixtures/invalid/empty-metrics.json';
import duplicateWidgetId from '../fixtures/invalid/duplicate-widget-id.json';

describe('validate:结构校验(样例集来自 fixtures/)', () => {
  it('合法的最小规格通过,无错误', () => {
    expect(validate(minimal)).toEqual([]);
  });

  const invalidCases: Array<{ name: string; spec: unknown; path: string }> = [
    { name: '缺少必填字段 specVersion', spec: missingSpecVersion, path: '/specVersion' },
    { name: '字段拼错(positon)视为缺少 position', spec: misspelledPosition, path: '/widgets/0/position' },
    { name: '类型不对(position.w 为字符串)', spec: wrongTypeWidth, path: '/widgets/0/position/w' },
    { name: '未知组件类型(gauge 不在封闭组件集)', spec: unknownWidgetType, path: '/widgets/0/type' },
    { name: '布局越界(x=10, w=4 超出 12 列)', spec: layoutOverflow, path: '/widgets/0/position' },
    { name: '结构化查询至少一个指标(metrics 空数组)', spec: emptyMetrics, path: '/widgets/0/query/metrics' },
    { name: 'widget id 重复,定位到后一个', spec: duplicateWidgetId, path: '/widgets/1/id' }
  ];

  for (const { name, spec, path } of invalidCases) {
    it(`${name},报 SCHEMA_ERROR 并定位到 ${path}`, () => {
      expect(validate(spec)).toContainEqual(
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
