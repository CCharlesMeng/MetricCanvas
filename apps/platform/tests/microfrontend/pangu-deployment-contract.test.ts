import {copyFileSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {expect, it} from 'vitest';

it('compiles a standalone deployment consumer using only the portable declaration', () => {
  const directory = mkdtempSync(join(tmpdir(), 'pangu-deployment-types-'));
  try {
    copyFileSync(new URL('../../src/lib/integration/contract.ts', import.meta.url), join(directory, 'portal-contract.d.ts'));
    writeFileSync(join(directory, 'adapter.ts'), `
import type {PlatformDeploymentAdapter, PanguDeployment, ReadPanguDeployment, PlatformDialogueAdapter} from './portal-contract';
let config: PanguDeployment | null = {resourceUrl:'/sdk.js',version:'release-1'};
const readPanguDeployment: ReadPanguDeployment = () => config;
const legacy: PlatformDialogueAdapter = {async mount(_element) {return () => {};}};
const adapter: PlatformDeploymentAdapter = {
  contractVersion:'1',
  connect() { return {props:{routeBase:'/metrics',readConfig:()=>null,configChanges:'reload',readPanguDeployment}}; }
};
const custom: PlatformDeploymentAdapter = {
  contractVersion:'1',
  connect() { return {props:{routeBase:'/metrics',readConfig:()=>null,configChanges:'reload',dialogueAdapter:legacy}}; }
};
// @ts-expect-error Configuration reading is synchronous; SDK readiness belongs in mount.
const asyncReader: ReadPanguDeployment = async () => ({resourceUrl:'/sdk.js',version:'1'});
config = null;
Object.assign(window,{MetricCanvasDeploymentAdapter:adapter,legacyDeployment:custom});
`);
    writeFileSync(join(directory, 'tsconfig.json'), JSON.stringify({
      compilerOptions:{strict:true, noEmit:true, target:'ES2022', module:'ESNext', moduleResolution:'Bundler', types:[], lib:['ES2022','DOM']},
      files:['adapter.ts', 'portal-contract.d.ts']
    }));
    const compiler = fileURLToPath(new URL('../../../../node_modules/typescript/bin/tsc', import.meta.url));
    expect(execFileSync(process.execPath, [compiler, '-p', directory], {cwd:directory, encoding:'utf8'})).toBe('');
  } finally { rmSync(directory, {recursive:true, force:true}); }
});
