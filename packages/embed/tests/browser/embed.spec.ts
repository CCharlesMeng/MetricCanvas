import { expect, test, type Page } from '@playwright/test';

async function runtimeShellSnapshot(page: Page) {
  const host = page.locator('[data-metriccanvas-runtime]');
  const runtime = host.locator('.runtime-view');
  const shell = host.locator('.page-content');
  const section = host.locator('.page-section').first();
  const cell = host.locator('.cell').first();

  return {
    runtimeClass: await runtime.getAttribute('class'),
    shell: await shell.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        width: element.getBoundingClientRect().width,
        maxWidth: style.maxWidth,
        padding: style.padding,
        background: style.backgroundColor
      };
    }),
    section: await section.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        padding: style.padding,
        background: style.backgroundColor,
        borderRadius: style.borderRadius
      };
    }),
    cell: await cell.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        padding: style.padding,
        background: style.backgroundColor,
        borderRadius: style.borderRadius
      };
    })
  };
}

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

test('看板页面 id 不影响统一运行时的 DOM 与计算样式', async ({ page }) => {
  await page.goto('/examples/inline.html');
  const before = await runtimeShellSnapshot(page);

  await page.evaluate(() => {
    window.runtime.update({
      document: {
        ...window.pageDocument,
        id: 'customer-activity-risk-briefing'
      }
    });
  });
  await expect(page.locator('[data-metriccanvas-runtime] .runtime-view')).toBeVisible();

  expect(await runtimeShellSnapshot(page)).toEqual(before);
});

test('connectPrevious 在任意页面生成白底虚线表格组', async ({ page }) => {
  await page.goto('/examples/inline.html');
  await page.evaluate(() => {
    window.runtime.update({
      document: {
        schemaVersion: '4.0',
        id: 'connected-tables-example',
        dataSources: {
          rows: {
            fields: {
              name: { type: 'string', role: 'dimension', label: '名称' },
              value: { type: 'number', role: 'measure', label: '数值' }
            },
            source: {
              type: 'inline',
              rows: [{ name: '示例', value: 42 }]
            }
          }
        },
        sections: [{
          id: 'tables',
          layout: { type: 'grid', columns: 12 },
          components: [
            {
              id: 'summary-table',
              type: 'table',
              layout: { span: 12 },
              data: { main: 'rows' },
              props: { columns: [{ field: 'name' }, { field: 'value' }] }
            },
            {
              id: 'detail-table',
              type: 'table',
              layout: { span: 12, connectPrevious: true },
              data: { main: 'rows' },
              props: { columns: [{ field: 'name' }, { field: 'value' }] }
            }
          ]
        }]
      }
    });
  });

  const host = page.locator('[data-metriccanvas-runtime]');
  const upperCell = host.locator('[data-component="tables/summary-table"]');
  const lowerCell = host.locator('[data-component="tables/detail-table"]');
  await expect(host.getByRole('table')).toHaveCount(2);

  const upperBox = await upperCell.boundingBox();
  const lowerBox = await lowerCell.boundingBox();
  expect(upperBox).not.toBeNull();
  expect(lowerBox).not.toBeNull();
  expect(Math.abs(upperBox!.y + upperBox!.height - lowerBox!.y)).toBeLessThanOrEqual(1);

  expect(
    await upperCell.evaluate((element) => {
      const cell = getComputedStyle(element);
      const table = getComputedStyle(element.querySelector('.table-widget')!);
      return {
        cellBottomLeft: cell.borderBottomLeftRadius,
        cellBottomRight: cell.borderBottomRightRadius,
        tableBottomLeft: table.borderBottomLeftRadius,
        tableBottomRight: table.borderBottomRightRadius
      };
    })
  ).toEqual({
    cellBottomLeft: '0px',
    cellBottomRight: '0px',
    tableBottomLeft: '0px',
    tableBottomRight: '0px'
  });
  expect(
    await lowerCell.evaluate((element) => {
      const cell = getComputedStyle(element);
      const table = getComputedStyle(element.querySelector('.table-widget')!);
      const separator = getComputedStyle(element, '::before');
      return {
        background: cell.backgroundColor,
        cellTopLeft: cell.borderTopLeftRadius,
        cellTopRight: cell.borderTopRightRadius,
        cellBottomLeft: cell.borderBottomLeftRadius,
        tableTopLeft: table.borderTopLeftRadius,
        tableTopRight: table.borderTopRightRadius,
        tableBottomLeft: table.borderBottomLeftRadius,
        separatorStyle: separator.borderTopStyle,
        separatorColor: separator.borderTopColor
      };
    })
  ).toEqual({
    background: 'rgb(255, 255, 255)',
    cellTopLeft: '0px',
    cellTopRight: '0px',
    cellBottomLeft: '10px',
    tableTopLeft: '0px',
    tableTopRight: '0px',
    tableBottomLeft: '16px',
    separatorStyle: 'dashed',
    separatorColor: 'rgb(0, 0, 0)'
  });
});

