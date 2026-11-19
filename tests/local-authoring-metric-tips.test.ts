import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { indexMetricDirectory, planMetricTips } from '../tools/scripts/local-authoring-metric-tips';
import { parsePage } from '../packages/page/src/validate';

const businessResult = () => JSON.parse(readFileSync('pages/business/dashboard/ioc/approval/rep-business-result.json', 'utf8'));
const scopedClosure = '决策闭环任务总体闭环率(投标-商务-合同)';
const catalogItem = (code: string, queryField: string, dimensions?: Record<string, string[]>) => ({
  code, source: '合成目录', queries: [{ queryField, dimensions }]
});

describe('批量匹配指标定义气泡', () => {
  it('旧页仍允许使用名为 metricCode 的结果字段', () => {
    const document = businessResult();
    document.dataSources['legacy-code-values'] = {
      fields: { metricCode: { type: 'string', role: 'dimension' } },
      source: { type: 'inline', rows: [{ metricCode: 'ZB0000377' }] }
    };
    expect(parsePage(document).ok).toBe(true);
  });

  it('开启气泡的指标行引用未知数据源时返回校验错误', () => {
    const document = businessResult();
    document.schemaVersion = '6.129';
    const card = document.sections[2].components[2];
    card.data.main = 'missing-data-source';
    card.props.rows[0].showDefinition = true;
    const result = parsePage(document);
    expect(result).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ path: '/sections/2/components/2/props/rows/0/showDefinition' })
      ])
    });
  });

  it('每个主次指标单独匹配，保留查询和无关字段，重复执行保持幂等', () => {
    const document = businessResult();
    document.schemaVersion = '6.129';
    const catalog = indexMetricDirectory({ metrics: [
      catalogItem('DEMO-TENDER', scopedClosure, { 决策业务类型: ['投标'] }),
      catalogItem('DEMO-BUSINESS', scopedClosure, { 决策业务类型: ['商务'] }),
      catalogItem('DEMO-CONTRACT', scopedClosure, { 决策业务类型: ['合同'] })
    ] });
    const plan = planMetricTips(document, catalog);
    expect(plan.changes).toBe(3);
    const card = (plan.candidate.sections as typeof document.sections)[2].components[2];
    expect(card.props.rows.map((row: { showDefinition?: boolean }) => row.showDefinition)).toEqual([true]);
    expect(card.props.secondaryRows.map((row: { showDefinition?: boolean }) => row.showDefinition)).toEqual([true, true]);
    expect(card.props).not.toHaveProperty('tipCode');
    const sources = plan.candidate.dataSources as typeof document.dataSources;
    expect(sources['total-closure'].fields.totalClosure.metricCode).toBe('DEMO-TENDER');
    expect(sources['business-decision-closure'].fields.businessDecisionClosure.metricCode).toBe('DEMO-BUSINESS');
    expect(sources['contract-decision-closure'].fields.contractDecisionClosure.metricCode).toBe('DEMO-CONTRACT');
    expect(sources['business-decision-closure'].source).toEqual(document.dataSources['business-decision-closure'].source);
    expect(sources['high-risk-contract']).toEqual(document.dataSources['high-risk-contract']);
    expect(document.sections[2].components[2].props.rows[0].showDefinition).toBeUndefined();
    expect(parsePage(plan.candidate).ok).toBe(true);
    expect(planMetricTips(plan.candidate, catalog).changes).toBe(0);
  });

  it('同一字段写一次，逐行开启，并跳过显式关闭和已配置旧版气泡的卡片', () => {
    const document = businessResult();
    document.schemaVersion = '6.129';
    const cards = document.sections[2].components;
    cards[0].props.tipCode = 'MANUAL';
    const framework = cards[1];
    const row = framework.props.rows[0];
    framework.props.rows = [row, { ...row, label: '复用', showDefinition: false }, { ...row, label: '复用并开启' }];
    const source = document.dataSources['framework-execution'];
    source.fields.other = { type: 'number', role: 'measure', queryField: '其他指标' };
    source.source.query.body.dsl_list[0].output_metrics.push('其他指标');
    const catalog = indexMetricDirectory({ metrics: [
      catalogItem('DEMO-FRAMEWORK', '框架执行率'), catalogItem('DEMO-OTHER', '其他指标')
    ] });
    const plan = planMetricTips(document, catalog);
    expect(plan.changes).toBe(2);
    expect(plan.cards).toContainEqual(expect.objectContaining({ componentId: cards[0].id, status: 'existing', code: 'MANUAL' }));
    const result = (plan.candidate.sections as typeof document.sections)[2].components[1];
    expect(result.props.rows.map((row: { showDefinition?: boolean }) => row.showDefinition)).toEqual([true, false, true]);
    const fields = (plan.candidate.dataSources as typeof document.dataSources)['framework-execution'].fields;
    expect(fields.frameworkExecution.metricCode).toBe('DEMO-FRAMEWORK');
    expect(fields.other.metricCode).toBeUndefined();
    expect(parsePage(plan.candidate).ok).toBe(true);
  });

  it('歧义或手工编码冲突留待确认，确定的匹配可写回分组声明', () => {
    const document = businessResult();
    document.schemaVersion = '6.129';
    const source = document.dataSources['framework-execution'];
    const { role: _role, ...measure } = source.fields.frameworkExecution;
    source.fields = { measures: { frameworkExecution: measure } };
    const direct = catalogItem('DEMO-FRAMEWORK', '框架执行率');
    const ambiguous = indexMetricDirectory({ metrics: [direct, catalogItem('DEMO-REGIONAL', '框架执行率', { 区域: ['地区部'] })] });
    const uncertain = planMetricTips(document, ambiguous);
    expect(uncertain.changes).toBe(0);
    expect(JSON.stringify(uncertain.cards)).toContain('ambiguous-catalog');
    const catalog = indexMetricDirectory({ metrics: [direct] });
    const matched = planMetricTips(document, catalog);
    expect(matched.changes).toBe(1);
    expect(matched.candidate.dataSources).toHaveProperty(['framework-execution', 'fields', 'measures', 'frameworkExecution', 'metricCode'], direct.code);
    expect(parsePage(matched.candidate).ok).toBe(true);
    measure.metricCode = 'MANUAL';
    const conflict = planMetricTips(document, catalog);
    expect(conflict.changes).toBe(0);
    expect(JSON.stringify(conflict.cards)).toContain('metric-code-conflict');
    expect(conflict.candidate).toEqual(document);
  });
});
