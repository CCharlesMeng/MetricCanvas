/** Trusted program-to-program channel. Full documents stay on stdin/stdout, never in a model message. */
import {extractPageParams,applyPageParamSelection,resolvePageParams} from '../src/index';
const chunks:Buffer[]=[];for await(const chunk of process.stdin)chunks.push(Buffer.from(chunk));
try {
  const request=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(request.action==='resolve') {
    const result=resolvePageParams(request.document,request.suppliedValues);
    process.stdout.write(JSON.stringify(result.ok?{...result,effectiveInputs:Object.fromEntries(result.effectiveInputs)}:result));
  } else if(request.action==='prepare') {
    const extraction=extractPageParams(request.document,request.context);
    if(!extraction.ok)process.stdout.write(JSON.stringify(extraction));
    else {
      const selected=request.selectedIds??extraction.candidates.filter(c=>c.defaultSelected).map(c=>c.id);
      const result=applyPageParamSelection(extraction,selected,request.textReplacements);
      process.stdout.write(JSON.stringify(result.ok?{...result,baseline:extraction.baseline,sourceKey:extraction.sourceKey,candidates:extraction.candidates,skipped:extraction.skipped,selectedIds:selected}:result));
    }
  } else throw Error('未知程序操作');
}catch(error){process.stdout.write(JSON.stringify({ok:false,issues:[{code:'INVALID_REQUEST',path:'',message:String(error)}]}));process.exitCode=1;}
