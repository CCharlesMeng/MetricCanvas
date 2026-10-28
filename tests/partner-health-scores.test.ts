import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {parsePage} from '../packages/page/src/index';
import {applyComputation} from '../packages/data-execution/src/compute';

const document = JSON.parse(readFileSync(new URL('../pages/temporary/partner-health.json', import.meta.url), 'utf8'));
const parsed = parsePage(document);
if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
const page = parsed.page;
const sources = ['health-overview','regional-comparison','representative-comparison','health-detail-region','health-detail-representative'];
const scoreValues = {'perception-willingness':20,'perception-feedback':4,'satisfaction-evaluation':26,'contribution-business':5,'contribution-human':3,'csp-customer-payment-ratio':2,'csp-customer-growth':1,'cloud-dealer-payment-ratio':4,'cloud-dealer-growth':0,'service-capability-ratio':8,'risk-control':-2};

const score = Object.fromEntries(Object.entries(scoreValues).map(([field,value])=>['raw-'+field,value]));

describe('伙伴健康度使用实际页面声明计算', () => {
  it.each(sources)('%s 在同一组织内相加，负数直接参与且不重复乘权重', id => {
    const rows = [{region:'甲',...score},{region:'乙',...score,'raw-perception-feedback':0}];
    const result = applyComputation(page.dataSources[id].compute!, rows);
    expect(result[0]).toMatchObject({'perception-score':24,'satisfaction-score':26,'contribution-score':23,'risk-score':-2,'total-score':71});
    expect(result[1]['total-score']).toBe(67);
    expect(rows[0]).not.toHaveProperty('total-score');
  });
  it.each(sources)('%s 部分缺项与全部缺项均按零计算', id => {
    const result = applyComputation(page.dataSources[id].compute!, [{region:'甲','raw-perception-willingness':20,'raw-risk-control':-2},{region:'乙'}]);
    expect(result[0]).toMatchObject({'perception-score':20,'satisfaction-score':0,'contribution-score':0,'risk-score':-2,'total-score':18});
    expect(result[1]).toMatchObject({'perception-score':0,'satisfaction-score':0,'contribution-score':0,'risk-score':0,'total-score':0});
  });
  it('顶部整体查询不按地区分组；中国区/海外只绑定顶部，组织层级与日期共享', () => {
    const overview = document.dataSources['health-overview'].source.query;
    expect(overview.body.dsl_list[0].output_dims).toEqual([]);
    expect(overview.body.dsl_list[0].output_metrics).toHaveLength(11);
    for (const id of sources) {
      const bindings = document.dataSources[id].source.query.filterBindings;
      expect(bindings.region.levelQueryFields).toEqual({geo:'geo_pc_name_cn','region-dept':'地区部',representative:'rep_office_name_cn_fin'});
      expect('china-overseas' in bindings).toBe(!id.startsWith('health-detail'));
    }
    expect(JSON.stringify(document)).not.toContain('"initial"');
  });
});

describe('字段求和的缺项策略与兼容边界', () => {
  it('新策略不把非法非空值或溢出伪装为零，不为无行结果造行', () => {
    const op = {op:'sumFields',fields:['a','b'],output:'total',onMissing:'zero'} as const;
    const operator = {...op,fields:[...op.fields]};
    expect(applyComputation([operator],[{a:NaN},{a:'bad'},{a:Number.MAX_VALUE,b:Number.MAX_VALUE}]).map(r=>r.total)).toEqual([null,null,null]);
    expect(applyComputation([operator],[])).toEqual([]);
    expect(applyComputation([{...operator,onMissing:'ignore'}],[{a:8,b:null},{}]).map(r=>r.total)).toEqual([8,null]);
    expect(applyComputation([{...operator,onMissing:'null'}],[{a:8,b:null}])[0].total).toBeNull();
  });
  it('新声明不能进入6.70及以下，空输入和错误策略拒绝', () => {
    for (const schemaVersion of ['6.69','6.70']) expect(parsePage({...document,schemaVersion}).ok).toBe(false);
    const invalid = structuredClone(document);
    invalid.dataSources['health-overview'].compute[0].fields = [];
    expect(parsePage(invalid).ok).toBe(false);
    invalid.dataSources['health-overview'].compute[0].fields = ['raw-perception-willingness'];
    invalid.dataSources['health-overview'].compute[0].onMissing = 'zeros';
    expect(parsePage(invalid).ok).toBe(false);
  });
});
