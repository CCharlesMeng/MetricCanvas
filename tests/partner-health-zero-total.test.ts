import {readFileSync} from 'node:fs';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {parsePage} from '../packages/page/src/index';
import {isQueryDataSource, type DataSnapshot, type DataSource} from '../packages/page/src/internal';
import {computedSnapshots, createSourceProgram, initialFilterValues, resolveQueryResultInputs, type SourceRead, type SourceUpdate} from '../packages/data-execution/src/runtime';
import {createPartnerHealthUnionPreview} from '../apps/playground/fixtures/organization-union/gateway';

const parsed = parsePage(JSON.parse(readFileSync('pages/temporary/partner-health.json', 'utf8')));
if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
const page = parsed.page;

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

async function readScores(grain: string, state: string, purpose: SourceRead['purpose'] = 'screen') {
  const root = `health-scores-${grain}`;
  const program = createSourceProgram(page, {gateway: createPartnerHealthUnionPreview(state).dataGateway});
  const updates = new Map<string, SourceUpdate>();
  try {
    for await (const update of program.read({roots: [root], conditions: initialFilterValues(page.filters ?? []), purpose})) {
      updates.set(update.sourceId, update);
    }
    return {snapshot: updates.get(root)?.snapshot, updates};
  } finally { program.dispose(); }
}

function rows(snapshot: DataSnapshot | undefined) {
  expect(snapshot?.status).toBe('ready');
  if (snapshot?.status !== 'ready') throw Error(JSON.stringify(snapshot));
  return snapshot.rows;
}

it.each(['region', 'representative'])('%s：零总数响应仍生成组织、分类和总分，并保留原始计数诊断', async grain => {
  const expected = await readScores(grain, 'ready');
  const actual = await readScores(grain, 'zeroTotal');
  expect(rows(actual.snapshot)).toEqual(rows(expected.snapshot));
  expect(actual.snapshot).toMatchObject({status: 'ready', totalCount: 15});
  expect(rows(actual.snapshot).find(row => row.region === 'ORG-06')?.['total-score']).toBe(6);
  const source = actual.updates.get(`perception-willingness-score-${grain}`);
  expect(source?.raw).toMatchObject({status: 'ready', totalCount: 0});
  expect(source?.initial).toBeUndefined();
  expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('TOTAL_COUNT_MISMATCH'), expect.objectContaining({totalCount: 0, completeness: 'unverified'}));
});

it('兼容显示不会放宽对象完整读取的计数要求', async () => {
  await expect(readScores('region', 'zeroTotal', 'complete')).rejects.toThrow('object 完整结果行数超过 totalCount');
});

it('对象主源和关联源均为零总数时可显示，但原始回执仍不能驱动结果绑定', () => {
  const source=page.dataSources['perception-willingness-score-region'];
  if(!isQueryDataSource(source))throw Error('测试需要对象查询');
  const field='perception-willingness-rate';
  const primary:DataSource={...source,fields:{...source.fields,joined:{type:'number',role:'measure'}},compute:[{
    op:'joinAggregate',source:'aux',keys:[{local:'region',foreign:'region'}],
    values:[{field,output:'joined',aggregate:'unique'}],onMissing:'null'
  }]};
  const sources=new Map([['main',primary],['aux',source]]);
  const raw=new Map<string,DataSnapshot>([
    ['main',{status:'ready',rows:[{region:'test-org',[field]:0}],totalCount:0}],
    ['aux',{status:'ready',rows:[{region:'test-org',[field]:-2}],totalCount:0}]
  ]);
  expect(computedSnapshots(sources,raw,undefined,{allowZeroTotal:true}).get('main')).toMatchObject({status:'ready',totalCount:0,rows:[{region:'test-org',joined:-2}]});
  expect(computedSnapshots(sources,raw).get('main')?.status).toBe('error');
  const consumer=structuredClone(source);
  consumer.source.query.resultBindings=[{source:'aux',field:'region',target:'dimension',queryField:'组织',maxValues:10}];
  expect(resolveQueryResultInputs(consumer,raw,sources)).toMatchObject({status:'terminal',snapshot:{status:'error'}});
});
