/** Development stdin/stdout driver. Production imports the built page/internal entry. */
import {runPageParameterProgram} from '../src/internal';
const chunks:Buffer[]=[];
for await(const chunk of process.stdin)chunks.push(Buffer.from(chunk));
try {
  process.stdout.write(JSON.stringify(runPageParameterProgram(JSON.parse(Buffer.concat(chunks).toString('utf8')))));
} catch {
  process.stdout.write(JSON.stringify({ok:false,issues:[{code:'INVALID_REQUEST',path:''}]}));
  process.exitCode=1;
}
