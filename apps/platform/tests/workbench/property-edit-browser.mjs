import { chromium, expect } from '../../../../packages/embed/node_modules/@playwright/test/index.mjs';
import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { propertyFixture } from './property-fixture.ts';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = []; page.on('pageerror', (error) => errors.push(error.message));
const root = process.env.S1_BASE_URL || 'http://127.0.0.1:5181';
let stored = propertyFixture(), revision = 1; const commands = [], reads = [];
await page.addInitScript(() => { window.__METRICCANVAS__ = { dqeEndpoint: '/fixture-dqe', pageMetadataBaseUrl: '/fixture-assets', authToken: 'fixture', operatorId: 'property-user', workspaceId: 'property-workspace' }; });
await page.route('**/fixture-assets/user-page-metadata**', async (route) => {
  expect(route.request().method()).toBe('GET'); reads.push(revision);
  const value = { page_metadata_id: 'property-resource', page_id: stored.id, revision_id: `r${revision}`, revision_number: revision, page_metadata_definition: JSON.stringify(stored) };
  await route.fulfill({ json: route.request().url().includes('?') ? { retCode: '0', page_metadata_list: [value], total: 1 } : { retCode: '0', ...value } });
});
await page.route('**/__fixtures/authoring/save', async (route) => {
  const { command } = route.request().postDataJSON(); commands.push(command);
  expect(command.base.revisionId).toBe(`r${revision}`); stored = structuredClone(command.document); revision++;
  await route.fulfill({ json: { status: 'saved', operationId: command.context.operationId, base: command.base, ref: { pageId: stored.id, revisionId: `r${revision}`, resourceId: 'property-resource' }, revisionNumber: revision, contentHash: createHash('sha256').update(JSON.stringify(stored)).digest('hex'), canonicalization: 'fixture-json/1' } });
});
const inspector = page.getByRole('complementary', { name: '检查器' });
async function select(id) { await page.locator(`[data-component="s/${id}"]`).click({ position: { x: 5, y: 5 } }); }
async function edit(label, value, choice = false) {
  const before = commands.length, input = inspector.getByLabel(label, { exact: true });
  if (choice) await input.selectOption(value); else { await input.fill(value); await input.press('Tab'); }
  await expect.poll(() => commands.length).toBe(before + 1); await expect(page.getByText(`服务端已保存修订 R${revision}`, { exact: true })).toBeVisible();
}
try {
  await mkdir('/private/tmp/metriccanvas-s1-evidence', { recursive: true });
  await page.goto(`${root}/dialogue?page=properties-page`); await page.getByRole('checkbox', { name: '嵌入工作台' }).check();
  await select('header');
  const before = commands.length; await inspector.getByLabel('副标题', { exact: true }).fill('新报告副标题'); await page.waitForTimeout(100); expect(commands).toHaveLength(before); await inspector.getByLabel('副标题', { exact: true }).press('Tab'); await expect.poll(() => commands.length).toBe(before + 1);
  await edit('徽标', '已更新'); await edit('标签（每行一个）', '标签一\n标签二');
  await select('metric'); await edit('主指标 1 行说明', '新指标'); await edit('主指标 1 上下文', '本季度'); await edit('主指标 1 单位', '万元'); await edit('次指标 1 行说明', '新辅助'); await edit('趋势箭头', 'false', true);
  await select('bar'); await edit('系列 1 标签', '新柱状系列');
  for (const label of ['横向显示', '堆叠', '圆角', '分段标签', '堆叠合计标签']) await edit(label, 'true', true);
  await select('line'); await edit('系列 1 标签', '新折线系列');
  for (const label of ['平滑曲线', '面积渐变', '数据点标签', '隐藏纵轴']) await edit(label, 'true', true);
  await select('pie'); await edit('环形内径（如 50%）', '55%'); await edit('引导线', 'true', true);
  await select('table'); await edit('副标题', '表格新说明'); await edit('表格适配', 'container', true); await edit('列 1.2 标题', '新金额'); await edit('列 1.2 宽度', '180'); await edit('列 1.2 固定', 'right', true); await edit('列 1.1 对齐', 'right', true);
  const count = commands.length;
  await inspector.getByLabel('列 1.2 宽度', { exact: true }).fill('0'); await inspector.getByLabel('列 1.2 宽度', { exact: true }).press('Tab'); await expect(page.getByRole('alert').first()).toBeVisible(); expect(commands).toHaveLength(count);
  await inspector.getByLabel('列 1.2 宽度', { exact: true }).fill('180'); await inspector.getByLabel('列 1.2 宽度', { exact: true }).press('Tab'); await page.waitForTimeout(150); expect(commands).toHaveLength(count);
  expect(errors).toEqual([]);
  expect(stored.sections[0].components[0].props.tags).toEqual(['标签一', '标签二']);
  expect(stored.dataSources).toEqual(propertyFixture().dataSources);
  const props = (id) => stored.sections[0].components.find((component) => component.id === id).props;
  expect(props('bar').series[0]).toEqual({ field: 'value', label: '新柱状系列', role: 'actual', stackOrder: 1 });
  expect(props('metric').rows[0].valueField).toEqual(propertyFixture().sections[0].components[1].props.rows[0].valueField);
  expect(props('table').pagination).toEqual({ mode: 'local', pageSize: 10 });
  for (const component of stored.sections[0].components) expect(component.props.actions).toEqual(propertyFixture().sections[0].components.find((original) => original.id === component.id).props.actions);
  await expect(page.locator('[data-component="s/table"]').getByText('新金额', { exact: true })).toBeVisible();
  await page.screenshot({ path: '/private/tmp/metriccanvas-s1-evidence/t16-table-properties.png' });
  await page.getByRole('button', { name: '精确修订预览', exact: true }).click();
  await expect(page.getByLabel(`精确修订预览 r${revision}`).getByText('新报告副标题', { exact: true })).toBeVisible();
  expect(reads.at(-1)).toBe(revision); expect(commands.at(-1).document).toEqual(stored);
  await expect(page.getByRole('button', { name: /添加组件|编辑 JSON/ })).toHaveCount(0);
  await page.getByRole('button', { name: '精确修订预览', exact: true }).click();
  await page.getByRole('button', { name: '撤销上一步', exact: true }).click();
  await expect.poll(() => commands.length).toBe(count + 1);
  await expect(page.getByText(`服务端已保存修订 R${revision}`, { exact: true })).toBeVisible();
  expect(props('table').columns[0].children[0]).not.toHaveProperty('align');
  console.log(`T16 browser PASS: ${commands.length - 1} complete property operations plus undo, no intermediate/no-change/invalid saves, six types rendered and exact revision read back; bindings/actions preserved.`);
} catch (error) { console.log(await page.locator('body').innerText()); throw error; } finally { await browser.close(); }
