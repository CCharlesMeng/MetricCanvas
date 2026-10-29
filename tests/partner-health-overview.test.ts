import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {parsePage} from '../packages/page/src';
import {flattenPageComponents,type DataSnapshot} from '../packages/page/src/internal';
import {createSourceProgram,initialFilterValues} from '../packages/data-execution/src/runtime';
import {createPartnerHealthUnionPreview} from '../apps/playground/fixtures/organization-union/gateway';
import mock from '../apps/playground/fixtures/organization-union/mock.json';

const document=JSON.parse(readFileSync('pages/temporary/partner-health-union-null-probe/partner-health-union-null-probe.json','utf8'));
const parsed=parsePage(document);
if(!parsed.ok) throw Error(JSON.stringify(parsed.errors));
const page=parsed.page;

async function readOverview(scope:string,state='ready') {
  const preview=createPartnerHealthUnionPreview(state);
  const program=createSourceProgram(page,{gateway:preview.dataGateway});
  const conditions=initialFilterValues(page.filters??[]);
  conditions.set('china-overseas',{type:'dimension',dimension:'china-overseas',values:[scope]});
  let snapshot:DataSnapshot|undefined;
  try {
    for await(const update of program.read({roots:['health-overview'],conditions,freshness:'refresh'})) {
      if(update.sourceId==='health-overview') snapshot=update.snapshot;
    }
  } finally {program.dispose();}
  return {snapshot,requests:preview.requests};
}

describe('顶部中国区/海外整体记录的合成验收',()=>{
  it.each(['中国区','海外'] as const)('%s 使用独立整体记录，11项同范围取数',async scope=>{
    const {snapshot,requests}=await readOverview(scope);
    expect(snapshot?.status).toBe('ready');
    if(snapshot?.status!=='ready') throw Error(JSON.stringify(snapshot));
    expect(snapshot.rows).toHaveLength(1);
    expect(snapshot.rows[0]).toMatchObject({'china-overseas':scope,...mock.overview.expected[scope]});
    expect(requests).toHaveLength(11);
    for(const request of requests) {
      expect(request.sourceId).toMatch(/-overview$/);
      const body=request.body as {dsl_list:Record<string,unknown>[]};
      const item=body.dsl_list[0];
      expect(item.output_fields??item.output_dims).toContain('data_site_type');
      expect(item.output_fields??item.output_dims).not.toContain('地区部');
      expect(JSON.stringify(item.filter)).toContain(scope);
    }
  });
  it('缺项保留null，真实0保留，负分直接参与计算',async()=>{
    const {snapshot}=await readOverview('中国区');
    expect(snapshot?.status).toBe('ready');
    if(snapshot?.status!=='ready') throw Error(JSON.stringify(snapshot));
    expect(snapshot.rows[0]).toMatchObject({
      'satisfaction-evaluation':null,'contribution-business':null,'perception-feedback':0,
      'csp-customer-growth':0,'risk-score':-2,'total-score':35
    });
  });
  it('全缺项：单项与分类空，总分0',async()=>{
    const {snapshot}=await readOverview('海外','overviewMissing');
    expect(snapshot?.status).toBe('ready');
    if(snapshot?.status!=='ready') throw Error(JSON.stringify(snapshot));
    expect(snapshot.rows[0]).toMatchObject({'perception-willingness':null,'perception-feedback':null,
      'perception-score':null,'satisfaction-score':null,'contribution-score':null,'risk-score':null,'total-score':0});
  });
  it('真实全0：5张卡均为0',async()=>{
    const {snapshot}=await readOverview('中国区','overviewZero');
    expect(snapshot?.status).toBe('ready');
    if(snapshot?.status!=='ready') throw Error(JSON.stringify(snapshot));
    expect(snapshot.rows[0]).toMatchObject({'perception-score':0,'satisfaction-score':0,'contribution-score':0,'risk-score':0,'total-score':0});
  });
  it('成功无记录为空态，不制造整体记录或零分',async()=>{
    expect((await readOverview('中国区','empty')).snapshot?.status).toBe('empty');
  });
  it.each(['error','duplicate','truncated'])('%s 不输出部分或伪造整体分数',async state=>{
    expect((await readOverview('海外',state)).snapshot?.status).toBe('error');
  });
  it('保留正式页顶部布局，5张卡缺项均显式为--',()=>{
    const cards=flattenPageComponents(page).filter(component=>component.type==='metricCard');
    expect(cards).toHaveLength(5);
    for(const card of cards) {
      if(card.type!=='metricCard') throw Error('非指标卡');
      expect(card.data.main).toBe('health-overview');
      if(card.props.variant!=='compactStack') throw Error('非预期指标卡形态');
      expect(card.props.rows[0].valueField).toMatchObject({missingText:'--'});
    }
  });
});
