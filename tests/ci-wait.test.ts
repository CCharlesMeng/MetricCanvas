import {mkdtempSync, writeFileSync, readFileSync, chmodSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {describe, expect, it} from 'vitest';

const script = resolve(import.meta.dirname, '../tools/scripts/wait-ci.mjs');
const sha = 'a'.repeat(40);
function waitFixture(conclusion = 'success', headSha = sha, status = 'completed', initial = 'in_progress') {
  const dir = mkdtempSync(join(tmpdir(), 'ci-wait-test-'));
  const executable = join(dir, 'gh'), log = join(dir, 'calls.jsonl');
  writeFileSync(executable, `#!${process.execPath}
const fs=require('node:fs');const args=process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(log)},JSON.stringify(args)+'\\n');
if(args[1]==='list')console.log(JSON.stringify([{databaseId:1,headSha:${JSON.stringify(headSha)},status:${JSON.stringify(initial)},url:'https://example.test/run/1'}]));
if(args[1]==='watch'){console.log('  ✓ Build');console.log('  ✓ Build');}
if(args[1]==='view')console.log(JSON.stringify({headSha:${JSON.stringify(headSha)},status:${JSON.stringify(status)},conclusion:${JSON.stringify(conclusion)},url:'https://example.test/run/1',jobs:[{name:'ci',conclusion:${JSON.stringify(conclusion)}}]}));
`);
  chmodSync(executable, 0o755);
  try {
    const result = spawnSync(process.execPath, [script, sha], {encoding:'utf8', env:{...process.env, PATH:dir+':'+process.env.PATH}});
    const calls = readFileSync(log, 'utf8').trim().split('\n').map(line => JSON.parse(line));
    return {result, calls};
  } finally {rmSync(dir, {recursive:true,force:true});}
}

describe('one quiet CI watcher', () => {
  it('discovers once, watches once, reads the final result once and suppresses repeated progress', () => {
    const {result,calls} = waitFixture();
    expect(result.status).toBe(0);
    expect(calls.map(args => args[1])).toEqual(['list','watch','view']);
    expect(calls[0]).toContain(sha);
    expect(result.stdout.match(/✓ Build/g)).toHaveLength(1);
    expect(result.stdout).toContain('"conclusion": "success"');
  });
  it.each(['failure','cancelled'])('returns failure for a completed %s', conclusion => {
    expect(waitFixture(conclusion).result.status).toBe(1);
  });
  it('rejects a different commit before watching and rejects an unfinished final result', () => {
    const wrong = waitFixture('success', 'b'.repeat(40));
    expect(wrong.result.status).toBe(1);
    expect(wrong.calls.map(args => args[1])).toEqual(['list']);
    expect(waitFixture('success',sha,'in_progress').result.status).toBe(1);
  });
  it('reads a run that already finished without starting another watcher', () => {
    const {result,calls} = waitFixture('success',sha,'completed','completed');
    expect(result.status).toBe(0);
    expect(calls.map(args => args[1])).toEqual(['list','view']);
  });
});
