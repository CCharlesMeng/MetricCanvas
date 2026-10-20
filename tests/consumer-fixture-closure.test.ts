import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {expect,it} from 'vitest';
import {copyConsumerFixtures} from '../tools/package-build/consumer-fixtures.mjs';

it('the actual isolated content service starts and serves IOC time candidates without workspace files',async()=>{
 const temporary=await mkdtemp(join(tmpdir(),'metriccanvas-consumer-closure-'));
 const consumer=join(temporary,'consumer');await mkdir(consumer);
 let processUnderTest:ReturnType<typeof spawn>|undefined;
 try{
  copyConsumerFixtures(resolve(import.meta.dirname,'..'),consumer);
  const reservation=createServer();await new Promise<void>(resolve=>reservation.listen(0,'127.0.0.1',resolve));
  const address=reservation.address();if(!address||typeof address==='string')throw Error('expected TCP port');
  await new Promise<void>((resolve,reject)=>reservation.close(error=>error?reject(error):resolve()));
  processUnderTest=spawn(process.execPath,['packages/embed/tests/serve.mjs'],{cwd:consumer,env:{...process.env,MC_EMBED_EXAMPLE_PORT:String(address.port)},stdio:['ignore','pipe','pipe']});
  let output='';
  await new Promise<void>((resolve,reject)=>{
   const deadline=setTimeout(()=>reject(Error('Content service did not start: '+output)),10000);
   const failed=(message:string)=>{clearTimeout(deadline);reject(Error(message+output));};
   processUnderTest!.once('error',error=>failed(error.message));processUnderTest!.once('exit',code=>failed('Content service exited '+code+': '));
   processUnderTest!.stderr?.on('data',chunk=>output+=chunk);
   processUnderTest!.stdout?.on('data',chunk=>{output+=chunk;if(output.includes('DQE 端点')){clearTimeout(deadline);resolve();}});
  });
  const result=await fetch(`http://127.0.0.1:${address.port}/__fixtures/filter-candidates`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({filterId:'months',calendarWindow:{granularity:'month',from:'2025-11',to:'2026-10'}})});
  expect(result.status).toBe(200);const body=await result.json();expect(body.kind).toBe('values');expect(body.candidates).toHaveLength(12);expect(body.candidates.at(-1).value).toBe('2026-10');
 }finally{
  if(processUnderTest&&processUnderTest.exitCode===null){const closed=new Promise<void>(resolve=>processUnderTest!.once('exit',()=>resolve()));processUnderTest.kill();await closed;}
  await rm(temporary,{recursive:true,force:true});
 }
},15000);
