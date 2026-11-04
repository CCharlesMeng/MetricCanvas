import {readFileSync} from 'node:fs';
import {runAnalysisOperation} from './authoring-analysis-program';
import {runPresentationOperation} from '../../metriccanvas-authoring/core/presentation/operation';
import {rawSha256} from './authoring-analysis-adapter';

/** Local file wrapper, bundled by the same product builder; stdout candidates only. */
function main(args:string[]):number {
  const [operation,pageFlag,page,inputFlag,inputFile]=args;
  if(!['page.analyze','page.rebind','page.presentation'].includes(operation!) || pageFlag!=='--page' || inputFlag!=='--input' || !page || !inputFile || args.length!==5) {
    process.stderr.write('Usage: node associate-data.mjs page.analyze|page.rebind|page.presentation --page page.json --input association.json\n');return 3;
  }
  try {
    const documentJson=readFileSync(page,'utf8'),input=JSON.parse(readFileSync(inputFile,'utf8'));
    const baseline={source:'file',documentSha256:rawSha256(documentJson)};
    const result=operation==='page.presentation'
      ?runPresentationOperation({...input,document:JSON.parse(documentJson)})
      :runAnalysisOperation(operation!,{...input,documentJson,baseline});
    process.stdout.write(JSON.stringify(result)+'\n');
    return result.status==='error'?2:0;
  } catch(cause) {process.stderr.write(String(cause)+'\n');return 3;}
}
process.exitCode=main(process.argv.slice(2));
