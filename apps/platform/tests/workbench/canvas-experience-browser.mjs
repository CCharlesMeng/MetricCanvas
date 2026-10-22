import { createServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { chromium, expect } from '../../../../packages/embed/node_modules/@playwright/test/index.mjs';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const appRoot = resolve(repo, 'apps/platform');
const output = process.env.CANVAS_EVIDENCE_DIR || '/private/tmp/metriccanvas-canvas-experience';
const scenario = JSON.parse(await readFile(resolve(repo, 'pages/platform/platform-canvas-experience.json'), 'utf8'));
let stored = structuredClone(scenario), revision = 1;
const writes = [], errors = [];
process.chdir(appRoot);
const server = await createServer({ root: appRoot, configFile: false, plugins: [svelte()],
  resolve: { alias: { $lib: resolve(appRoot, 'src/lib'), $pages: resolve(repo, 'pages'), $fixtures: resolve(repo, 'docs/examples') } },
  server: { host: '127.0.0.1', port: 0 } });
let browser, page;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => { window.__METRICCANVAS__ = {
    dqeEndpoint: '/fixture-dqe', pageMetadataBaseUrl: '/fixture-assets', authToken: 'fixture',
    operatorId: 'canvas-user', workspaceId: 'canvas-workspace'
  }; });
  await page.route('**/fixture-assets/user-page-metadata**', async route => {
    expect(route.request().method()).toBe('GET');
    const value = { retCode: '0', page_metadata_id: 'canvas-resource', page_id: stored.id,
      revision_id: `r${revision}`, revision_number: revision, page_metadata_definition: JSON.stringify(stored) };
    await route.fulfill({ json: route.request().url().includes('?') ? { retCode: '0', page_metadata_list: [value], total: 1 } : value });
  });
  await page.route('**/__fixtures/authoring/save', async route => {
    const { command } = route.request().postDataJSON(); writes.push(command);
    stored = structuredClone(command.document); revision++;
    await route.fulfill({ json: { status: 'saved', operationId: command.context.operationId, base: command.base,
      ref: { pageId: stored.id, revisionId: `r${revision}`, resourceId: 'canvas-resource' }, revisionNumber: revision,
      contentHash: createHash('sha256').update(JSON.stringify(stored)).digest('hex'), canonicalization: 'fixture-json/1' } });
  });
  const root = server.resolvedUrls.local[0];
  await page.goto(`${root}dialogue?page=${scenario.id}`);
  await page.getByRole('checkbox', { name: '嵌入工作台' }).check();
  const inspector = page.getByRole('complementary', { name: '检查器' });
  const cell = (section, id) => page.locator(`[data-component="${section}/${id}"]`);
  const select = async (section, id) => cell(section, id).getByRole('heading').first().click();
  const actions = () => page.locator('.selection-actions:popover-open');
  const removeSelected = async () => actions().getByRole('button', { name: /^删除组件 / }).click();
  const undo = async () => { await page.getByRole('button', { name: '撤销上一步', exact: true }).click(); };
  await expect(cell('overview', 'first')).toBeVisible();
  await select('overview', 'first');
  if (!process.env.CANVAS_RESTORE_ONLY) {
    await expect(inspector.locator('.selbar')).toHaveCount(0);
    await expect(inspector.locator('.selection-type')).toHaveText('文本属性');
    await expect(actions()).toBeVisible();
  }
  await mkdir(output, { recursive: true });
  async function collectRestore(state) {
    if (!process.env.CANVAS_RESTORE_CONTRACT) return;
    const contract = JSON.parse(await readFile(process.env.CANVAS_RESTORE_CONTRACT, 'utf8'));
    const adapter = JSON.parse(await readFile(process.env.CANVAS_RESTORE_ADAPTER, 'utf8'));
    const selected = contract.rules.filter(rule => state === 'selected' ? !/R1-3-(preview|render)-/.test(rule.id) : rule.id.startsWith(`R1-3-${state}-`));
    await page.evaluate(input => window.__SDD_RESTORE_INPUT__ = input, { contract: { ...contract, rules: selected }, adapter });
    const result = await page.evaluate(await readFile(process.env.CANVAS_RESTORE_COLLECTOR, 'utf8'));
    await writeFile(resolve(output, `restore-${state}.json`), JSON.stringify(result, null, 2));
  }
  await cell('overview', 'first').evaluate(node => Promise.allSettled(node.getAnimations().map(animation => animation.finished)));
  await collectRestore('selected');
  if (process.env.CANVAS_RESTORE_ONLY) {
    await page.getByRole('button', { name: '预览当前页面', exact: true }).click();
    await expect(page.locator('.selection-actions')).toHaveCount(0);
    await collectRestore('preview');
    // Working-copy preview uses the formal RuntimeView; collect the same no-decoration facts.
    await collectRestore('render');
    console.log(`Restore collection: ${output}`);
    process.exitCode = errors.length ? 1 : 0;
  } else {
  await inspector.getByRole('button', { name: '整行', exact: true }).click();
  await expect(cell('overview', 'first')).toHaveAttribute('style', /grid-column: span 12/);
  await actions().getByRole('button', { name: '下移组件', exact: true }).click();
  await expect.poll(() => page.locator('[data-section-id="overview"] > .section-grid > [data-component]').evaluateAll(nodes => nodes.map(n => n.getAttribute('data-component')))).toEqual(['overview/second', 'overview/first']);
  // The actual native mouse gesture must work; synthetic drag events alone miss cancelled drags.
  await cell('overview', 'first').hover();
  const destination = cell('details', 'third');
  const bounds = await destination.boundingBox();
  await cell('overview', 'first').getByRole('button', { name: '拖动组件 first', exact: true }).dragTo(destination, { targetPosition: { x: bounds.width / 2, y: bounds.height * .8 } });
  await expect(cell('details', 'first')).toBeVisible();
  await expect(page.locator('[data-drop-active="true"]')).toHaveCount(0);
  await expect(page.locator('[data-section-id="details"] [data-component]').first()).toHaveAttribute('data-component', 'details/third');
  await select('details', 'third');
  await expect(actions()).toBeVisible();
  await removeSelected();
  await expect(cell('details', 'third')).toHaveCount(0);
  await undo();
  await expect(cell('details', 'third')).toBeVisible();
  await select('details', 'first');
  const title = inspector.getByLabel('组件标题', { exact: true });
  await title.fill('键盘编辑保留组件');
  await title.press('Delete');
  await title.press('Tab');
  await expect(cell('details', 'first')).toBeVisible();
  await cell('details', 'first').focus();
  await page.keyboard.press('Delete');
  await expect(cell('details', 'first')).toHaveCount(0);
  await undo();
  await expect(cell('details', 'first')).toBeVisible();
  // Empty authoring sections remain targetable after deleting their last component.
  await select('overview', 'second');
  await removeSelected();
  await expect(page.locator('[data-section-id="overview"] .authoring-empty-drop-slot')).toContainText('拖动组件到此分区');
  await undo();
  await select('details', 'first');
  expect(writes).toHaveLength(0);
  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(stored.dataSources).toEqual(scenario.dataSources);
  expect(stored.sections[1].components.map(c => c.id)).toEqual(['third', 'first']);
  await expect(page.getByTestId('authoring-save-state')).toContainText('草稿已保存');
  await inspector.getByRole('button', { name: '页面设置', exact: true }).click();
  await expect(inspector.getByLabel('Dashboard 日期筛选配置', { exact: true })).toBeVisible();
  await inspector.getByRole('button', { name: '组件配置', exact: true }).click();
  await mkdir(output, { recursive: true });
  for (const width of [1440, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(inspector.getByLabel('组件标题')).toBeVisible();
    const overflow = await inspector.evaluate(node => node.scrollWidth > node.clientWidth);
    expect(overflow).toBe(false);
    await page.screenshot({ path: resolve(output, `platform-canvas-${width}.png`), fullPage: true });
  }
  await select('overview', 'second');
  await removeSelected();
  await select('details', 'third');
  await removeSelected();
  await select('details', 'first');
  await removeSelected();
  await expect(page.getByRole('alert').filter({ hasText: '页面至少需要一个组件' })).toBeVisible();
  await expect(cell('details', 'first')).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(errors).toEqual([]);
  console.log(`PASS: native handle drag, vertical drop, reorder, width presets, C selection actions, delete, undo, empty section, input isolation, explicit save, page settings; screenshots: ${output}`);
  }
} catch (error) {
  if (page) {
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true });
    console.error('Canvas failure state', await page.evaluate(() => ({ selected: [...document.querySelectorAll('.authoring-selected')].map(node => node.getAttribute('data-component')), actions: [...document.querySelectorAll('.selection-actions')].map(node => ({ open: node.matches(':popover-open'), text: node.textContent, style: node.getAttribute('style') })) })));
  }
  throw error;
} finally {
  await browser?.close();
  await server.close();
}
