import {createHash} from 'node:crypto';
import {expect,it} from 'vitest';
import {bundleLockOutputs} from '../tools/scripts/bundle-lock';
const identity={bundleVersion:'test',pageSchemaVersion:'6.114'};
const artifact=(file:string)=>({file,sha256:'a'.repeat(64)});
it('separates owners, preserves all hashes and keeps deterministic bounded roots and groups',()=>{
  const artifacts=['contracts/a','contract-snapshot/b','mc-content/a','skill/local/a','tool/a','core/a','scripts/a','README.md'].map(artifact);
  const outputs=bundleLockOutputs(identity,artifacts),index=JSON.parse(outputs.get('bundle.lock.json')!);
  expect(index).toMatchObject({lockVersion:2,...identity});expect(index.artifacts).toBeUndefined();
  const combined=index.groups.flatMap((group:{file:string;sha256:string})=>{
    const content=outputs.get(group.file)!;
    expect(Buffer.byteLength(content)).toBeLessThanOrEqual(1_000_000);
    expect(createHash('sha256').update(content).digest('hex')).toBe(group.sha256);
    return JSON.parse(content).artifacts;
  });
  expect(index.groups.map((group:{id:string})=>group.id)).toEqual(['contracts','distribution','mc-content','runtime','skill-local']);
  expect(combined.sort((a:{file:string},b:{file:string})=>a.file.localeCompare(b.file))).toEqual([...artifacts].sort((a,b)=>a.file.localeCompare(b.file)));
  expect([...bundleLockOutputs(identity,[...artifacts].reverse())]).toEqual([...outputs]);
});
it('refuses an oversized owner instead of cutting it into arbitrary numbered pieces',()=>{
  const artifacts=Array.from({length:7000},(_,index)=>artifact('mc-content/'+String(index).padStart(5,'0')+'x'.repeat(100)));
  expect(()=>bundleLockOutputs(identity,artifacts)).toThrow(/refine its ownership boundary/);
});
