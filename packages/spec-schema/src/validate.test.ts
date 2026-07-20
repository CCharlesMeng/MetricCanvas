import { describe, expect, it } from 'vitest';
import { validate } from './index.js';

/** 合法最小规格:一个指标卡 widget(与 specs/demo.json 同构的手工算例) */
const validSpec = {
  specVersion: '1.0',
  id: 'demo',
  title: '演示看板',
  layout: { type: 'grid', columns: 12 },
  widgets: [
    {
      id: 'w-gmv',
      type: 'metricCard',
      title: 'GMV',
      position: { x: 0, y: 0, w: 3, h: 2 },
      query: { metrics: ['gmv'] },
      display: { unit: '元', thousandsSeparator: true }
    }
  ]
};

function clone<T>(v: T): T {
  return structuredClone(v);
}

describe('validate:结构校验', () => {
  it('合法的最小规格通过,无错误', () => {
    expect(validate(validSpec)).toEqual([]);
  });

  it('缺少必填字段 specVersion,报 SCHEMA_ERROR 并定位到 /specVersion', () => {
    const spec = clone(validSpec) as Record<string, unknown>;
    delete spec.specVersion;
    const errors = validate(spec);
    expect(errors).toContainEqual(
      expect.objectContaining({ type: 'SCHEMA_ERROR', path: '/specVersion' })
    );
  });

  it('字段拼错(widgets[0].positon)视为缺少 position,报 SCHEMA_ERROR', () => {
    const spec = clone(validSpec);
    const w = spec.widgets[0] as Record<string, unknown>;
    w.positon = w.position;
    delete w.position;
    const errors = validate(spec);
    expect(errors).toContainEqual(
      expect.objectContaining({ type: 'SCHEMA_ERROR', path: '/widgets/0/position' })
    );
  });

  it('类型不对(position.w 为字符串),报 SCHEMA_ERROR 并定位到具体字段', () => {
    const spec = clone(validSpec);
    (spec.widgets[0].position as Record<string, unknown>).w = '3';
    const errors = validate(spec);
    expect(errors).toContainEqual(
      expect.objectContaining({ type: 'SCHEMA_ERROR', path: '/widgets/0/position/w' })
    );
  });

  it('未知组件类型,报 SCHEMA_ERROR 并定位到 /widgets/0/type', () => {
    const spec = clone(validSpec);
    (spec.widgets[0] as Record<string, unknown>).type = 'gauge';
    const errors = validate(spec);
    expect(errors).toContainEqual(
      expect.objectContaining({ type: 'SCHEMA_ERROR', path: '/widgets/0/type' })
    );
  });

  it('布局越界(x=10, w=4 超出 12 列),报 SCHEMA_ERROR 并定位到该 widget 的 position', () => {
    const spec = clone(validSpec);
    spec.widgets[0].position = { x: 10, y: 0, w: 4, h: 2 };
    const errors = validate(spec);
    expect(errors).toContainEqual(
      expect.objectContaining({ type: 'SCHEMA_ERROR', path: '/widgets/0/position' })
    );
  });

  it('query.metrics 为空数组,报 SCHEMA_ERROR(结构化查询至少一个指标)', () => {
    const spec = clone(validSpec);
    spec.widgets[0].query.metrics = [];
    const errors = validate(spec);
    expect(errors).toContainEqual(
      expect.objectContaining({ type: 'SCHEMA_ERROR', path: '/widgets/0/query/metrics' })
    );
  });

  it('widget id 重复,报 SCHEMA_ERROR 并定位到后一个 widget', () => {
    const spec = clone(validSpec);
    spec.widgets.push(clone(spec.widgets[0]));
    const errors = validate(spec);
    expect(errors).toContainEqual(
      expect.objectContaining({ type: 'SCHEMA_ERROR', path: '/widgets/1/id' })
    );
  });

  it('非对象输入(null),报 SCHEMA_ERROR 而不抛异常', () => {
    const errors = validate(null);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].type).toBe('SCHEMA_ERROR');
  });
});
