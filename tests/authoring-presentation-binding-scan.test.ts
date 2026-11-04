import {describe,expect,it} from 'vitest';
import {scanPresentationBindings} from '../metriccanvas-authoring/core/page/data-scan';
import {pageSchema} from '../packages/page/src/schema';

describe('product Schema presentation binding discovery',()=>{
  it('includes every display binding in badges, changes and conditional cases',()=>{
    const component={id:'ranking',type:'rankingDetailCard',data:{main:'values'},layout:{span:12},props:{
      nameField:'name',valueField:'value',changeField:{data:'main',field:'change'},
      badgeFields:['badge',{byFilter:{filterId:'period',cases:{'a/b':'first','c~d':{data:'main',field:'second'}}}}],
      details:{field:'details',titleField:'title',valueField:{field:'amount'}}
    }};
    const bindings=scanPresentationBindings(component,pageSchema,'/ranking');
    expect(bindings.map(entry=>entry.path)).toEqual([
      '/ranking/props/nameField','/ranking/props/valueField','/ranking/props/changeField',
      '/ranking/props/badgeFields/0','/ranking/props/badgeFields/1/byFilter/cases/a~1b',
      '/ranking/props/badgeFields/1/byFilter/cases/c~0d','/ranking/props/details/field'
    ]);
    expect(bindings.at(-2)?.binding).toEqual({data:'main',field:'second'});
    expect(bindings[4]?.binding).toBe('first');
  });

  it('includes pinned display fields while leaving row keys and interaction references to their owners',()=>{
    const component={id:'table',type:'table',data:{main:'values',summary:'summary'},layout:{span:12},props:{
      rowKey:'key',columns:[{field:'value',secondaryField:'secondary',badgeField:'badge',
        pinnedTop:{field:{data:'summary',field:'total'},secondaryField:{data:'summary',field:'change'},badgeField:{data:'summary',field:'label'}},
        selection:{writes:{selected:{field:'key'}}}}],
      rowExpansion:{data:{type:'query',source:'child'},table:{columns:[{field:'nested'}]}},
      components:[{id:'nested',type:'table',props:{columns:[{field:'nested'}]}}]
    }};
    expect(scanPresentationBindings(component,pageSchema).map(entry=>entry.path).sort()).toEqual([
      '/props/columns/0/field','/props/columns/0/secondaryField','/props/columns/0/badgeField',
      '/props/columns/0/pinnedTop/field','/props/columns/0/pinnedTop/secondaryField','/props/columns/0/pinnedTop/badgeField'
    ].sort());
  });
});
