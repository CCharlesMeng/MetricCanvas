import { chromium, expect } from '../../../../packages/embed/node_modules/@playwright/test/index.mjs';
import { mkdir } from 'node:fs/promises';
const root = process.env.S1_BASE_URL || 'http://127.0.0.1:5181';
const relay = process.env.S1_RELAY_URL || 'http://127.0.0.1:5192';
const call = async (path, body = {}) => { const response = await fetch(`${relay}/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); const result = await response.json(); if (!response.ok) throw Error(JSON.stringify(result)); return result; };
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage(), errors = [], events = [];
page.on('pageerror', (error) => errors.push(error.message));
await page.exposeFunction('captureDraftEvent', (detail) => events.push(detail));
await page.addInitScript(() => window.addEventListener('metriccanvas:draft-saved', (event) => window.captureDraftEvent(event.detail)));
let readFailure = false, slowCommitted = false;
await page.route('**/__fixtures/language/**', async (route) => {
  const endpoint = route.request().url().split('/').at(-1);
  if (endpoint === 'read' && readFailure) { await route.abort(); return; }
  try {
    const response = await route.fetch({ url: `${relay}/${endpoint}` });
    if (endpoint === 'run' && route.request().postDataJSON().prompt === 'slow-new') { slowCommitted = true; await new Promise(resolve => setTimeout(resolve, 700)); }
    await route.fulfill({ response });
  } catch { await route.abort().catch(() => {}); }
});
const canvas = page.getByRole('main', { name: '页面画布', exact: true });
const status = page.getByTestId('language-status');
async function run(mode) { await page.getByLabel('替身语言场景').fill(mode); await page.getByRole('button', { name: '执行语言场景' }).click(); }
async function fresh() { await call('reset'); await page.goto(root+'/language'); await page.evaluate(async () => { indexedDB.deleteDatabase('metriccanvas-authoring'); }); await page.reload(); }
try {
  await fresh();
  await run('invalid'); await expect(status).toContainText('没有保存'); expect((await call('metrics')).saves).toBe(0);
  await expect(canvas.getByText('从页面目录打开页面', { exact: true })).toBeVisible();
  await run('create'); await expect(status).toContainText('已保存并读回'); await expect(canvas.getByText('Private body')).toBeVisible();
  expect((await call('metrics')).saves).toBe(1);
  await run('partial'); await expect(status).toContainText('已保存并读回'); await expect(canvas.getByText('partial', { exact: true })).toBeVisible();
  await expect(page.getByLabel('本轮操作结果')).toContainText('bad：failed'); await expect(page.getByLabel('本轮操作结果')).toContainText('dependent：skipped');
  expect((await call('metrics')).saves).toBe(2);
  const old = (await call('metrics')).notifications[0];
  for (const mode of ['text','waiting','failed','invalid']) { await run(mode); await expect(status).toContainText('没有保存'); await expect(canvas.getByText('partial', { exact: true })).toBeVisible(); }
  expect((await call('metrics')).saves).toBe(2);
  await run('lost-ack'); await expect(status).toContainText('结果待确认'); await expect(canvas.getByText('partial', { exact: true })).toBeVisible();
  expect((await call('metrics')).saves).toBe(3);
  await page.getByRole('button', { name: '查询本轮保存结果' }).click(); await expect(status).toContainText('已保存并读回'); await expect(canvas.getByText('lost-ack', { exact: true })).toBeVisible();
  expect((await call('metrics')).saves).toBe(3);
  readFailure=true; await run('read-retry'); await expect(status).toContainText('Failed to fetch'); await expect(canvas.getByText('lost-ack', { exact: true })).toBeVisible();
  readFailure=false; await page.getByRole('button', { name: '查询本轮保存结果' }).click(); await expect(status).toContainText('已保存并读回'); await expect(canvas.getByText('read-retry', { exact: true })).toBeVisible();
  const beforeConflict = await call('metrics');
  await run('conflict'); await expect(status).toContainText('没有保存'); await expect(canvas.getByText('read-retry', { exact: true })).toBeVisible();
  expect((await call('metrics')).revisions).toBe(beforeConflict.revisions);
  const before=(await call('metrics')).saves;
  await run('offline'); await expect(status).toContainText('结果待确认'); expect((await call('metrics')).saves).toBe(before);
  await page.getByRole('button', { name: '停止接收本轮结果' }).click();
  await page.getByRole('button', { name: '查询本轮保存结果' }).click(); await expect(status).toContainText('已确认本轮未保存');
  await run('slow'); await expect(status).toContainText('处理中');
  await expect(page.getByLabel('保存时保留维度取值')).toBeDisabled();
  await page.evaluate((draftId) => window.dispatchEvent(new CustomEvent('metriccanvas:draft-saved',{detail:{draftId}})),old);
  // First old notification during a new round must not be accepted as current.
  await expect(status).toContainText('已保存并读回'); await expect(canvas.getByText('slow', { exact:true })).toBeVisible();
  await run('slow-new'); await expect(status).toContainText('处理中'); await expect.poll(() => slowCommitted).toBe(true); await page.getByRole('button',{name:'停止接收本轮结果'}).click();
  await expect(status).toContainText('停止本地接收');
  await page.getByRole('button',{name:'查询本轮保存结果'}).click(); await expect(status).toContainText('取消后服务已保存');
  await expect(canvas.getByText('slow', { exact:true })).toBeVisible();
  await page.getByRole('button',{name:'查看取消后已保存修订'}).click(); await expect(page.getByText('正在预览已保存修订')).toBeVisible(); await expect(canvas.getByText('slow-new', { exact: true })).toBeVisible(); await expect(canvas.getByText('加载精确修订…')).toHaveCount(0);
  await mkdir('/private/tmp/metriccanvas-s1-evidence',{recursive:true}); await page.screenshot({path:'/private/tmp/metriccanvas-s1-evidence/t20-cancelled-saved.png'});
  expect(events.length).toBeGreaterThan(3); for(const event of events) expect(Object.keys(event)).toEqual(['draftId']);
  const production = process.env.S1_PRODUCTION_URL;
  if (production) {
    let fixtureRequests = 0; page.on('request', request => { if (request.url().includes('/__fixtures/language/')) fixtureRequests++; });
    await page.goto(production+'/language'); await expect(page.getByText('语言组合验收入口仅供开发环境使用。')).toBeVisible();
    await expect(page.getByRole('button', {name:'执行语言场景'})).toHaveCount(0); expect(fixtureRequests).toBe(0);
  }
  expect(errors).toEqual([]);
  console.log('T20 browser PASS: actual MCP composition, invalid create, partial, text/wait/failure, lost ack, read retry, offline, stale notification, cancel/recovery; events contain only draftId.');
} finally { await browser.close(); }
