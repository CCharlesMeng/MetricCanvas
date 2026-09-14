import { chromium, expect } from '../../../../packages/embed/node_modules/@playwright/test/index.mjs';
import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const root = process.env.S1_BASE_URL || 'http://127.0.0.1:5181';
const commands = [], lookups = [], receipts = new Map(); let loseAck = false, revision = 1;
await page.route('**/__fixtures/authoring/**', async (route) => {
  const body = route.request().postDataJSON();
  if (route.request().url().endsWith('/lookup')) {
    lookups.push(body.context.operationId);
    await route.fulfill({ json: receipts.get(body.context.operationId) ?? { status: 'not-applied', operationId: body.context.operationId, retrySafe: true } }); return;
  }
  const { command } = body; commands.push(command);
  const receipt = receipts.get(command.context.operationId) ?? { status: 'saved', operationId: command.context.operationId, base: command.base, ref: { pageId: command.pageId, resourceId: command.base.resourceId, revisionId: `fixture-r${++revision}` }, contentHash: createHash('sha256').update(JSON.stringify(command.document)).digest('hex'), canonicalization: 'fixture-json/1', revisionNumber: revision };
  receipts.set(command.context.operationId, receipt);
  if (loseAck) { await route.abort(); return; }
  await route.fulfill({ json: receipt });
});
const embedded = page.getByRole('checkbox', { name: '嵌入工作台' });
const inspector = page.getByRole('complementary', { name: '检查器' });
const title = inspector.getByLabel('组件标题');
async function select(titleText) { await inspector.getByRole('button', { name: new RegExp(titleText) }).click(); }
async function stored() {
  return page.evaluate(async () => {
    const { createIndexedAuthoringStorage } = await import('/src/lib/workbench/authoring-storage.ts');
    return createIndexedAuthoringStorage().read({ actorId: 'developer-1', workspaceId: 'local', pageId: 'fixture-page' });
  });
}
try {
  await mkdir('/private/tmp/metriccanvas-s1-evidence', { recursive: true });
  await page.goto(`${root}/dialogue`); await embedded.check(); await page.getByRole('button', { name: 'draft-a', exact: true }).click(); await select('draft-a');
  // Offline while the app shell remains loaded; re-opening mounts a new coordinator.
  await context.setOffline(true);
  await title.fill('离线第一操作'); await title.press('Tab'); await expect(page.getByText(/已在浏览器保护，待同步 1 个操作/)).toBeVisible();
  await title.fill('离线第二操作'); await title.press('Tab'); await expect(page.getByText(/已在浏览器保护，待同步 2 个操作/)).toBeVisible();
  await page.evaluate(() => history.replaceState(null, '', '/dialogue?page=fixture-page'));
  await embedded.uncheck(); await embedded.check(); await select('离线第二操作');
  await expect(title).toHaveValue('离线第二操作'); await expect(page.getByText(/已在浏览器保护，待同步 2 个操作/)).toBeVisible();
  expect(commands).toHaveLength(0);
  await page.screenshot({ path: '/private/tmp/metriccanvas-s1-evidence/t14-offline-reopened.png' });
  await context.setOffline(false); await expect(page.getByText(/服务端已保存修订 R3/)).toBeVisible();
  expect(commands).toHaveLength(2); expect(commands[1].base).toEqual(receipts.get(commands[0].context.operationId).ref);
  // Persisted command may be committed remotely even though the browser has no receipt.
  loseAck = true; await title.fill('已提交但丢回执'); await title.press('Tab');
  await expect.poll(() => commands.length).toBe(3); await expect(page.getByText(/已在浏览器保护，待同步 1 个操作/)).toBeVisible();
  await embedded.uncheck(); loseAck = false;
  await page.reload(); await embedded.check(); await select('已提交但丢回执');
  await expect(page.getByText(/服务端已保存修订 R4/)).toBeVisible();
  expect(commands).toHaveLength(3); expect(lookups).toContain(commands[2].context.operationId);
  const record = await stored(); expect(JSON.stringify(record)).not.toContain('authToken'); expect(record.value.queue).toHaveLength(0);
  // Other identity cannot read this scope; no page content is disclosed on failed remote load.
  await embedded.uncheck();
  await page.evaluate(async () => { const api = await import('/src/lib/runtime-config.ts'); api.installRuntimeConfig({ ...api.readRuntimeConfig(), operatorId: 'bob' }); });
  await embedded.check(); await expect(inspector.getByRole('button', { name: /已提交但丢回执/ })).toHaveCount(0);
  await expect(page.getByText(/Failed to fetch|网络|fetch/).first()).toBeVisible();
  expect(await stored()).toEqual(record);
  console.log('T14 browser PASS: offline remount restores real IndexedDB, reconnect preserves order, full reload resolves lost ack without duplicate, identity isolated, no credentials stored.');
} finally { await browser.close(); }
