import { describe, expect, it } from 'vitest';
import type { CatalogSnapshot } from '../src/catalog';
import { validate } from '../src/validate';

import catalogFixture from '../fixtures/catalog.json';
import semanticOk from '../fixtures/valid/semantic-ok.json';
import minimal from '../fixtures/valid/minimal.json';
import unknownMetric from '../fixtures/invalid/unknown-metric.json';
import unknownDimension from '../fixtures/invalid/unknown-dimension.json';
import dimensionNotAvailable from '../fixtures/invalid/dimension-not-available.json';
import illegalAggregation from '../fixtures/invalid/illegal-aggregation.json';
import misspelledPosition from '../fixtures/invalid/misspelled-position.json';

const catalog = catalogFixture as CatalogSnapshot;

describe('validate:语义校验(以元数据快照为参照,样例集来自 fixtures/)', () => {
  it('指标/维度/聚合全部在快照允许范围内的页面通过,无错误', () => {
    expect(validate(semanticOk, catalog)).toEqual([]);
  });

  it('不传 catalog 时只做结构校验,现有调用方不破(引用未知指标也不报错)', () => {
    expect(validate(unknownMetric)).toEqual([]);
  });

  it('引用不存在的指标报 METRIC_GAP(需求信号,不是 bug),定位到该指标项', () => {
    const errors = validate(unknownMetric, catalog);
    expect(errors).toEqual([
      expect.objectContaining({ type: 'METRIC_GAP', path: '/widgets/0/query/metrics/0' })
    ]);
    expect(errors[0].message).toContain('cash-flow');
  });

  it('引用目录中不存在的维度报 SCHEMA_ERROR(写错了),定位到该维度项', () => {
    expect(validate(unknownDimension, catalog)).toEqual([
      expect.objectContaining({ type: 'SCHEMA_ERROR', path: '/widgets/0/query/dimensions/0' })
    ]);
  });

  it('维度存在但不可用于所引用指标,报 SCHEMA_ERROR 并指明指标与维度', () => {
    const errors = validate(dimensionNotAvailable, catalog);
    expect(errors).toEqual([
      expect.objectContaining({ type: 'SCHEMA_ERROR', path: '/widgets/0/query/dimensions/0' })
    ]);
    expect(errors[0].message).toContain('stat-date');
    expect(errors[0].message).toContain('order-count');
  });

  it('聚合方式不在指标可用聚合内,报 SCHEMA_ERROR 定位到 aggregation', () => {
    const errors = validate(illegalAggregation, catalog);
    expect(errors).toEqual([
      expect.objectContaining({ type: 'SCHEMA_ERROR', path: '/widgets/0/query/aggregation' })
    ]);
    expect(errors[0].message).toContain('count');
  });

  it('结构校验不过时不做语义校验,只报结构错误(避免对坏文档级联报错)', () => {
    const errors = validate(misspelledPosition, catalog);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.every((e) => e.type === 'SCHEMA_ERROR')).toBe(true);
  });

  it('minimal 页面引用的 gmv 在快照中,带 catalog 校验同样通过', () => {
    expect(validate(minimal, catalog)).toEqual([]);
  });
});
