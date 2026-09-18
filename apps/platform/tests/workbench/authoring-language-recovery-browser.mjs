import { chromium, expect } from '../../../../packages/embed/node_modules/@playwright/test/index.mjs';
const root = process.env.S4_BASE_URL || 'http://127.0.0.1:5181';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = []; page.on('pageerror', error => errors.push(error.message));
const ref = { pageId: 'recovery-page', revisionId: 'saved-r2', resourceId: 'resource' };
const document = { schemaVersion: '6.5', layout: 'report', id: ref.pageId, dataSources: {}, sections: [{ id: 'main', components: [{ id: 'text', type: 'text', layout: { span: 12 }, props: { title: 'Recovered title', body: 'Recovered body' } }] }] };
let summary = { formatVersion: '1.0', recoveryRef: 'private-recovery-ref', actorId: 'developer-1', workspaceId: 'local', pageId: ref.pageId, operationId: 'private-operation-id', status: 'unknown', cancelRequested: false, ref: null, previewState: 'not-requested' };
const calls = [], attempts = []; let badRead = true, failCheck = false;
await page.route('**/__fixtures/language-recovery/**', async route => {
  const kind = route.request().url().split('/').at(-1), body = route.request().postDataJSON(); calls.push(kind);
  if (kind === 'loadPending') { if (failCheck) return route.fulfill({ status: 503, json: {} }); return route.fulfill({ json: summary }); }
  if (kind === 'cancel') { summary = { ...summary, cancelRequested: true }; return route.fulfill({ json: summary }); }
  if (kind === 'recover') {
    attempts.push(body.attemptId); summary = { ...summary, status: summary.status === 'saved-unverified' ? 'saved' : 'saved-unverified', ref };
    return route.fulfill({ json: summary });
  }
  if (kind === 'readVerified') return route.fulfill({ json: { draftId: 'verified-draft', ref: badRead ? { ...ref, revisionId: 'wrong' } : ref, document } });
  if (kind === 'latest') return route.fulfill({ json: { ...ref, document, revisionNumber: 2, baseRevisionId: null, contentHash: '', dataContextVersion: null, createdAt: '', createdBy: '' } });
  return route.fulfill({ status: 500, json: { unexpected: kind } });
});
const status = page.getByTestId('language-recovery-status');
try {
  await page.goto(`${root}/language-recovery?page=${ref.pageId}`);
  await expect(status).toContainText('未决语言操作');
  expect(calls).toEqual(['loadPending']);
  await page.getByRole('button', { name: '测试开始新轮' }).click();
  expect(calls).toEqual(['loadPending']);
  await page.getByRole('button', { name: '取消未完成操作' }).click(); await expect(status).toContainText('取消');
  await page.getByRole('button', { name: '查询原操作' }).click(); await expect(status).toContainText('尚未核实');
  await expect(page.getByRole('button', { name: '打开已保存修订' })).toHaveCount(0);
  await page.getByRole('button', { name: '查询原操作' }).click(); await expect(status).toContainText('可打开');
  await page.getByRole('button', { name: '打开已保存修订' }).click(); await expect(status).toContainText('RESPONSE_MISMATCH');
  await expect(page.getByText('Recovered title', { exact: true })).toHaveCount(0);
  badRead = false;
  await page.getByRole('button', { name: '打开已保存修订' }).click(); await expect(status).toContainText('已打开并保护');
  await expect(page.getByRole('main', { name: '页面画布', exact: true }).getByText('Recovered title', { exact: true })).toBeVisible();
  expect(calls.filter(kind => ['latest', 'save', 'prepare', 'run'].includes(kind))).toEqual([]);
  expect(new Set(attempts).size).toBe(attempts.length);
  await page.reload(); await expect(status).toContainText('可打开');
  await expect(page.getByRole('main', { name: '页面画布', exact: true }).getByText('Recovered title', { exact: true })).toHaveCount(0);
  expect(calls.filter(kind => kind === 'latest')).toEqual([]);
  summary = null;
  await page.reload(); await expect(status).toContainText('未发现未决操作');
  await expect(page.getByRole('main', { name: '页面画布', exact: true }).getByText('Recovered title', { exact: true })).toBeVisible();
  const latestBeforeFailure = calls.filter(kind => kind === 'latest').length;
  failCheck = true;
  await page.reload(); await expect(status).toContainText('恢复请求未完成');
  expect(calls.filter(kind => kind === 'latest')).toHaveLength(latestBeforeFailure);
  failCheck = false;
  await page.getByRole('button', { name: '再次检查恢复' }).click();
  await expect(page.getByRole('main', { name: '页面画布', exact: true }).getByText('Recovered title', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
  console.log('S4 UI recovery PASS: startup lock, restart, cancel/query, unverified lock, exact-open, bad ref, null release, failed discovery, no model/save calls.');
} finally { await browser.close(); }
