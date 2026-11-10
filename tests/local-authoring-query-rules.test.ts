import { describe, expect, it } from 'vitest';
import { buildRuleBindings, rulesForOwners, findRules, showRule, componentSchemaOwner } from '../tools/scripts/local-authoring-query-rules';
import type { QueryKnowledge } from '../tools/scripts/local-authoring-query-types';

function fixture(): QueryKnowledge {
  return {schemaVersion:'6.107',schema:{definitions:{box:{properties:{type:{const:'box'}}},value:{type:'object'}}},nodes:[],topics:{},
    modules:{boxes:{file:'boxes.md',title:'Boxes',semantics:[],examples:[],rules:[
      {id:'binding-unique',description:'Bindings are unique within their owning box',valid:['box-example'],invalid:['box-duplicate']}
    ]}}};
}

describe('precise product rule associations', () => {
  it('resolves component owners through the component slot despite duplicate discriminator values', () => {
    const model=fixture();
    model.schema.definitions={
      legend:{properties:{type:{const:'box'}}},
      box:{properties:{type:{const:'box'}}},
      section:{properties:{components:{items:{oneOf:[{$ref:'#/definitions/box'}]}}}}
    };
    expect(componentSchemaOwner(model,'box')).toBe('box');
    expect(componentSchemaOwner(model,'missing')).toBeUndefined();
    expect(componentSchemaOwner(fixture(),'box')).toBeUndefined();
  });
  it('derives wording and witnesses from product rules and attaches only registered owners', () => {
    const model=fixture();
    model.ruleBindings=buildRuleBindings(model,{'binding-unique':{owners:['box','value']}});
    expect(rulesForOwners(model,['box'])).toEqual([{id:'rule:binding-unique',description:'Bindings are unique within their owning box'}]);
    expect(rulesForOwners(model,['other'])).toEqual([]);
    expect(findRules(model,{owner:'box',query:'unique'}).items).toHaveLength(1);
    expect(showRule(model,{id:'rule:binding-unique'})).toMatchObject({complete:true,owners:['box','value']});
    expect(showRule(model,{id:'rule:binding-unique',select:'counterexample'}).items).toEqual([
      {file:'references/page-metadata/errors/box-duplicate.json',purpose:'invalid contract witness; not a reusable page'}
    ]);
  });

  it('fails unknown rule and owner references at generation and keeps old knowledge readable', () => {
    expect(()=>buildRuleBindings(fixture(),{missing:{owners:['box']}})).toThrow('Unknown authoring rule');
    expect(()=>buildRuleBindings(fixture(),{'binding-unique':{owners:['missing']}})).toThrow('Unknown owner');
    expect(rulesForOwners(fixture(),['box'])).toEqual([]);
    expect(()=>showRule(fixture(),{id:'rule:missing'})).toThrow('Unknown rule');
  });
});