test('指标卡变体与标题分区保持通用的扁平外缘', async ({ page }) => {
  await page.goto('/examples/inline.html');
  await page.evaluate(() => {
    window.runtime.update({
      document: {
        schemaVersion: '4.0',
        id: 'decorated-sections-example',
        dataSources: {
          metrics: {
            fields: {
              category: { type: 'string', role: 'dimension', label: '类别' },
              value: { type: 'number', role: 'measure', label: '数值' },
              change: { type: 'number', role: 'measure', label: '变化' },
              completion: { type: 'number', role: 'measure', label: '完成率' }
            },
            source: {
              type: 'inline',
              rows: [{ category: '卓越', value: 2000, change: -888, completion: 98.2 }]
            }
          }
        },
        sections: [
          {
            id: 'overview',
            layout: { type: 'grid', columns: 12 },
            components: [{
              id: 'summary',
              type: 'metricCard',
              layout: { span: 12 },
              data: { main: 'metrics' },
              props: {
                title: '客户概况',
                variant: 'summary',
                rows: [{ label: '卓越', valueField: 'value', unit: '个' }]
              }
            }]
          },
          {
            id: 'activities',
            layout: { type: 'grid', columns: 12 },
            components: [{
              id: 'activity',
              type: 'metricCard',
              layout: { span: 12 },
              data: { main: 'metrics' },
              props: {
                variant: 'activityProgress',
                rows: [{
                  label: '客户活动（年累计）',
                  valueField: 'value',
                  unit: '次',
                  changes: [{ label: '较上月', field: 'change', unit: '次' }]
                }],
                progress: { valueField: 'completion', label: '完成率' }
              }
            }]
          },
          {
            id: 'details',
            title: '客户明细',
            layout: { type: 'grid', columns: 12 },
            components: [{
              id: 'note',
              type: 'text',
              layout: { span: 12 },
              props: { body: '示例内容' }
            }]
          }
        ]
      }
    });
  });

  const host = page.locator('[data-metriccanvas-runtime]');
  const overview = host.locator('[data-section-id="overview"]');
  const overviewCell = overview.locator(':scope > .section-grid > .cell');
  const activities = host.locator('[data-section-id="activities"]');
  const activityCell = activities.locator(':scope > .section-grid > .cell');
  const details = host.locator('[data-section-id="details"]');

  await expect(overview).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(overview).toHaveCSS('padding', '0px');
  await expect(overviewCell).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(overviewCell).toHaveCSS('padding', '0px');
  await expect(overviewCell.locator('.metric-card.summary')).not.toHaveCSS('background-image', 'none');

  await expect(activities).not.toHaveCSS('background-image', 'none');
  await expect(activityCell).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(activityCell).toHaveCSS('padding', '0px');
  await expect(activities.locator(':scope > .section-grid')).toHaveCSS('column-gap', '12px');

  await expect(details.locator(':scope > .section-title')).toHaveCSS('text-align', 'center');
});

