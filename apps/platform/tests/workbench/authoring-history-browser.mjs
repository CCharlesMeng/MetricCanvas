import { chromium, expect } from '../../../../packages/embed/node_modules/@playwright/test/index.mjs';
import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const root = process.env.S1_BASE_URL || 'http://127.0.0.1:5181';
const commands = [], requests = [], revisions = new Map(), receipts = new Map(); let number = 1, snapshot, oldDocument, duplicate = false;
const resourceId = 'fixture-resource', pageId = 'fixture-page';
const ref = (revisionId) => ({ pageId, revisionId, resourceId });
await page.route('**/__fixtures/authoring/**', async (route) => {
  const body = route.request().postDataJSON(), path = route.request().url().split('/').at(-1); requests.push({ path, body });
  if (path === 'list-revisions') {
    snapshot ??= ref(`r${number}`);
    const ids = body.cursor ? [duplicate ? 'old-1' : 'old-2'] : ['old-1'];
    await route.fulfill({ json: { snapshot, revisions: ids.map((id) => ({ ref: ref(id), description: '受控历史', origin: 'manual' })), nextCursor: body.cursor ? null : 'page-2' } }); return;
  }
  if (path === 'read-revision') {
    await route.fulfill({ json: { ...ref(body.revisionId), document: oldDocument, revisionNumber: 1, baseRevisionId: null, contentHash: '', dataContextVersion: null, createdBy: '', createdAt: '' } }); return;
  }
  if (path === 'lookup') { await route.fulfill({ json: receipts.get(body.context.operationId) ?? { status: 'unknown', operationId: body.context.operationId } }); return; }
  const command = body.command; commands.push(command);
  const receipt = { status: 'saved', operationId: command.context.operationId, base: command.base, ref: { ...command.base, revisionId: `r${++number}` }, revisionNumber: number, contentHash: createHash('sha256').update(JSON.stringify(command.document)).digest('hex'), canonicalization: 'fixture-json/1' };
  revisions.set(receipt.ref.revisionId, command.document); receipts.set(receipt.operationId, receipt); await route.fulfill({ json: receipt });
});
const embedded = page.getByRole('checkbox', { name: '嵌入工作台' });
const inspector = page.getByRole('complementary', { name: '检查器' });
try {
  await mkdir('/private/tmp/metriccanvas-s1-evidence', { recursive: true });
  await page.goto(`${root}/dialogue`); await page.getByRole('checkbox', { name: '启用历史替身' }).check(); await embedded.check();
  await page.getByRole('button', { name: 'draft-a', exact: true }).click(); await inspector.getByRole('button', { name: /draft-a/ }).click();
  await context.setOffline(true); await inspector.getByLabel('组件标题').fill('离线待撤销'); await inspector.getByLabel('组件标题').press('Tab');
  await expect(page.getByText(/已在浏览器保护，待同步 1 个操作/)).toBeVisible();
  await page.getByRole('button', { name: '撤销上一步', exact: true }).click();
  await expect(page.getByText(/已在浏览器保护，待同步 2 个操作/)).toBeVisible();
  await expect(inspector.getByLabel('组件标题')).toHaveValue('draft-a'); await context.setOffline(false);
  await expect(page.getByText(/服务端已保存修订 R3/)).toBeVisible(); expect(commands).toHaveLength(2);
  oldDocument = structuredClone(commands[1].document); oldDocument.sections[0].components[0].props.title = '历史内容';
  // Read a stable paginated history then restore the exact selected revision.
  await page.getByRole('button', { name: '页面历史', exact: true }).click();
  await page.getByRole('button', { name: '加载更多历史' }).click();
  await expect(page.getByRole('button', { name: '恢复 old-2', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '恢复 old-1', exact: true }).click();
  await expect(page.getByText(/服务端已保存修订 R4/)).toBeVisible(); expect(commands).toHaveLength(3);
  expect(commands[2].document).toEqual(oldDocument); expect(commands[2].base.revisionId).toBe('r3');
  expect(requests.filter((item) => item.path === 'read-revision')[0].body.revisionId).toBe('old-1');
  await expect(inspector.getByLabel('组件标题')).toHaveValue('历史内容');
  await page.screenshot({ path: '/private/tmp/metriccanvas-s1-evidence/t15-history-restored.png' });
  await page.evaluate(() => history.replaceState(null, '', '/dialogue?page=fixture-page')); await page.reload();
  await page.getByRole('checkbox', { name: '启用历史替身' }).check(); await embedded.check(); await inspector.getByRole('button', { name: /历史内容/ }).click();
  await inspector.getByLabel('组件标题').fill('恢复后继续编辑'); await inspector.getByLabel('组件标题').press('Tab');
  await expect(page.getByText(/服务端已保存修订 R5/)).toBeVisible(); expect(commands[3].base.revisionId).toBe('r4');
  await page.getByRole('button', { name: '页面历史', exact: true }).click();
  duplicate = true; await page.getByRole('button', { name: '加载更多历史' }).click();
  await expect(page.getByText(/历史分页出现重复修订/)).toBeVisible();
  // The real capability remains unavailable when the explicit fixture is not selected.
  await embedded.uncheck(); await page.getByRole('checkbox', { name: '启用历史替身' }).uncheck(); await embedded.check();
  await page.getByRole('button', { name: '页面历史', exact: true }).click(); await expect(page.getByText(/尚未开放页面历史/)).toBeVisible();
  console.log('T15 browser PASS: offline undo appends compensation, stable history pagination, exact old restore produces new revision, reopen then edit, unavailable lifecycle is explicit.');
} finally { await browser.close(); }
