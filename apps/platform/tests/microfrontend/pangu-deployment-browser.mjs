import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFileSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve, extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {composeDeployment} from '../../scripts/compose-deployment.mjs';
import {chromium, expect} from '../../../../packages/embed/node_modules/@playwright/test/index.mjs';

const profile = process.env.MICROFRONTEND_PROFILE || 'production';
if (!['production', 'debug'].includes(profile)) throw Error('Invalid MICROFRONTEND_PROFILE');
const platform = resolve(`apps/platform/dist/microfrontend${profile === 'debug' ? '-debug' : ''}`);
const directory = mkdtempSync(resolve(tmpdir(), 'pangu-deployment-browser-'));
const output = resolve(directory, 'composed');
const adapter = new URL('./fixtures/pangu-deployment-adapter.js', import.meta.url);
const qiankun = createRequire(import.meta.url).resolve('qiankun/dist/index.umd.js');
const report = [];
const sdk = `window.receipts.loaded++;
window.pangu={instance(){return {
  renderChat(selector){window.receipts.mounted++;document.querySelector(selector).textContent='合成盘古对话';},
  destroy(){window.receipts.destroyed++;}
};}};`;
const host = `<!doctype html><meta charset="utf-8"><title>Pangu deployment fixture</title>
<style>html,body,#container{height:100%;margin:0}</style><div id="container"></div>
<script src="/qiankun.js"></script><script>
window.receipts={read:0,loaded:0,mounted:0,destroyed:0,disconnected:0};
const mode=new URL(location.href).searchParams.get('mode');
window.__METRICCANVAS_PANGU__={resourceUrl:mode==='legacy'?'/sdk.js':'/wrong-sdk.js',version:'legacy'};
const deployment=mode==='empty'?null:mode==='undefined'?undefined:{resourceUrl:'/sdk.js',version:'injected'};
const platformProps={routeBase:'/metrics',readConfig:()=>null,configChanges:'reload'};
qiankun.registerMicroApps([{name:'metriccanvas',entry:'/release/index.html',container:'#container',
 activeRule:location=>location.pathname.startsWith('/metrics/'),
 props:{mode,deployment,receipts:window.receipts,platformProps}}]);
window.leave=()=>history.pushState({},'','/outside');
qiankun.start({prefetch:false,sandbox:true});</script>`;

function serve(req, res) {
  const url = new URL(req.url, 'http://fixture');
  const path = url.pathname;
  try {
    let body;
    if (path === '/qiankun.js') body = readFileSync(qiankun);
    else if (path === '/sdk.js') body = sdk;
    else if (path.startsWith('/release/')) body = readFileSync(resolve(output, path.slice(9)));
    else if (extname(path)) { res.writeHead(404); res.end(); return; }
    else body = host;
    const mime = path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html';
    res.setHeader('Content-Type', `${mime}; charset=utf-8`);
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
}

async function verifyScenario(browser, origin, mode) {
  const page = await browser.newPage();
  const errors = [], resources = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.url().includes('sdk.js')) resources.push(request.url()); });
  try {
    await page.goto(`${origin}/metrics/create?mode=${mode}`);
    await page.getByRole('button', {name:'新建页面', exact:true}).click();
    await expect(page.getByTestId('workbench')).toBeVisible();
    if (['empty', 'undefined', 'throw'].includes(mode)) {
      const message = mode === 'throw' ? '盘古部署配置读取失败' : '未配置盘古静态资源地址和版本号';
      await expect(page.getByTestId('chat-unavailable')).toContainText(message);
      await expect(page.getByTestId('chat-unavailable')).not.toContainText('private-reader-diagnostic');
      expect(resources).toEqual([]);
    } else {
      await expect(page.getByText(mode === 'custom' ? '部署自有对话' : '合成盘古对话', {exact:true})).toBeVisible();
      expect(resources).toEqual(mode === 'custom' ? [] : [`${origin}/sdk.js?v=${mode === 'legacy' ? 'legacy' : 'injected'}`]);
    }
    await page.evaluate(() => window.leave());
    await expect(page.getByTestId('workbench')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => window.receipts.disconnected)).toBe(1);
    const receipts = await page.evaluate(() => window.receipts);
    const mounted = ['injected', 'legacy', 'custom'].includes(mode) ? 1 : 0;
    expect(receipts).toEqual({read:mode === 'legacy' || mode === 'custom' ? 0 : 1,
      loaded:mode === 'legacy' || mode === 'injected' ? 1 : 0, mounted, destroyed:mounted, disconnected:1});
    expect(errors).toEqual([]);
    report.push({mode, receipts, resources, status:'PASS'});
  } finally { await page.close(); }
}

let browser;
const server = createServer(serve);
try {
  composeDeployment({platform, adapter:fileURLToPath(adapter), output});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({headless:true});
  for (const mode of ['injected', 'legacy', 'custom', 'empty', 'undefined', 'throw']) {
    await verifyScenario(browser, origin, mode);
  }
  console.log(JSON.stringify({profile, sdk:'synthetic', qiankun:'2.10.16', targetPortal:'NOT_RUN', scenarios:report}, null, 2));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  rmSync(directory, {recursive:true, force:true});
}
