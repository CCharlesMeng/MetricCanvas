import {readFileSync,writeFileSync} from 'node:fs';
import {parsePage} from '../../../../packages/page/src';
import type {DataSnapshot} from '../../../../packages/page/src/internal';
import {createSourceProgram,initialFilterValues} from '../../../../packages/data-execution/src/runtime';
import {createPartnerHealthUnionPreview} from '../../../../apps/playground/fixtures/organization-union/gateway';

const parsed=parsePage(JSON.parse(readFileSync('pages/temporary/partner-health-union-null-probe/partner-health-union-null-probe.json','utf8')));
if(!parsed.ok) throw Error(JSON.stringify(parsed.errors));
const page=parsed.page;
const results=[];
for(const scope of ['中国区','海外']) {
  const preview=createPartnerHealthUnionPreview();
  const program=createSourceProgram(page,{gateway:preview.dataGateway});
  const conditions=initialFilterValues(page.filters??[]);
  conditions.set('china-overseas',{type:'dimension',dimension:'china-overseas',values:[scope]});
  let snapshot:DataSnapshot|undefined;
  try {
    for await(const update of program.read({roots:['health-overview'],conditions,freshness:'refresh'})) {
      if(update.sourceId==='health-overview') snapshot=update.snapshot;
    }
  } finally {program.dispose();}
  const body={dsl_list:preview.requests.flatMap(request=>(request.body as {dsl_list:unknown[]}).dsl_list)};
  const name=scope==='中国区'?'china':'overseas';
  writeFileSync(new URL(`requests-${name}.candidate.json`,import.meta.url),JSON.stringify(body,null,2)+'\n');
  results.push({scope,snapshot,requests:preview.requests});
}
writeFileSync(new URL('result.json',import.meta.url),JSON.stringify({data:'synthetic',realDqe:'not_run',results},null,2)+'\n');
