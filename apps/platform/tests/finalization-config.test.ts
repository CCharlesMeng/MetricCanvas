import {expect, it, vi} from 'vitest';
import {createInjectedDqeGateway, readRuntimeConfig, readPageAssetsRuntimeConfig, type InjectedRuntimeConfig} from '@metriccanvas/application-runtime';
import type {FinalizationSourceDefinition} from '@metriccanvas/engine';
import {resolveFinalizationDates} from '../../../packages/data-execution/src/finalization';
import type {FilterDeclaration} from '@metriccanvas/page/internal';

it('keeps finalization query configuration in the portal path and reads transport identity at request time', async () => {
  const source: FinalizationSourceDefinition = {body: {dsl_list: [{output_dims:['名称','日期'],filter:{}}]}, nameField:'名称', dateField:'日期'};
  const config: InjectedRuntimeConfig = {dqeEndpoint:'https://example.test/dqe',pageMetadataBaseUrl:'https://example.test/pages',authToken:'initial-token',operatorId:'operator',workspaceId:'workspace'};
  const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    expect(new Headers(init?.headers).get('X-Auth-Token')).toBe('updated-token');
    return new Response(JSON.stringify({retCode:'CBC.0000',results:[{code:'SUCCESS',data:[{'名称':'经营数据','日期':'2026-10-18'}],total_count:1}]}));
  });
  const gateway = createInjectedDqeGateway(fetchImpl, undefined, () => config);
  config.finalizationSource = source; config.authToken = 'updated-token';
  expect(readRuntimeConfig(() => config)?.finalizationSource).toEqual(source);
  expect(readPageAssetsRuntimeConfig(() => config)?.finalizationSource).toEqual(source);
  const filters: FilterDeclaration[] = [{id:'period',type:'timeRange',display:'period',default:{mode:'month',finalizationName:'经营数据'}}];
  const dates = await resolveFinalizationDates({id:'portal-page',filters}, gateway, new Date(2026,10,9));
  expect(dates.get('经营数据')).toBe('2026-10-18'); expect(fetchImpl).toHaveBeenCalledTimes(1);
});
