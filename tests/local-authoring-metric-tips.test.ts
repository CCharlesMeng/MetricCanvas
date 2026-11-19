import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { indexMetricDirectory, planMetricTips } from '../tools/scripts/local-authoring-metric-tips';
import { parsePage } from '../packages/page/src/validate';

const businessResult = () => JSON.parse(readFileSync('pages/business/dashboard/ioc/approval/rep-business-result.json', 'utf8'));
const scopedClosure = '决策闭环任务总体闭环率(投标-商务-合同)';

describe('批量匹配指标定义气泡', () => {
  it('沿取数绑定识别实际单行卡和同比请求，重复执行保持已有编码', () => {
    const document = businessResult();
    const [discount, framework] = document.sections[2].components;
    const catalog = indexMetricDirectory({ metrics: [
      {
        code: 'DEMO-DISCOUNT', source: '合成目录',
        queries: [{ queryField: '净商务折扣（原价）' }, { queryField: '净商务折扣（原价）年变化' }]
      },
      { code: 'DEMO-FRAMEWORK', source: '合成目录', queries: [{ queryField: '框架执行率' }] }
    ] });
    document.schemaVersion = '6.127';
    expect(parsePage(document).ok).toBe(true);
    const plan = planMetricTips(document, catalog);
    expect(plan.changes).toBe(2);
    expect(plan.cards).toContainEqual(expect.objectContaining({ componentId: discount.id, anchor: 'row', code: 'DEMO-DISCOUNT' }));
    expect(plan.cards).toContainEqual(expect.objectContaining({ componentId: framework.id, anchor: 'row', code: 'DEMO-FRAMEWORK' }));
    expect(plan.candidate.dataSources).toEqual(document.dataSources);
    expect(discount.props.tipCode).toBeUndefined();
    expect(framework.props.tipCode).toBeUndefined();
    expect(parsePage(plan.candidate).ok).toBe(true);
    expect(planMetricTips(plan.candidate, catalog).changes).toBe(0);
  });

  it('只按实际用到的字段匹配，共享查询可包含其他输出', () => {
    const document = businessResult();
    const source = document.dataSources['framework-execution'];
    source.fields.otherMetric = { type: 'number', role: 'measure', queryField: '其他指标' };
    source.source.query.body.dsl_list[0].output_metrics.push('其他指标');
    const catalog = indexMetricDirectory({ metrics: [
      { code: 'DEMO-FRAMEWORK', source: '合成目录', queries: [{ queryField: '框架执行率' }] },
      { code: 'DEMO-OTHER', source: '合成目录', queries: [{ queryField: '其他指标' }] }
    ] });
    const plan = planMetricTips(document, catalog);
    expect(plan.changes).toBe(1);
    expect(plan.cards).toContainEqual(expect.objectContaining({ componentId: 'framework-execution-metric', code: 'DEMO-FRAMEWORK' }));
  });

  it('同名的三个固定业务范围可区分，合卡的不同编码留待核对', () => {
    const document = businessResult();
    const card = document.sections[2].components[2];
    card.props.title = '总闭环率';
    const catalog = indexMetricDirectory({ metrics: [
      { code: 'DEMO-TENDER', source: '合成目录', queries: [{ queryField: scopedClosure, dimensions: { 决策业务类型: ['投标'] } }] },
      { code: 'DEMO-BUSINESS', source: '合成目录', queries: [{ queryField: scopedClosure, dimensions: { 决策业务类型: ['商务'] } }] },
      { code: 'DEMO-CONTRACT', source: '合成目录', queries: [{ queryField: scopedClosure, dimensions: { 决策业务类型: ['合同'] } }] }
    ] });
    const combined = planMetricTips(document, catalog);
    expect(combined.cards).toContainEqual(expect.objectContaining({ componentId: card.id, reason: 'multiple-metrics' }));
    card.props.rows = [card.props.secondaryRows[0]];
    delete card.props.secondaryRows;
    delete card.props.title;
    const single = planMetricTips(document, catalog);
    expect(single.cards).toContainEqual(expect.objectContaining({ componentId: card.id, status: 'ready', anchor: 'row', code: 'DEMO-BUSINESS' }));
  });

  it('含未证实维度口径的多编码目录不会覆盖手工配置或自动选择其中一个', () => {
    const document = businessResult();
    const catalog = indexMetricDirectory({ metrics: [
      { code: 'DEMO-FRAMEWORK', source: '合成目录', queries: [{ queryField: '框架执行率' }] },
      { code: 'DEMO-REGIONAL', source: '合成目录', queries: [{ queryField: '框架执行率', dimensions: { 区域: ['地区部'] } }] }
    ] });
    const card = document.sections[2].components[1];
    const initial = planMetricTips(document, catalog);
    expect(initial.changes).toBe(0);
    expect(initial.cards).toContainEqual(expect.objectContaining({ componentId: card.id, reason: 'ambiguous-catalog' }));
    card.props.tipCode = 'MANUAL';
    const manual = planMetricTips(document, catalog);
    expect(manual.changes).toBe(0);
    expect(manual.cards).toContainEqual(expect.objectContaining({ componentId: card.id, status: 'existing', code: 'MANUAL' }));
  });
});
