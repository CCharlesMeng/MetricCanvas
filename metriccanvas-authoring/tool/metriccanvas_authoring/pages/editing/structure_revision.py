"""Atomic stable-ID revisions of an immutable structure candidate."""
from copy import deepcopy
from jsonschema import Draft202012Validator
from metriccanvas_authoring.pages.composition.structure_preflight import inspect_plan
from metriccanvas_authoring.pages.validation.page_validation import validate_page_document
from metriccanvas_authoring.pages.composition.structure_composition import compose_structure

from metriccanvas_authoring.runtime_assets import bundle_root
import json

REVISION_SCHEMA = json.loads((bundle_root() / 'contracts/authored/structure-revision.schema.json').read_text())


async def revise_structure(parent, request, dependencies, *, current):
    def fail(code):
        return {'status': 'failed', 'document': None, 'operations': [], 'issues': [{'code': code, 'path': '/structureRevision'}]}
    if not parent: return fail('STRUCTURE_REVISION_INVALID')
    if not Draft202012Validator(REVISION_SCHEMA).is_valid(request):
        from metriccanvas_authoring.pages.composition.structure_diagnostics import schema_issues
        version=request.get('structureRevision',{}).get('planVersion') if isinstance(request,dict) and isinstance(request.get('structureRevision'),dict) else None
        schema=next((s for s in REVISION_SCHEMA['oneOf'] if s['properties']['structureRevision']['properties']['planVersion']['const']==version),REVISION_SCHEMA)
        return {**fail('STRUCTURE_REVISION_INVALID'), 'issues':[
            {**i,'code':'STRUCTURE_REVISION_INVALID'} for i in schema_issues(schema,request)[:50]]}
    revision = request['structureRevision']
    entries = [o['state'] for o in parent['operations'] if o.get('type') == 'structure_state']
    if not entries or entries[-1]['plan']['version'] != revision['planVersion']: return fail('STRUCTURE_PLAN_VERSION_MISMATCH')
    if parent['workVersion'] != revision['parentVersion']: return fail('STRUCTURE_PARENT_VERSION_MISMATCH')
    state = deepcopy(entries[-1]); plan = state['plan']; document = deepcopy(parent['document'])
    changed_blocks, changed_sources, scope_sections = set(), set(), set()
    def section(id): return next(s for s in plan['sections'] if s['id'] == id)
    def visible(id): return next(s for s in document['sections'] if s['id'] == id)
    def block(id): return next((s,b) for s in plan['sections'] for b in s['blocks'] if b['id'] == id)
    try:
        for patch in revision['patches']:
            kind = patch['type']
            if kind == 'replace-request':
                r = patch['request']; pos = next(i for i,x in enumerate(plan['dataRequests']) if x['dataSourceId']==r['dataSourceId'])
                if plan['dataRequests'][pos] != r:
                    plan['dataRequests'][pos] = deepcopy(r); changed_sources.add(r['dataSourceId'])
            elif kind == 'replace-block':
                s,b = block(patch['blockId'])
                if patch['block']['id'] != b['id']: return fail('STRUCTURE_BLOCK_ID_CONFLICT')
                s['blocks'][s['blocks'].index(b)] = deepcopy(patch['block'])
                changed_blocks.add(b['id']); scope_sections.add(s['id'])
            elif kind == 'set-section':
                s = section(patch['sectionId']); s.update(deepcopy(patch['changes']))
                visible(s['id']).update({k:v for k,v in patch['changes'].items() if k in {'title','container'}})
                if s.get('title', False) is None:
                    s.pop('title'); visible(s['id']).pop('title',None)
                if 'pattern' in patch['changes']: changed_blocks.update(b['id'] for b in s['blocks'])
            elif kind == 'move-section':
                s=section(patch['sectionId']); target=patch.get('beforeId')
                if target == s['id']: continue
                for items,item in [(plan['sections'],s),(document['sections'],visible(s['id']))]:
                    items.remove(item); pos = next(i for i,x in enumerate(items) if x['id']==target) if target else len(items)
                    items.insert(pos,item)
            elif kind in {'move-block','remove-block'}:
                s,b=block(patch['blockId']); v=visible(s['id'])
                c=next(c for c in v['components'] if c['id']==b['id'])
                s['blocks'].remove(b); v['components'].remove(c); scope_sections.add(s['id'])
                if kind == 'move-block':
                    target=section(patch['sectionId']); target['blocks'].append(b)
                    dest=visible(target['id']); pos=next((i for i,x in enumerate(dest['components']) if x['id']=='structure-scope-'+target['id']),len(dest['components']))
                    dest['components'].insert(pos,c); scope_sections.add(target['id'])
        for s in plan['sections']:
            for b in s['blocks']:
                if b.get('source') in changed_sources: changed_blocks.add(b['id']); scope_sections.add(s['id'])
        used={b['source'] for s in plan['sections'] for b in s['blocks'] if b.get('source')}
        plan['dataRequests']=[r for r in plan['dataRequests'] if r['dataSourceId'] in used]
        check=inspect_plan(plan)
        if check['issues']: return {**fail('STRUCTURE_REVISION_CONFLICT'), 'issues':check['issues']}
        # Manual operations may remove a generated component while retaining its plan.
        # Reject that stale target before executing any query, preserving the parent.
        for s in plan['sections']:
            if any(b['id'] in changed_blocks for b in s['blocks']):
                ids = {c['id'] for c in visible(s['id'])['components']}
                if any(b['id'] in changed_blocks and b['id'] not in ids and
                       'structure-missing-' + b['id'] not in ids for b in s['blocks']):
                    return fail('STRUCTURE_TARGET_NOT_FOUND')
    except (StopIteration, KeyError, ValueError): return fail('STRUCTURE_TARGET_NOT_FOUND')
    counts={'executed':0,'reused':0}; adjustments=[]
    if changed_blocks:
        fragment=deepcopy(plan)
        fragment['sections']=[{**s,'blocks':[b for b in s['blocks'] if b['id'] in changed_blocks]} for s in plan['sections']]
        fragment['sections']=[s for s in fragment['sections'] if s['blocks']]
        required={b['source'] for s in fragment['sections'] for b in s['blocks'] if b.get('source')}
        fragment['dataRequests']=[r for r in plan['dataRequests'] if r['dataSourceId'] in required]
        result=await compose_structure(document['id'],'revision',document.get('layout','report'),fragment,dependencies,current=current,cached=state['queries'])
        if result['status'] != 'changed': return {**result,'status':'failed','document':None}
        for s in result['document']['sections'][1:]:
            dest=visible(s['id'])
            for c in s['components']:
                if c['id'] not in changed_blocks: continue
                pos=next(i for i,x in enumerate(dest['components']) if x['id'] in {c['id'],'structure-missing-'+c['id']})
                # Preserve manual layout unless this patch explicitly changes semantic width.
                previous=dest['components'][pos]
                width_changed=any(p['type']=='replace-block' and p['blockId']==c['id'] and 'width' in p['block'] for p in revision['patches'])
                pattern_changed=any(p['type']=='set-section' and p['sectionId']==s['id'] and 'pattern' in p['changes'] for p in revision['patches'])
                if not width_changed and not pattern_changed: c['layout']=deepcopy(previous['layout'])
                replaced=any(p['type']=='replace-block' and p['blockId']==c['id'] for p in revision['patches'])
                if replaced and previous['type']==c['type']:
                    from metriccanvas_authoring.pages.composition.page_structure import block_component
                    from metriccanvas_authoring.pages.components.structure_presentation import preserve_unedited
                    original=entries[-1]
                    old_section,old_block=next((s,b) for s in original['plan']['sections'] for b in s['blocks'] if b['id']==c['id'])
                    old_generated=block_component(old_block,parent['document']['dataSources'],old_section['pattern'],
                        relations=original['relations'].get(old_block.get('source'),[]))
                    c['props']=preserve_unedited(previous['props'],old_generated['props'],c['props'])
                if not replaced:
                    generated_bindings={'rows','series','columns','xField','categoryField','valueField'}
                    c['props'].update({k:deepcopy(v) for k,v in previous.get('props',{}).items() if k not in generated_bindings})
                dest['components'][pos]=c
        document['dataSources'].update(result['document']['dataSources'])
        state['queries'].update(result['structureState']['queries']); state['relations'].update(result['structureState']['relations'])
        counts=result['queryCounts']; adjustments=result['appliedAdjustments']
    # Retain sources referenced anywhere, including untouched manual nested components.
    def references(value):
        if isinstance(value,dict):
            if isinstance(value.get('data'),dict): yield from value['data'].values()
            for x in value.values(): yield from references(x)
        elif isinstance(value,list):
            for x in value: yield from references(x)
    bound={x for x in references(document['sections']) if isinstance(x,str)}
    document['dataSources']={k:v for k,v in document['dataSources'].items() if k in bound}
    from metriccanvas_authoring.pages.composition.structure_scope import refresh_scope
    refresh_scope(document,plan)
    if validate_page_document(document): return fail('STRUCTURE_REVISION_RESULT_INVALID')
    await current()
    return {'status':'changed' if document != parent['document'] else 'unchanged','document':document if document != parent['document'] else None,
            'operations':[],'issues':[],'structureState':state,'queryCounts':counts,'appliedAdjustments':adjustments,
            'overlapFindings':check['overlapFindings']}
