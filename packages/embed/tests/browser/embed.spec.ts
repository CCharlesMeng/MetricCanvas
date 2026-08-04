import { expect, test } from '@playwright/test';

test('经典脚本在 Shadow DOM 中渲染 inline 页面并隔离宿主样式', async ({
  page
}) => {
  await page.goto('/examples/inline.html');
  const host = page.locator('[data-metriccanvas-runtime]');
  const title = host.getByRole('heading', { name: '独立 HTML 经营概览' });

  await expect(title).toBeVisible();
  await expect(host.getByText('128,600')).toBeVisible();
  await expect(title).toHaveCSS('color', 'rgb(68, 85, 147)');
  await expect(title).toHaveCSS('font-size', '24px');
  await expect(page.locator('link[rel="stylesheet"]')).toHaveCount(0);
});

test('独立 HTML 最终报告页加载真实看板页面并完成客户端渲染', async ({
  page
}) => {
  await page.goto('/examples/report.html');

  const host = page.locator('[data-metriccanvas-runtime]');
  await expect(
    host.getByRole('heading', { name: 'Tokens运营分析简报' })
  ).toBeVisible();
  await expect(
    host.getByRole('heading', { name: '数据摘要', level: 2 })
  ).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-report-ready', 'true');
  await expect(page.locator('#report-status')).toHaveAttribute(
    'data-state',
    'ready'
  );
  await expect(page).toHaveTitle('Tokens运营分析简报 · MetricCanvas');
});

test('挂载接口支持更新、重复挂载保护和幂等销毁', async ({ page }) => {
  await page.goto('/examples/inline.html');
  await expect(
    page.locator('[data-metriccanvas-runtime]').getByRole('heading')
  ).toContainText('独立 HTML 经营概览');

  const duplicateError = await page.evaluate(() => {
    try {
      MetricCanvas.mount('#dashboard', { document: window.pageDocument });
      return '';
    } catch (error) {
      return error instanceof Error ? `${error.name}:${error.message}` : String(error);
    }
  });
  expect(duplicateError).toContain('MetricCanvasMountError');

  await page.evaluate(() => {
    window.runtime.update({
      document: {
        ...window.pageDocument,
        id: 'updated-example',
        sections: [{
          ...window.pageDocument.sections[0],
          components: [{
            id: 'header',
            type: 'reportHeader',
            layout: { span: 12 },
            props: { title: '更新后的页面' }
          }]
        }]
      }
    });
  });
  await expect(
    page.locator('[data-metriccanvas-runtime]').getByRole('heading', {
      name: '更新后的页面'
    })
  ).toBeVisible();

  const destroyedUpdateError = await page.evaluate(() => {
    window.runtime.destroy();
    window.runtime.destroy();
    try {
      window.runtime.update({ document: window.pageDocument });
      return '';
    } catch (error) {
      return error instanceof Error ? `${error.name}:${error.message}` : String(error);
    }
  });
  expect(destroyedUpdateError).toContain('MetricCanvasMountError');
  await expect(page.locator('[data-metriccanvas-runtime]')).toHaveCount(0);
});

test('query 页面通过注入的数据网关完成取数', async ({ page }) => {
  await page.goto('/examples/query.html');
  const host = page.locator('[data-metriccanvas-runtime]');
  const table = host.getByRole('table');

  await expect(host.getByText('区域成交额')).toBeVisible();
  await expect(table.getByText('华东', { exact: true })).toBeVisible();
  await expect(table.getByText('386,000', { exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.queryEvents.some(event => event.type === 'ready')
      )
    )
    .toBe(true);
});

test('query 页面缺少接入依赖时给出配置错误而非页面错误', async ({ page }) => {
  await page.goto('/examples/query.html');
  await expect(
    page.locator('[data-metriccanvas-runtime]').getByRole('table')
  ).toBeVisible();

  await page.evaluate(() => {
    window.queryRuntime.destroy();
    window.queryEvents = [];
    window.missingRuntime = MetricCanvas.mount('#dashboard', {
      document: window.queryPageDocument,
      onEvent(event) {
        window.queryEvents.push(event);
      }
    });
  });

  const host = page.locator('[data-metriccanvas-runtime]');
  await expect(host.getByText('统一运行时接入配置不完整')).toBeVisible();
  await expect(host.getByText('DATA_GATEWAY_REQUIRED')).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.queryEvents.some(
          event =>
            event.type === 'configuration-error' &&
            event.code === 'DATA_GATEWAY_REQUIRED'
        )
      )
    )
    .toBe(true);
});

test('ESM 单文件产物可直接导入', async ({ page }) => {
  await page.goto('/examples/esm.html');
  await expect(
    page.locator('[data-metriccanvas-runtime]').getByRole('heading', {
      name: 'ESM 独立页面'
    })
  ).toBeVisible();
});

test('AI 总结通过假 SSE 契约流式渲染且只发送声明字段', async ({ page }) => {
  await page.goto('/examples/ai-summary.html');
  const host = page.locator('[data-metriccanvas-runtime]');
  const markdown = host.locator('.safe-markdown');

  await expect(host.getByRole('heading', { name: '风险总结' })).toBeVisible();
  await expect(markdown).toBeVisible();
  const earlyText = (await markdown.textContent()) ?? '';
  await page.waitForTimeout(180);
  const laterText = (await markdown.textContent()) ?? '';
  expect(laterText.length).toBeGreaterThan(earlyText.length);
  await expect(host.getByText(/华东代表处有 3 个未考察客户/u)).toBeVisible();

  const request = await page.evaluate(() => window.aiSummaryRequests[0]!);
  expect(request.credentials).toBe('include');
  expect(request.headers).toMatchObject({ client: 'PC_CloudIoc' });
  expect(request.url).toMatch(/\/fake-ai\/conversations\/.+\/chat$/u);
  const input = request.body.context_info['ai-summary'].input_data;
  expect(input.business_data).toEqual([
    {
      question: '各代表处风险数据',
      data: { office: ['华东'], missing: [3] }
    }
  ]);
  expect(JSON.stringify(request.body)).not.toContain('不得外传');
});