test('活动指标卡在窄容器与手机视口不溢出', async ({ page }) => {
  await page.setViewportSize({ width: 830, height: 738 });
  await page.goto('/examples/inline.html');
  await page.evaluate(() => {
    window.runtime.update({
      document: {
        schemaVersion: '4.0',
        id: 'responsive-activity-example',
        dataSources: {
          activity: {
            fields: {
              count: { type: 'number', role: 'measure', label: '次数' },
              change: { type: 'number', role: 'measure', label: '较上月' },
              completion: { type: 'number', role: 'measure', label: '完成率' }
            },
            source: {
              type: 'inline',
              rows: [{ count: 2000, change: -888, completion: 98.2 }]
            }
          }
        },
        sections: [{
          id: 'activities',
          layout: { type: 'grid', columns: 12 },
          components: ['inspection', 'visit', 'summit'].map((id) => ({
            id,
            type: 'metricCard',
            layout: { span: 4 },
            data: { main: 'activity' },
            props: {
              title: '客户活动（年累计）',
              variant: 'activityProgress',
              rows: [{
                label: '客户活动',
                valueField: { data: 'main', field: 'count', format: 'number-grouped' },
                unit: '次',
                changes: [{
                  label: '较上月',
                  field: { data: 'main', field: 'change', format: 'number-grouped' },
                  unit: '次'
                }]
              }],
              progress: {
                valueField: { data: 'main', field: 'completion', format: 'percent-1' },
                label: '完成率',
                ringPercent: 75
              }
            }
          }))
        }]
      }
    });
  });

  const host = page.locator('[data-metriccanvas-runtime]');
  await expect(host.locator('.metric-card.activity-progress')).toHaveCount(3);

  for (const viewport of [{ width: 830, height: 738 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const containment = await host.locator('.metric-card.activity-progress').evaluateAll((cards) =>
      cards.map((card) => {
        const cardBox = card.getBoundingClientRect();
        const ringBox = card.querySelector('.progress-ring')!.getBoundingClientRect();
        return {
          contained:
            ringBox.left >= cardBox.left - 1 &&
            ringBox.right <= cardBox.right + 1 &&
            ringBox.top >= cardBox.top - 1 &&
            ringBox.bottom <= cardBox.bottom + 1,
          scrollWidth: card.scrollWidth,
          clientWidth: card.clientWidth,
          card: {
            left: cardBox.left,
            right: cardBox.right,
            top: cardBox.top,
            bottom: cardBox.bottom
          },
          ring: {
            left: ringBox.left,
            right: ringBox.right,
            top: ringBox.top,
            bottom: ringBox.bottom,
            width: ringBox.width,
            height: ringBox.height
          }
        };
      })
    );
    expect(
      containment.every((item) => item.contained && item.scrollWidth <= item.clientWidth + 1),
      `viewport ${viewport.width}px: ${JSON.stringify(containment)}`
    ).toBe(true);
  }
});

test('query 页面以内嵌初始行启动，翻页后通过数据网关查询', async ({ page }) => {
  await page.goto('/examples/query.html');
  const host = page.locator('[data-metriccanvas-runtime]');
  const table = host.getByRole('table');

  await expect(host.getByText('区域成交额')).toBeVisible();
  await expect(table.getByText('华东', { exact: true })).toBeVisible();
  await expect(table.getByText('386,000', { exact: true })).toBeVisible();
  await expect(host.getByText(/总条数：\s*25/u)).toBeVisible();
  expect(await page.evaluate(() => window.queryCalls.length)).toBe(0);
  await host.getByRole('button', { name: '下一页' }).click();
  await expect(table.getByText('区域11', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.queryCalls[0]?.pagination)).toEqual({
    offset: 10,
    limit: 10
  });
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
