import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parsePage, type Page } from '@metriccanvas/page/internal';
import { compilePresentation } from '../src/presentation';
import type { FilterValues } from '../src/filter-state';
import { createFilterState, initialFilterValues } from '../src/filter-state';
import { filterGroupOptions } from '@metriccanvas/page/internal';
const document=JSON.parse(readFileSync(new URL('../../../../pages/filter-group-state-page.json',import.meta.url),'utf8'));
function page():Page {const result=parsePage(document);if(!result.ok)throw new Error(JSON.stringify(result.errors));return result.page;}
it('uses the shared presentation policy, leaves filter values intact, and restores the original choice',()=>{
 const p=page(),state=createFilterState(initialFilterValues(p.filters??[]),p.filters,filterGroupOptions(p));
 let filters:FilterValues=initialFilterValues(p.filters??[]);const stop=state.subscribe(value=>filters=value);
 const program=compilePresentation(p),current=()=>program.evaluate({filters});
 state.write('channel',{type:'dimension',dimension:'chart_demo_region',values:['OVERSEAS']});
 state.write('scope',{type:'dimension',dimension:'scope',values:['OVERSEAS']});
 expect(current().component('channel-filter').eligible).toBe(false);
 expect(current().component('trend').eligible).toBe(false);
 expect(current().component('orders-metric').eligible).toBe(true);
 expect(filters.get('channel')).toMatchObject({values:['OVERSEAS']});
 state.write('scope',{type:'dimension',dimension:'scope',values:['DOMESTIC']});
 expect(current().component('channel-filter').eligible).toBe(true);
 expect(filters.get('channel')).toMatchObject({values:['OVERSEAS']});stop();
});
it('combines declaration and component gates, and lets an ancestor hide the nested control',()=>{
 const p=page();p.filters![1]!.visible=false;
 const filters=initialFilterValues(p.filters??[]);
 expect(compilePresentation(p).evaluate({filters}).component('channel-filter').eligible).toBe(false);
 const card=p.sections[3]!.components[0]!;card.visibleWhen={permission:'card'};
 expect(compilePresentation(p).evaluate({filters}).component('card-filter').eligible).toBe(false);
});
