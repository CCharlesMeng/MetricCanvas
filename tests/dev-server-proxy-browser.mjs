import {createServer as createHttpServer} from 'node:http';
import {once} from 'node:events';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'vite';
import {chromium, expect} from '../packages/embed/node_modules/@playwright/test/index.mjs';
import playgroundConfig from '../apps/playground/vite.config.ts';
import platformConfig from '../apps/platform/vite.config.ts';

// Run from the repository root: node --import tsx tests/dev-server-proxy-browser.mjs
// Synthetic upstream only; domain/443/HTTPS and real Windows/gray remain separate acceptance.
const root = process.cwd();
const output = resolve(root, '.scratch/cloudioc-proxy/evidence');
await mkdir(output, {recursive: true});
const doc = JSON.parse(await readFile(resolve(root, 'pages/business/report/sdt/business-sdt-report-monthly.json'), 'utf8'));
const receipt = {retCode: 'CBC.0000', page_id: doc.id, page_metadata_id: 'metadata-proxy',
  revision_id: 'revision-proxy', revision_number: 1, is_draft: true, page_metadata_definition: JSON.stringify(doc)};
const dqePath = '/rest/cdi/cdinl2databuilderservice/v1/dsl/execute';
const received = [];
let activeApp;
let rejectDqe = false;
const upstream = createHttpServer(async (request, response) => {
  let body = '';
  for await (const chunk of request) body += chunk;
  received.push({app: activeApp, url: request.url, cftk: request.headers.cftk, cookie: request.headers.cookie});
  response.setHeader('content-type', 'application/json');
  if (request.url.startsWith(dqePath)) {
    if (rejectDqe) {response.statusCode = 401; response.end(JSON.stringify({retCode:'AUTH_REQUIRED'})); return;}
    const payload = JSON.parse(body);
    response.end(JSON.stringify({retCode: 'CBC.0000', results: payload.dsl_list.map(item => ({
      code: 'SUCCESS', total_count: 1, data: [Object.fromEntries([
        ...(item.output_dims ?? []).map(key => [key, key.includes('账期') ? '2026-10' : '本地合成样本']),
        ...(item.output_metrics ?? []).map(key => [key, 12])
      ])]
    }))}));
  } else if (request.url.includes('/user-page-metadata?')) {
    response.end(JSON.stringify({retCode:'CBC.0000',total:1,page_metadata_list:[receipt]}));
  } else response.end(JSON.stringify(receipt));
});
upstream.listen(0, '127.0.0.1'); await once(upstream, 'listening');
const target = `http://127.0.0.1:${upstream.address().port}`;
let browser;
const facts = [];
const platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform');
try {
  browser = await chromium.launch({headless: true, channel: 'chrome'});
  for (const [app, configFactory] of [['playground', playgroundConfig], ['platform', platformConfig]]) {
    activeApp = app;
    const appRoot = resolve(root, `apps/${app}`);
    const prefix = `${app.toUpperCase()}_CLOUDIOC`;
    process.env[prefix] = 'true'; process.env[`${prefix}_CFTK`] = 'synthetic-cftk';
    process.env[`${prefix}_COOKIE`] = 'session=synthetic; route=fixture';
    process.chdir(appRoot);
    let config;
    try {
      Object.defineProperty(process, 'platform', {value: 'win32'});
      config = await configFactory({command: 'serve', mode: 'development'});
    } finally { Object.defineProperty(process, 'platform', platformDescriptor); }
    const proxyPath = app === 'playground' ? dqePath : '/rest/cdi/cdinl2databuilderservice/';
    const server = await createServer({...config, root: appRoot, configFile: false,
      plugins: config.plugins.filter(plugin => plugin?.name !== 'vite:basic-ssl'),
      server: {...config.server, host: '127.0.0.1', port: 0, strictPort: false,
        proxy: {[proxyPath]: {...config.server.proxy[proxyPath], target}}}});
    let page;
    try {
      await server.listen();
      const base = `http://127.0.0.1:${server.httpServer.address().port}`;
      page = await browser.newPage({viewport:{width:1440,height:1000}});
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + (app === 'playground' ? `/pages/${doc.id}` : '/manage'));
      if (app === 'playground') {
        await expect.poll(() => received.filter(r => r.app === app && r.url.startsWith(dqePath)).length).toBeGreaterThan(0);
        await expect(page.getByText('12.00', {exact:true}).first()).toBeVisible();
      } else {
        await expect(page.getByRole('link', {name:doc.id, exact:true})).toBeVisible();
      }
      const before = received.length;
      const status = await page.evaluate(async path => (await fetch(path + '?probe=1', {method:'POST',
        headers:{'content-type':'application/json'},body:JSON.stringify({dsl_list:[{output_metrics:['probe'],output_dims:[]}]})})).status, dqePath);
      expect(status).toBe(200);
      expect(received.slice(before)).toEqual(expect.arrayContaining([expect.objectContaining({
        app, url:dqePath+'?probe=1', cftk:'synthetic-cftk', cookie:'session=synthetic; route=fixture'
      })]));
      rejectDqe = true;
      const rejected = await page.evaluate(async path => (await fetch(path, {method:'POST',body:'{}'})).status, dqePath);
      expect(rejected).toBe(401); rejectDqe = false;
      for (const request of received.filter(request => request.app === app)) {
        expect(request).toMatchObject({cftk:'synthetic-cftk', cookie:'session=synthetic; route=fixture'});
      }
      expect(errors).toEqual([]);
      await page.screenshot({path: resolve(output, `${app}.png`), fullPage:true});
      facts.push({app, entry:app === 'playground' ? `/pages/${doc.id}` : '/manage',
        pageErrors: errors, forwarded: received.filter(r => r.app === app).length,
        syntheticCftkAndCookie: true, unauthorizedStatus: rejected});
    } finally { await page?.close(); await server.close(); process.chdir(root); }
  }
  await writeFile(resolve(output, 'result.json'), JSON.stringify({browser:browser.version(),
    boundary:'Local synthetic upstream; Windows config evaluated on macOS; HTTP loopback replaces domain/443/HTTPS. No real gray acceptance.',facts},null,2));
  console.log(JSON.stringify(facts));
} finally {
  process.chdir(root); Object.defineProperty(process,'platform',platformDescriptor);
  await browser?.close(); upstream.closeAllConnections(); await new Promise(resolve => upstream.close(resolve));
}
