import {expect,it} from 'vitest';
import {parsePage} from '../src/validate';
import {hierarchyFixture} from '../../engine/runtime/tests/hierarchy-fixture';
it('accepts the literal public declaration and separates row identity from parent matching',()=>{
 const {document,page,table}=hierarchyFixture();
 expect(document.schemaVersion).toBe('6.70');expect(table.props.rowKey).toBe('row-id');
 expect(table.props.rowExpansion!.selection!.parentField).toBe('region-id');
 expect(page.dataSources['office-detail']!.fields['region-id']).toBeUndefined();
});
const invalid={
 version:(d:any)=>{d.schemaVersion='6.69';},
 reversed:(d:any)=>{const s=d.sections[0].components[0].props.rowExpansion.selection;s.parentLevel='office';s.childLevel='region-dept';},
 multiple:(d:any)=>{d.filters[0].selection.mode='multiple';},
 missingLevel:(d:any)=>{d.sections[0].components[0].props.rowExpansion.selection.childLevel='unknown';},
 noLookup:(d:any)=>{delete d.sections[0].components[0].props.rowExpansion.selection.parentLookup;},
 parentWindow:(d:any)=>{d.dataSources['region-summary'].source.query.body.dsl_list[0].order={offset:0,limit:2};},
 parentBinding:(d:any)=>{d.dataSources['region-summary'].source.query.filterBindings.region={target:'dimension',levelQueryFields:{'region-dept':'h_region',office:'h_office'}};},
 numberMatch:(d:any)=>{d.sections[0].components[0].props.rowExpansion.selection.parentField='row-id';},
 lookupShared:(d:any)=>{d.sections[0].components.push({...d.sections[0].components[0],id:'bad',data:{main:'office-region-lookup'},props:{columns:[{field:'located-region-id'}]}});},
 noSelectedInput:(d:any)=>{d.sections[0].components[0].props.rowExpansion.data.bindings['detail-office']={source:'filter',id:'year'};},
 noSelection:(d:any)=>{delete d.sections[0].components[0].props.rowExpansion.selection;},
 exportFields:(d:any)=>{d.sections[0].components[0].props.toolbar.export.rowExpansion.parentFields=['unknown'];},
 duplicateFields:(d:any)=>{d.sections[0].components[0].props.toolbar.export.rowExpansion.parentFields=['region-name','region-name'];},
 lookupWindow:(d:any)=>{d.dataSources['office-region-lookup'].source.resultScope=undefined;},
 lookupRow:(d:any)=>{d.sections[0].components[0].props.rowExpansion.selection.parentLookup.bindings['lookup-office']={source:'row',field:'region-id'};},
 privateShared:(d:any)=>{d.dataSources['region-summary'].source.query.filterBindings['lookup-office']={target:'dimension',queryField:'h_office'};}
};
it.each(Object.entries(invalid))('rejects %s with a located diagnostic',(_name,mutate)=>{
 const {document}=hierarchyFixture();mutate(document);const result=parsePage(document);
 expect(result.ok).toBe(false);if(!result.ok)expect(result.errors.every(e=>e.path.startsWith('/'))).toBe(true);
});
it('keeps old row-table capability floors and export rejection',()=>{
 const {document}=hierarchyFixture();document.schemaVersion='5.4';expect(parsePage(document).ok).toBe(false);
});
