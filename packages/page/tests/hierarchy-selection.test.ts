import {expect,it} from 'vitest';
import {parsePage} from '../src/validate';
import {hierarchyFixture} from '../../engine/runtime/tests/hierarchy-fixture';
it('accepts the literal public declaration and separates row identity from parent matching',()=>{
 const {document,page,table}=hierarchyFixture();
 expect(document.schemaVersion).toBe('6.81');expect(table.props.rowKey).toBe('row-id');
 expect(table.props.rowExpansion!.selection!.parentField).toBe('region-id');
 expect(page.dataSources['office-detail']!.fields['region-id']).toBeUndefined();
});
function mainTable(document:any){return document.sections.flatMap((section:any)=>section.components).find((component:any)=>component.type==='table');}
const invalid={
 version:(d:any)=>{d.schemaVersion='6.69';},
 reversed:(d:any)=>{const s=mainTable(d).props.rowExpansion.selection;s.parentLevel='office';s.childLevel='region-dept';},
 multiple:(d:any)=>{d.filters[0].selection.mode='multiple';},
 missingLevel:(d:any)=>{mainTable(d).props.rowExpansion.selection.childLevel='unknown';},
 noLookup:(d:any)=>{delete mainTable(d).props.rowExpansion.selection.parentLookup;},
 parentWindow:(d:any)=>{d.dataSources['region-summary'].source.query.body.dsl_list[0].order={offset:0,limit:2};},
 parentBinding:(d:any)=>{d.dataSources['region-summary'].source.query.filterBindings.region={target:'dimension',levelQueryFields:{'region-dept':'h_region',office:'h_office'}};},
 numberMatch:(d:any)=>{mainTable(d).props.rowExpansion.selection.parentField='row-id';},
 lookupShared:(d:any)=>{d.sections[0].components.push({...mainTable(d),id:'bad',data:{main:'office-region-lookup'},props:{columns:[{field:'located-region-id'}]}});},
 noSelectedInput:(d:any)=>{mainTable(d).props.rowExpansion.data.bindings['detail-office']={source:'filter',id:'year'};},
 noSelection:(d:any)=>{delete mainTable(d).props.rowExpansion.selection;},
 exportFields:(d:any)=>{mainTable(d).props.toolbar.export.rowExpansion.parentFields=['unknown'];},
 duplicateFields:(d:any)=>{mainTable(d).props.toolbar.export.rowExpansion.parentFields=['region-name','region-name'];},
 lookupWindow:(d:any)=>{d.dataSources['office-region-lookup'].source.resultScope=undefined;},
 lookupRow:(d:any)=>{mainTable(d).props.rowExpansion.selection.parentLookup.bindings['lookup-office']={source:'row',field:'region-id'};},
 privateShared:(d:any)=>{d.dataSources['region-summary'].source.query.filterBindings['lookup-office']={target:'dimension',queryField:'h_office'};}
};
it.each(Object.entries(invalid))('rejects %s with a located diagnostic',(_name,mutate)=>{
 const {document}=hierarchyFixture();mutate(document);const result=parsePage(document);
 expect(result.ok).toBe(false);if(!result.ok)expect(result.errors.every(e=>e.path.startsWith('/'))).toBe(true);
});
it('keeps old row-table capability floors and export rejection',()=>{
 const {document}=hierarchyFixture();document.schemaVersion='5.4';expect(parsePage(document).ok).toBe(false);
});
