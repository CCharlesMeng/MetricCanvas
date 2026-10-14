import assert from 'node:assert/strict';
import {execFileSync, spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {setTimeout} from 'node:timers/promises';

const [sha, ...extra] = process.argv.slice(2);
assert(/^[a-f0-9]{40}$/.test(sha ?? '') && extra.length === 0, 'Usage: node tools/scripts/wait-ci.mjs COMMIT_SHA');
const ghJson = args => JSON.parse(execFileSync('gh', args, {encoding:'utf8'}));
let run;
// A newly pushed commit can precede the workflow webhook. Discovery is bounded.
for(let attempt = 0; attempt < 3; attempt++) {
  [run] = ghJson(['run','list','--commit',sha,'--workflow','CI','--limit','1','--json','databaseId,headSha,status,url']);
  if(run) break;
  if(attempt < 2) await setTimeout(5000);
}
assert(run?.headSha === sha, 'No CI run found for the requested commit');
console.log(`CI: ${run.url}`);
if(run.status !== 'completed') {
  const watch = spawn('gh', ['run','watch',String(run.databaseId),'--interval','30','--exit-status'], {stdio:['ignore','pipe','inherit']});
  const seen = new Set();
  const lines = createInterface({input:watch.stdout});
  lines.on('line', line => {
    const clean = line.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '').trim();
    if(/^[✓X] /.test(clean) && !seen.has(clean)) {
      seen.add(clean);
      console.log(clean);
    }
  });
  await new Promise((resolve, reject) => {
    watch.on('error', reject);
    watch.on('close', resolve);
  });
}
// Only a completed run for this exact commit can produce a green result.
const final = ghJson(['run','view',String(run.databaseId),'--json','headSha,status,conclusion,url,jobs']);
assert(final.headSha === sha && final.status === 'completed', 'CI watch ended before the requested run completed');
console.log(JSON.stringify({commit:sha, url:final.url, conclusion:final.conclusion,
  jobs:final.jobs.map(job => ({name:job.name, conclusion:job.conclusion}))}, null, 2));
process.exitCode = final.conclusion === 'success' ? 0 : 1;
