import { chromium, expect } from '../../../../packages/embed/node_modules/@playwright/test/index.mjs';
import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({ headless: true });
const root = process.env.S1_BASE_URL || 'http://127.0.0.1:5181';
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = []; page.on('pageerror', (error) => errors.push(error.message));
const commands = [], results = new Map(); let revision = 1;
async function registerRoutes(tab) {
  await tab.route('**/__fixtures/authoring/**', async (route) => {
    const body = route.request().postDataJSON();
    if (route.request().url().endsWith('/lookup')) {
      await route.fulfill({ json: results.get(body.context.operationId) ?? { status: 'not-applied', operationId: body.context.operationId, retrySafe: true } }); return;
    }
    const { command, mode } = body; commands.push(command);
    if (mode === 'conflict') { await route.fulfill({ json: { status: 'rejected', operationId: command.context.operationId, code: 'REVISION_CONFLICT', message: '替身基线冲突', retryable: false } }); return; }
    if (mode === 'offline') { await route.abort(); return; }
    const durable = await tab.evaluate(async () => {
      const { createIndexedAuthoringStorage } = await import('/src/lib/workbench/authoring-storage.ts');
      const { readRuntimeConfig } = await import('/src/lib/runtime-config.ts'); const identity = readRuntimeConfig();
      return createIndexedAuthoringStorage().read({ actorId: identity.operatorId, workspaceId: identity.workspaceId, pageId: 'fixture-page' });
    });
    expect(durable.value.queue.some((item) => item.command?.context.operationId === command.context.operationId)).toBe(true);
    const receipt = results.get(command.context.operationId) ?? { status: 'saved', operationId: command.context.operationId, ref: { pageId: command.pageId, resourceId: command.base.resourceId, revisionId: `fixture-r${++revision}` }, base: command.base, contentHash: createHash('sha256').update(JSON.stringify(command.document)).digest('hex'), canonicalization: 'fixture-json/1', revisionNumber: revision };
    results.set(command.context.operationId, receipt);
    if (mode === 'lost-ack') { await route.abort(); return; }
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({ json: receipt });
  });
}
async function openFixture(tab) {
  await tab.goto(`${root}/dialogue`); await tab.getByRole('checkbox', { name: '嵌入工作台' }).check();
  await tab.getByRole('button', { name: 'draft-a', exact: true }).click();
  const inspector = tab.getByRole('complementary', { name: '检查器' });
  await inspector.getByRole('button', { name: /draft-a/ }).click(); return inspector;
}
try {
  await mkdir('/private/tmp/metriccanvas-s1-evidence', { recursive: true });
  await registerRoutes(page); const inspector = await openFixture(page);
  const title = inspector.getByLabel('组件标题');
  await title.fill('第一操作'); await title.press('Tab');
  await expect(page.getByText(/待同步 1 个操作/)).toBeVisible();
  await title.fill('第二操作'); await title.press('Tab');
  await expect(page.getByText(/服务端已保存修订 R3/)).toBeVisible();
  expect(commands).toHaveLength(2); expect(commands[1].base).toEqual(results.get(commands[0].context.operationId).ref);
  await title.fill('第二操作'); await title.press('Tab'); await page.waitForTimeout(300); expect(commands).toHaveLength(2);
  await page.getByLabel('同步替身场景').selectOption('lost-ack');
  await title.fill('回执丢失但内容保留'); await title.press('Tab');
  await expect(page.getByText(/已在浏览器保护，待同步 1 个操作/)).toBeVisible();
  await expect(page.getByRole('button', { name: '核实并重试同步' })).toBeEnabled();
  await page.getByRole('button', { name: '核实并重试同步' }).click();
  await expect(page.getByText(/服务端已保存修订 R4/)).toBeVisible(); expect(commands).toHaveLength(3);
  await page.getByLabel('同步替身场景').selectOption('conflict');
  await title.fill('冲突操作'); await title.press('Tab'); await expect(page.getByText(/替身基线冲突/)).toBeVisible();
  await title.fill('冲突后继续编辑'); await title.press('Tab');
  await expect(page.getByText(/已在浏览器保护，待同步 2 个操作/)).toBeVisible(); expect(commands).toHaveLength(4);
  await page.screenshot({ path: '/private/tmp/metriccanvas-s1-evidence/t13-protected-conflict.png' });
  const denied = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await denied.addInitScript(() => Object.defineProperty(window, 'indexedDB', { value: { open() { throw Error('模拟存储拒绝'); } } }));
  const deniedInspector = await openFixture(denied); await deniedInspector.getByLabel('组件标题').fill('未保护修改'); await deniedInspector.getByLabel('组件标题').press('Tab');
  await expect(denied.getByText(/浏览器保护失败，请勿关闭页面/)).toBeVisible();
  await denied.screenshot({ path: '/private/tmp/metriccanvas-s1-evidence/t13-storage-failed.png' }); await denied.close();
  expect(errors).toEqual([]);
  console.log('T13 browser PASS: durable-before-send, serial bases, no-change, lost-ack lookup, conflict/editing, storage denial.');
} finally { await browser.close(); }
