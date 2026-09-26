"""Discovery-to-query regressions using the actual MCP surface and provider mapping."""
import json
import unittest
import test_dataset_metadata_http as provider_tests
from copy import deepcopy
from dataclasses import replace
from pathlib import Path
from unittest.mock import patch
from test_dataset_metadata_http import (PROJECTION, SemanticCatalog,
    create_platform_server, Turns, Authorization, Client, dependencies, query_request)


class QueryValidationPolicyTest(unittest.IsolatedAsyncioTestCase):
    setUp = provider_tests.DatasetMetadataHttpTest.setUp
    make = provider_tests.DatasetMetadataHttpTest.make
    # Only run these scenarios; the inherited provider suite remains in its own module.
    async def test_discover_dimensions_and_uppercase_time_then_query(self):
        self.payload['dataset_details'][0]['logical_schema']['field_schema']['dimensions'][1]['dimension_type'] = 'StrDateTypeDimension'
        provider = self.make(projection=PROJECTION)
        deps = replace(dependencies(), data_context=provider)
        server = create_platform_server(deps, current_turns=Turns('new'), store=self.store,
            analysis_authorization=Authorization(), semantic_catalog=SemanticCatalog(provider, self.store))
        async with Client(server) as client:
            found = (await client.call_tool('discover_data_context', {'context_ref':'current-context','query':'Tokens'})).structured_content['modelSummary']
            self.assertIn('businessDomain', found['matches'][0])
            dims = (await client.call_tool('discover_data_context', {'context_ref':'current-context','query':'统计周期'})).structured_content['modelSummary']
            self.assertIn('month', dims['matches'][0]['granularities'])
            request = query_request(); request['dataContextVersion'] = found['dataContextVersion']
            request['requests'][0]['businessDomain'] = found['matches'][0]['businessDomain']
            request['requests'][0]['time']['granularity'] = 'M'
            result = (await client.call_tool('query_data', {'context_ref':'current-context','request':request})).structured_content['modelSummary']
            self.assertEqual(result['validationMode'], 'relaxed')
            self.assertEqual(result['results'][0]['status'], 'ready', result)
            self.assertEqual(result['results'][0]['scope']['time']['granularity'], 'month')
            self.assertEqual(deps.dqe.calls[0]['body']['dsl_list'][0]['filter']['time']['period'], 'month')

    async def test_hot_switch_isolates_failures_and_result_reuse(self):
        config = Path(self.tmp.name)/'validation.json'
        config.write_text(json.dumps({'queryValidation':{'strict':True}}))
        # A supported DQE month, but incomplete metadata claims only day.
        dims = self.payload['dataset_details'][0]['logical_schema']['field_schema']['dimensions']
        dims[1]['hierarchies'][0]['levels'] = [{'levelType':'dayLevel'}]
        provider = self.make(projection=PROJECTION); deps = replace(dependencies(),data_context=provider)
        server = create_platform_server(deps,current_turns=Turns('new'),store=self.store,analysis_authorization=Authorization())
        with patch.dict('os.environ', {'METRICCANVAS_QUERY_VALIDATION_CONFIG':str(config)}):
            async with Client(server) as client:
                request=query_request(); request['dataContextVersion']=(await provider.current())['version']
                async def run():
                    return (await client.call_tool('query_data',{'context_ref':'current-context','request':request})).structured_content['modelSummary']
                strict=await run()
                self.assertEqual(strict['results'][0]['issues'][0]['code'],'TIME_GRANULARITY_NOT_IN_DATA_CONTEXT')
                self.assertEqual(strict['results'][0]['issues'][0]['candidates'],['day'])
                self.assertEqual(len(deps.dqe.calls),0)
                config.write_text(json.dumps({'queryValidation':{'strict':False}}))
                relaxed=await run()
                self.assertEqual(relaxed['results'][0]['status'],'ready',relaxed)
                self.assertNotEqual(strict['results'][0]['resultRef'],relaxed['results'][0]['resultRef'])
                self.assertEqual(len(deps.dqe.calls),1)
                self.assertTrue(relaxed['results'][0]['warnings'])
                config.write_text(json.dumps({'queryValidation':{'strict':True}}))
                self.assertEqual((await run())['results'][0]['status'],'failed')
                self.assertEqual(len(deps.dqe.calls),1)

    async def test_relaxed_projection_preserves_unknown_governance(self):
        from metriccanvas_authoring.data.validation_policy import QueryValidationPolicy
        value=deepcopy(PROJECTION)
        metric=self.payload['dataset_details'][0]['logical_schema']['field_schema']['metrics'][0]
        metric.pop('aggregator',None); metric.pop('is_agg',None)
        metric.pop('additivity',None); metric.pop('timeAggregation',None)
        value=replace(value,metric_governance={k:{n:{p:v for p,v in g.items() if p not in ('additivity','timeAggregation','isRatio')} for n,g in entries.items()} for k,entries in value.metric_governance.items()},defaults={k:v for k,v in value.defaults.items() if k!='isRatio'})
        provider=self.make(projection=value)
        snap=await provider.current_for_query(QueryValidationPolicy())
        projected=snap['executionEnvironments'][0]['schemas'][0]['metrics'][0]
        self.assertNotIn('additivity',projected)
        self.assertNotIn('timeAggregation',projected)
        with self.assertRaises(Exception) as caught:
            await provider.current_for_query(QueryValidationPolicy(strict=True))
        self.assertEqual(caught.exception.code, 'DATA_CONTEXT_GOVERNANCE_REQUIRED')


    async def test_normalized_scope_is_authorized_and_region_survives(self):
        provider=self.make(projection=PROJECTION); deps=replace(dependencies(),data_context=provider)
        class ExactAuthorization(Authorization):
            seen=[]
            async def authorize(self,binding,request,version):
                self.seen.append(deepcopy(request))
                return await super().authorize(binding,request,version)
        auth=ExactAuthorization()
        server=create_platform_server(deps,current_turns=Turns('new'),store=self.store,analysis_authorization=auth)
        async with Client(server) as client:
            request=query_request();request['dataContextVersion']=(await provider.current())['version']
            unit=request['requests'][0];unit['businessDomain']='operations-dataset'
            unit['metrics'][0]['name']='调用次数';unit['filters']=[{'dimension':'大区','values':['中国区']}]
            unit['time'].update(granularity='M',start='202601',end='202606')
            result=(await client.call_tool('query_data',{'context_ref':'current-context','request':request})).structured_content['modelSummary']
            self.assertEqual(result['results'][0]['status'],'ready',result)
            self.assertEqual(auth.seen[0]['businessDomain'],'运营分析')
            self.assertEqual(auth.seen[0]['time']['granularity'],'month')
            self.assertEqual(auth.seen[0]['filters'],[{'dimension':'区域','values':['中国区']}])
            effective=deps.dqe.calls[0]['body']['dsl_list'][0]
            self.assertEqual(effective['filter']['dims'],[{'dim_name':'区域','dim_value_list':['中国区']}])
            self.assertEqual(effective['filter']['time'],{'period':'month','start':'202601','end':'202606'})

    async def test_default_relaxed_missing_governance_reaches_execution(self):
        from metriccanvas_authoring.data.validation_policy import QueryValidationPolicy
        metric=self.payload['dataset_details'][0]['logical_schema']['field_schema']['metrics'][0]
        for key in ('additivity','timeAggregation','isRatio'):metric.pop(key,None)
        projection=replace(PROJECTION,metric_governance={},defaults={k:v for k,v in PROJECTION.defaults.items() if k!='isRatio'})
        provider=self.make(projection=projection);deps=replace(dependencies(),data_context=provider)
        server=create_platform_server(deps,current_turns=Turns('new'),store=self.store,analysis_authorization=Authorization(),semantic_catalog=SemanticCatalog(provider,self.store))
        async with Client(server) as client:
            found=(await client.call_tool('discover_data_context',{'context_ref':'current-context','query':'Tokens'})).structured_content['modelSummary']
            request=query_request();request['dataContextVersion']=found['dataContextVersion']
            result=(await client.call_tool('query_data',{'context_ref':'current-context','request':request})).structured_content['modelSummary']
            self.assertEqual(result['results'][0]['status'],'ready',result)
            self.assertTrue(any(w['code']=='DATA_CONTEXT_GOVERNANCE_UNKNOWN' for w in result['results'][0]['warnings']))
            self.assertEqual(len(deps.dqe.calls),1)

    async def test_config_errors_and_denied_authorization_never_execute(self):
        provider=self.make(projection=PROJECTION);deps=replace(dependencies(),data_context=provider)
        auth=Authorization();auth.allowed=False
        server=create_platform_server(deps,current_turns=Turns('new'),store=self.store,analysis_authorization=auth)
        async with Client(server) as client:
            request=query_request();request['dataContextVersion']=(await provider.current())['version']
            for mode,expected in [('false','MODEL_EVIDENCE_UNAVAILABLE'),('true','MODEL_EVIDENCE_UNAVAILABLE'),('typo','QUERY_VALIDATION_CONFIG_ERROR')]:
                with patch.dict('os.environ',{'METRICCANVAS_QUERY_VALIDATION_STRICT':mode}):
                    result=(await client.call_tool('query_data',{'context_ref':'current-context','request':request})).structured_content
                    self.assertFalse(result['ok'],result)
                    self.assertEqual(result['modelSummary']['issues'][0]['code'],expected)
            self.assertEqual(deps.dqe.calls,[])

    async def test_batch_policy_is_fixed_and_relaxed_evidence_cannot_compose_as_strict(self):
        import asyncio
        from metriccanvas_authoring.pages.platform_authoring import PlatformAuthoring
        config=Path(self.tmp.name)/'live.json';config.write_text('{"queryValidation":{"strict":false}}')
        provider=self.make(projection=PROJECTION);deps=replace(dependencies(),data_context=provider)
        entered=asyncio.Event();release=asyncio.Event();base_dqe=deps.dqe
        class BlockingDqe:
            async def execute(self,query):
                entered.set();await release.wait();return await base_dqe.execute(query)
        app=PlatformAuthoring(replace(deps,dqe=BlockingDqe()),Turns('new'),self.store,analysis_authorization=Authorization())
        request=query_request();request['dataContextVersion']=(await provider.current())['version']
        with patch.dict('os.environ',{'METRICCANVAS_QUERY_VALIDATION_CONFIG':str(config)}):
            task=asyncio.create_task(app.query('current-context',request))
            await asyncio.wait_for(entered.wait(),2)
            config.write_text('{"queryValidation":{"strict":true}}');release.set()
            result=await task
            self.assertEqual(result['validationMode'],'relaxed')
            ref=result['results'][0]['resultRef']
            read=await app.query('current-context',result_ref=ref)
            self.assertEqual(read['results'][0]['validationMode'],'relaxed')
            prepared=await app.prepare('current-context')
            with self.assertRaisesRegex(Exception,'RESULT_VALIDATION_POLICY_CHANGED'):
                await app.results.require(prepared,ref,app.current(prepared))

    async def test_relaxed_checks_use_typed_declarations_and_preserve_unknowns(self):
        from metriccanvas_authoring.data.query import create_query_data, QueryDataDependencies
        from metriccanvas_authoring.data.validation_policy import QueryValidationPolicy
        from adapters.fakes import FakeDataContextPort, FakeDqeExecutionPort
        from metriccanvas_authoring.data.execution import DqeExecutionResult
        snap=await self.make(projection=PROJECTION).current()
        schema=snap['executionEnvironments'][0]['schemas'][0]
        # Metric catalogue missing, but a trusted measure declaration exists.
        schema['metrics']=[]
        schema['objects'][0]['fields'].append({'name':'Tokens请求量','type':'number','roleHints':['measure'],
            'description':'Declared executable measure','nullable':False,'sensitive':False})
        schema['objects'][0]['fields'][0]['description']='取值域:华东。'
        spec={'question':'中国区上半年总量','dataContextVersion':snap['version'],
              'units':[{**query_request()['requests'][0],'intent':'detail','pinnedComponent':'table'}]}
        spec['units'][0]['filters']=[{'dimension':'区域','values':['中国区']}]
        for strict in (False,True):
            dqe=FakeDqeExecutionPort(DqeExecutionResult(rows=[{'区域':'中国区','Tokens请求量':1}]))
            result=await create_query_data(QueryDataDependencies(FakeDataContextPort(snap),dqe,
                validation_policy=QueryValidationPolicy(strict=strict)))(spec)
            self.assertEqual(result.ok,not strict,result.issues)
            if not strict:
                self.assertEqual({w['code'] for w in result.warnings},
                    {'METRIC_CATALOG_ENTRY_MISSING','METRIC_DIMENSION_COMPATIBILITY_UNKNOWN','DIMENSION_VALUE_NOT_IN_DATA_CONTEXT'})
                self.assertEqual(dqe.calls[0]['body']['dsl_list'][0]['filter']['dims'][0]['dim_value_list'],['中国区'])
            else:self.assertEqual(dqe.calls,[])
        spec['units'][0]['metrics'][0]['name']='无可信字段声明'
        result=await create_query_data(QueryDataDependencies(FakeDataContextPort(snap),dqe))(spec)
        self.assertFalse(result.ok)
        self.assertEqual(result.issues[0].code,'METRIC_NOT_IN_DATA_CONTEXT')

    async def test_invalid_governance_and_missing_sensitive_still_block(self):
        from metriccanvas_authoring.data.validation_policy import QueryValidationPolicy
        original=deepcopy(self.payload)
        for property,value in [('isRatio','not-a-bool'),('additivity','invalid')]:
            self.payload=deepcopy(original)
            self.payload['dataset_details'][0]['logical_schema']['field_schema']['metrics'][0][property]=value
            for strict in (False,True):
                with self.assertRaises(Exception) as caught:
                    await self.make(projection=PROJECTION).current_for_query(QueryValidationPolicy(strict=strict))
                self.assertEqual(caught.exception.code,'DATA_CONTEXT_GOVERNANCE_REQUIRED')
        self.payload=original
        projection=replace(PROJECTION,defaults={'nullable':False})
        with self.assertRaises(Exception) as caught:
            await self.make(projection=projection).current_for_query(QueryValidationPolicy())
        self.assertEqual(caught.exception.code,'DATA_CONTEXT_GOVERNANCE_REQUIRED')

    async def test_lab_version_is_independent_of_validation_mode(self):
        from test_data_context_http import create_port, RoutingTransport
        from metriccanvas_authoring.data.validation_policy import QueryValidationPolicy
        port=create_port(RoutingTransport())
        strict=await port.current_for_query(QueryValidationPolicy(strict=True))
        relaxed=await port.current_for_query(QueryValidationPolicy())
        self.assertEqual(strict['version'],relaxed['version'])
        self.assertNotIn('queryValidationView',strict)
        self.assertEqual(relaxed['queryValidationView'],'1')
