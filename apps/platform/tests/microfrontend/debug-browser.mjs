import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve, join, extname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium, expect} from '../../../../packages/embed/node_modules/@playwright/test/index.mjs';

const require = createRequire(new URL('../../package.json', import.meta.url));
const {SourceMapConsumer} = require(require.resolve('source-map-js', {paths: [require.resolve('vite')]}));
const qiankun = readFileSync(process.env.QIANKUN_DIST || require.resolve('qiankun/dist/index.umd.js'));
const release = resolve('apps/platform/dist/microfrontend-debug');
const manifest = JSON.parse(readFileSync(join(release, 'release.json'), 'utf8'));
expect(manifest.profile).toBe('debug');
const temporary = mkdtempSync(join(tmpdir(), 'platform-debug-browser-'));
const unpacked = join(temporary, 'downloaded');
mkdirSync(unpacked);
execFileSync('tar', ['-xzf', resolve(`apps/platform/dist/metriccanvas-platform-${manifest.version}-debug.tar.gz`), '-C', unpacked]);
const map = JSON.parse(readFileSync(join(unpacked, 'assets/platform.umd.js.map'), 'utf8'));
const consumer = new SourceMapConsumer(map);
const targets = [
  {suffix: '/src/microfrontend/entry.ts', statement: 'const connection=await connectPortal'},
  {suffix: '/PlatformRoot.svelte', statement: 'untrack(()=>setContext'}
].map(({suffix, statement}) => {
  const index = map.sources.findIndex(source => source.endsWith(suffix));
  expect(index).toBeGreaterThanOrEqual(0);
  const line = map.sourcesContent[index].split('\n').findIndex(line => line.includes(statement)) + 1;
  expect(line).toBeGreaterThan(0);
  const generated = consumer.generatedPositionFor({source: map.sources[index], line, column: 0, bias: SourceMapConsumer.LEAST_UPPER_BOUND});
  expect(generated.line).not.toBeNull();
  return {source: map.sources[index], line, generated};
});
const prefixes = ['/releases/debug-one/', '/static/nested/debug-two/'];
const host = `<!doctype html><style>html,body{height:100%;margin:0}#container{height:800px}</style>
<div id="container"></div><script src="/qiankun.js"></script><script>
window.ready=0;window.connectionCounts={open:0,closed:0};
window.run=async(entry,fail=false)=>{
 window.micro=qiankun.loadMicroApp({name:entry.includes('debug-one')?'metriccanvas-debug-one':'metriccanvas-debug-two',entry,container:'#container',props:{
  appList:[{appUrl:'/metrics'}],roleList:['reader'],routeBase:fail?'invalid':'/metrics',
  readConfig:()=>null,configChanges:'reload',onEvent(event){if(event.code==='ready')window.ready++;}
 }},{sandbox:true});await micro.mountPromise;
};
window.stop=async()=>{await micro.unmount();};
</script>`;
// An adapter compiled by the deployment project is represented by a classic script fixture.
const adapter = join(temporary, 'adapter.js');
writeFileSync(adapter, `window.MetricCanvasDeploymentAdapter={contractVersion:'1',connect(input){
 window.connectionCounts.open++;
 if(input.appList[0].appUrl!=='/metrics'||input.roleList[0]!=='reader')throw Error('Missing portal props');
 return {props:input,disconnect(){window.connectionCounts.closed++;}};
}};`);
const composed = join(temporary, 'composed');
execFileSync(process.execPath, [join(unpacked, 'pack-deployment.mjs'), unpacked, adapter, composed], {cwd: temporary});
const requests = [];
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://local').pathname;
  requests.push(path);
  try {
    let body;
    const prefix = prefixes.find(prefix => path.startsWith(prefix));
    if (path === '/qiankun.js') body = qiankun;
    else if (prefix) body = readFileSync(join(composed, path.slice(prefix.length)));
    else if (extname(path)) {res.writeHead(404);res.end();return;}
    else body = host;
    res.setHeader('Content-Type', path.endsWith('.map') ? 'application/json' : path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html');
    res.end(body);
  } catch {res.writeHead(404);res.end();}
});
let browser;
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({headless:true});
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const cdp = await page.context().newCDPSession(page);
  const parsed = [];
  const hits = [];
  let probeError;
  const breakpoints = new Map();
  cdp.on('Debugger.scriptParsed', event => {
    if(event.url.endsWith('/assets/platform.umd.js')) parsed.push(event);
  });
  cdp.on('Debugger.paused', async event => {
    try {
      const target = breakpoints.get(event.hitBreakpoints?.[0]);
      if (target) {
        const frame = event.callFrames[0];
        const original = consumer.originalPositionFor({line:frame.location.lineNumber+1, column:frame.location.columnNumber});
        expect(original.source).toBe(target.source);
        expect(original.line).toBe(target.line);
        if (target.source.endsWith('/entry.ts')) {
          const result = await cdp.send('Debugger.evaluateOnCallFrame', {callFrameId:frame.callFrameId, expression:'JSON.stringify({appList:props.appList,roleList:props.roleList})', returnByValue:true});
          expect(JSON.parse(result.result.value)).toEqual({appList:[{appUrl:'/metrics'}],roleList:['reader']});
        }
        hits.push({source:original.source, line:original.line});
      }
    } catch(error) {probeError = error;}
    finally {await cdp.send('Debugger.resume');}
  });
  await cdp.send('Debugger.enable');
  await page.goto(`${origin}/metrics/manage`);
  for(const target of targets) {
    const result = await cdp.send('Debugger.setBreakpointByUrl', {
      urlRegex:'platform\\.umd\\.js$', lineNumber:target.generated.line-1, columnNumber:target.generated.column
    });
    breakpoints.set(result.breakpointId, target);
  }
  for (const prefix of prefixes) {
    const before = hits.length;
    await page.evaluate(entry => run(entry), `${prefix}index.html`);
    if (probeError) throw probeError;
    await expect(page.getByTestId('platform-app')).toBeVisible();
    expect(hits.length).toBeGreaterThanOrEqual(before+2);
    const script = parsed.at(-1);
    expect(script.url).toBe(`${origin}${prefix}assets/platform.umd.js`);
    expect(script.sourceMapURL).toBe('platform.umd.js.map');
    const mapUrl = new URL(script.sourceMapURL, script.url).href;
    const response = await page.request.get(mapUrl);
    expect(response.status()).toBe(200);
    expect((await response.json()).sources).toEqual(map.sources);
    const wrapped = (await cdp.send('Debugger.getScriptSource', {scriptId:script.scriptId})).scriptSource;
    expect(wrapped).toContain('with(this)');
    // The loader prefixes its wrapper on the same first line. Application mappings remain aligned.
    expect(wrapped.split('\n').length).toBeGreaterThan(1000);
    await page.evaluate(() => stop());
    await expect(page.getByTestId('platform-app')).toHaveCount(0);
  }
  expect(await page.evaluate(() => ({ready, connectionCounts}))).toEqual({ready:2, connectionCounts:{open:2,closed:2}});
  const stack = await page.evaluate(async entry => {
    try {await run(entry,true);throw Error('Expected invalid routeBase to fail');}
    catch(error) {return error.stack;}
  }, `${prefixes[1]}index.html`);
  const generatedFrame = stack.match(/platform\.umd\.js:(\d+):(\d+)/);
  expect(generatedFrame).not.toBeNull();
  const stackSource = consumer.originalPositionFor({line:Number(generatedFrame[1]),column:Number(generatedFrame[2])-1});
  expect(stackSource.source).toMatch(/\/integration\/navigation\.ts$/);
  expect(stackSource.line).toBeGreaterThan(0);
  expect(errors).toEqual([]);
  for(const prefix of prefixes) expect(requests).toContain(`${prefix}assets/platform.css`);
  expect((await page.request.get(`${origin}${prefixes[0]}assets/missing.js`)).status()).toBe(404);
  console.log(JSON.stringify({status:'PASS', qiankun:'2.10.16', browser:browser.version(), sourceMap:parsed.map(script=>({script:script.url,map:script.sourceMapURL})), breakpointHits:hits, stackSource, evidence:'Downloaded debug archive + external adapter composition, real qiankun proxy sandbox, TS/Svelte generated breakpoints mapped to original lines, error stack mapped to TS, portal props, two static prefixes, unmount/remount, production-compiled readable output; synthetic portal only'}));
} finally {
  await browser?.close();
  if(server.listening) await new Promise(resolve => server.close(resolve));
  rmSync(temporary, {recursive:true,force:true});
}
