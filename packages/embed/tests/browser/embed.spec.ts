import { expect, test, type Page } from '@playwright/test';
import type { DataGatewayResult } from '@metriccanvas/runtime';
import type { RuntimeHandle } from '../../src/types';

interface FlowReportDocument {
  [key: string]: unknown;
  dataSources: Record<
    string,
    {
      [key: string]: unknown;
      source: { type: string; initial?: unknown };
    }
  >;
  sections: Array<{
    [key: string]: unknown;
    components: Array<{
      [key: string]: unknown;
      id: string;
      type: string;
      data?: { main: string; [key: string]: string };
      props?: Record<string, unknown>;
    }>;
  }>;
}

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
        schemaVersion: '5.0',
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

test('三档分区容器提供扁平外缘，组件自带表面', async ({ page }) => {
  await page.goto('/examples/inline.html');
  await page.evaluate(() => {
    window.runtime.update({
      document: {
        schemaVersion: '5.0',
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
            container: 'plain',
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
            container: 'panel',
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
            container: 'panel',
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
        schemaVersion: '5.0',
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

test('查询失败按稳定分类呈现并上抛 data-error 嵌入事件,宿主不解析错误字符串', async ({
  page
}) => {
  await page.goto('/examples/query.html');
  await expect(
    page.locator('[data-metriccanvas-runtime]').getByRole('table')
  ).toBeVisible();

  // 表驱动:嵌入宿主按分类决定重登或展示失败(issue #51)。
  const cases = [
    {
      code: 'DQE_AUTH_REQUIRED',
      message: '需要登录后才能执行查询(401)',
      headline: '登录状态已失效，请重新登录后重试'
    },
    {
      code: 'DQE_QUERY_REJECTED',
      message: 'DQE 拒绝执行查询项:FAILED',
      headline: '查询失败'
    },
    {
      code: 'DQE_TIMEOUT',
      message: 'DQE 请求超过 30000ms 未返回',
      headline: '查询暂时不可用，请稍后重试'
    }
  ] as const;

  await page.evaluate(() => {
    window.queryRuntime.destroy();
  });
  for (const testCase of cases) {
    await page.evaluate(
      ({ code, message }) => {
        window.failingRuntime?.destroy();
        // 去掉内嵌初始行,让首次呈现立即执行查询。
        const failingDocument = structuredClone(window.queryPageDocument);
        delete failingDocument.dataSources.sales.source.initial;
        window.queryEvents = [];
        window.failingRuntime = MetricCanvas.mount('#dashboard', {
          document: failingDocument,
          dataGateway: {
            async fetchData() {
              throw Object.assign(new Error(message), { code });
            }
          },
          onEvent(event) {
            window.queryEvents.push(event);
          }
        });
      },
      { code: testCase.code, message: testCase.message }
    );

    const host = page.locator('[data-metriccanvas-runtime]');
    await expect(host.getByText(testCase.headline)).toBeVisible();
    await expect(host.getByText(testCase.message)).toBeVisible();
    await expect(host.getByText(testCase.code)).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.queryEvents.filter(event => event.type === 'data-error')
        )
      )
      .toEqual([
        {
          type: 'data-error',
          dataSourceId: 'sales',
          code: testCase.code,
          message: testCase.message
        }
      ]);
  }
  await page.evaluate(() => {
    window.failingRuntime.destroy();
  });
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

test('报告 AI 总结与指标卡共用摘要正文的浅紫描边样式', async ({ page }) => {
  await page.goto('/examples/inline.html');
  await page.evaluate(() => {
    window.runtime.destroy();
    window.runtime = MetricCanvas.mount('#dashboard', {
      document: {
        schemaVersion: '5.0',
        id: 'report-summary-surface-browser',
        dataSources: {
          metrics: {
            fields: {
              annual: { type: 'number', role: 'measure' },
              monthly: { type: 'number', role: 'measure' }
            },
            source: {
              type: 'inline',
              rows: [{ annual: 22_900_000, monthly: 11_600_000 }]
            }
          }
        },
        sections: [{
          id: 'report-surfaces',
          components: [
            {
              id: 'summary',
              type: 'text',
              layout: { span: 12 },
              props: {
                body: '<span><span class="detail-title tone-positive">增长客户：</span><span class="detail-description">重点客户流水保持稳定。</span><span class="detail-title tone-negative">风险客户：</span><span class="detail-description">需要持续跟踪。</span></span>',
                bodyFormat: 'semanticHtml',
                variant: 'reportInline'
              }
            },
            {
              id: 'summary-long',
              type: 'text',
              layout: { span: 12 },
              props: {
                body: '<span>重点客户流水保持稳定，需要持续跟踪增长来源、下降原因、续签节奏和风险客户变化，并结合后续月份预测及时调整经营动作。重点客户流水保持稳定，需要持续跟踪增长来源、下降原因、续签节奏和风险客户变化，并结合后续月份预测及时调整经营动作。</span>',
                bodyFormat: 'semanticHtml',
                variant: 'reportInline'
              }
            },
            {
              id: 'metrics',
              type: 'metricCard',
              layout: { span: 12 },
              data: { main: 'metrics' },
              props: {
                title: '流水',
                variant: 'compactSummary',
                rows: [
                  { label: '年累计', valueField: 'annual' },
                  { label: '本月', valueField: 'monthly' }
                ]
              }
            }
          ]
        }]
      }
    });
  });

  const host = page.locator('[data-metriccanvas-runtime]');
  const summaries = host.locator('.text-block.report-inline');
  const summary = summaries.first();
  const longSummary = summaries.nth(1);
  const summaryIcon = summary.locator('.inline-icon');
  const positiveText = summary.locator('.tone-positive');
  const negativeText = summary.locator('.tone-negative');
  const metricPanel = host.locator('.metric-panel');
  const metricTitle = metricPanel.locator('h3');
  const metricRows = metricPanel.locator('.metric-row');
  const metricValueLines = metricPanel.locator('.value-line');

  await expect(summaries).toHaveCount(2);
  await expect(summary).toHaveCSS('min-height', '0px');
  await expect(longSummary).toHaveCSS('min-height', '0px');
  await expect.poll(async () => {
    const [shortBox, longBox] = await Promise.all([
      summary.boundingBox(),
      longSummary.boundingBox()
    ]);
    return Boolean(shortBox && longBox && shortBox.height < 122 && longBox.height > shortBox.height);
  }).toBe(true);
  await expect(summary).toHaveCSS('padding', '10px 14px');
  await expect(summary).toHaveCSS('background-color', 'rgb(241, 244, 255)');
  await expect(summary).toHaveCSS('border-color', 'rgb(212, 213, 255)');
  await expect(summary).toHaveCSS('border-style', 'solid');
  await expect(summary).toHaveCSS('border-width', '1px');
  await expect(summary).toHaveCSS('border-radius', '12px');
  await expect(summary).toHaveCSS('font-size', '18px');
  await expect(summary).toHaveCSS('line-height', '26px');
  await expect(summary.locator('.inline-prefix')).toHaveCSS('display', 'grid');
  await expect(summaryIcon).toHaveCSS('margin-top', '3px');
  await expect.poll(async () => {
    const [iconBox, contentBox] = await Promise.all([
      summaryIcon.boundingBox(),
      summary.locator('.inline-content').boundingBox()
    ]);
    return Boolean(iconBox && contentBox && Math.abs(contentBox.x - iconBox.x - 26) <= 1);
  }).toBe(true);
  await expect(positiveText).toHaveCSS('font-weight', '400');
  await expect(negativeText).toHaveCSS('font-weight', '400');

  await expect(metricPanel).toHaveCSS('background-color', 'rgb(241, 244, 255)');
  await expect(metricPanel).toHaveCSS('border-color', 'rgb(212, 213, 255)');
  await expect(metricPanel).toHaveCSS('border-style', 'solid');
  await expect(metricPanel).toHaveCSS('border-width', '1px');
  await expect(metricPanel).toHaveCSS('border-radius', '12px');
  await expect(metricPanel).toHaveCSS('padding', '10px 12px');
  await expect(metricTitle).toHaveCSS('margin-bottom', '12px');
  await expect(metricPanel.locator('.metric-values')).toHaveCSS('row-gap', '0px');
  await expect(metricRows.first()).toHaveCSS('min-height', '40px');
  await expect(metricRows.first().locator('.row-value')).toHaveCSS('line-height', '40px');
  await expect.poll(async () => {
    const [titleBox, firstValueLineBox, secondValueLineBox] = await Promise.all([
      metricTitle.boundingBox(),
      metricValueLines.first().boundingBox(),
      metricValueLines.nth(1).boundingBox()
    ]);
    return Boolean(
      titleBox &&
      firstValueLineBox &&
      secondValueLineBox &&
      Math.abs(firstValueLineBox.y - titleBox.y - titleBox.height - 12) <= 1 &&
      Math.abs(
        secondValueLineBox.y - firstValueLineBox.y - firstValueLineBox.height
      ) <= 1
    );
  }).toBe(true);
});

test('指标面板与风险提示随业务内容自然增高', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto('/examples/inline.html');
  await page.evaluate(() => {
    window.runtime.destroy();
    window.runtime = MetricCanvas.mount('#dashboard', {
      document: {
        schemaVersion: '5.0',
        id: 'adaptive-report-content-browser',
        dataSources: {
          metrics: {
            fields: {
              annual: { type: 'number', role: 'measure' },
              monthly: { type: 'number', role: 'measure' },
              projection: { type: 'number', role: 'measure' }
            },
            source: {
              type: 'inline',
              rows: [{ annual: 22_900_000, monthly: 11_600_000, projection: 34_500_000 }]
            }
          }
        },
        sections: [{
          id: 'adaptive-content',
          container: 'plain',
          components: [
            {
              id: 'metrics',
              type: 'metricCard',
              layout: { span: 12 },
              data: { main: 'metrics' },
              props: {
                title: '流水',
                variant: 'compactSummary',
                rows: [
                  { label: '年累计', valueField: 'annual' },
                  { label: '本月', valueField: 'monthly' },
                  { label: '年度推演', valueField: 'projection' }
                ]
              }
            },
            {
              id: 'risk',
              type: 'text',
              layout: { span: 12 },
              props: {
                body: '这是一条需要在窄容器内自然换行的长风险提示，它不应该被固定高度截断。',
                variant: 'riskNotice',
                maxWidth: 180
              }
            }
          ]
        }]
      }
    });
  });

  const host = page.locator('[data-metriccanvas-runtime]');
  const metricPanel = host.locator('.metric-panel');
  const metricRows = metricPanel.locator('.metric-row');
  const riskNotice = host.locator('.risk-notice');
  const riskBody = riskNotice.locator('.body');

  await expect(metricRows).toHaveCount(3);
  await expect(metricPanel).toHaveCSS('min-height', '136px');
  await expect(metricPanel).toHaveCSS('overflow', 'visible');
  await expect(metricRows.first()).toHaveCSS('min-height', '40px');
  await expect.poll(async () => {
    const box = await metricPanel.boundingBox();
    return Boolean(box && box.height > 136);
  }).toBe(true);
  await expect(riskNotice).toHaveCSS('min-height', '32px');
  await expect(riskNotice).toHaveCSS('overflow', 'visible');
  await expect(riskBody).toHaveCSS('white-space', 'normal');
  await expect.poll(async () => {
    const box = await riskNotice.boundingBox();
    return Boolean(box && box.height > 32);
  }).toBe(true);
  await expect.poll(async () => riskBody.evaluate((body) =>
    body.scrollWidth <= body.clientWidth + 1 && body.scrollHeight <= body.clientHeight + 1
  )).toBe(true);
});

test('reportCompact 内容层与表格等宽且无滚动层', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto('/examples/inline.html');
  const flowReportDocument = await page.evaluate<FlowReportDocument>(async () => {
    const response = await fetch('/pages/flow-analysis-report.json');
    return response.json() as Promise<FlowReportDocument>;
  });
  await page.evaluate((document: FlowReportDocument) => {
    window.runtime.destroy();
    const pendingData = new Promise<DataGatewayResult>(() => {});
    MetricCanvas.mount('#dashboard', {
      document,
      dataGateway: {
        async fetchData() {
          return pendingData;
        }
      }
    });
  }, flowReportDocument);

  const reportTables = page
    .locator('[data-metriccanvas-runtime] [data-section-id="customer-analysis"]')
    .locator('[data-component-type="table"]');
  const frames = reportTables.locator('.content-frame');
  const tables = reportTables.getByRole('table');
  await expect(frames).toHaveCount(2);
  await expect(reportTables.locator('.scroll')).toHaveCount(0);
  await expect(frames.first()).toHaveCSS('border-width', '0px');
  await expect(frames.first()).toHaveCSS('padding', '0px');
  await expect(frames.first()).toHaveCSS('overflow', 'visible');
  await expect(tables.first()).toHaveCSS('border-radius', '0px');
  await expect.poll(async () =>
    reportTables.first().evaluate((tableWidget) => {
      const frame = tableWidget.querySelector('.content-frame');
      const table = tableWidget.querySelector('table');
      if (!(frame instanceof HTMLElement) || !(table instanceof HTMLTableElement)) return false;
      const frameRect = frame.getBoundingClientRect();
      const tableRect = table.getBoundingClientRect();
      const border = frame.clientLeft;
      return (
        Math.abs(tableRect.left - frameRect.left - border) <= 1 &&
        Math.abs(tableRect.top - frameRect.top - border) <= 1 &&
        Math.abs(frameRect.right - border - tableRect.right) <= 1 &&
        Math.abs(frameRect.bottom - border - tableRect.bottom) <= 1
      );
    })
  ).toBe(true);
});

test('流水报告页头背景、表头、分析宽度与客户标签保持统一', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto('/examples/inline.html');
  const flowReportDocument = await page.evaluate<FlowReportDocument>(async () => {
    const response = await fetch('/pages/flow-analysis-report.json');
    return response.json() as Promise<FlowReportDocument>;
  });
  await page.evaluate((document: FlowReportDocument) => {
    window.runtime.destroy();
    const pendingData = new Promise<DataGatewayResult>(() => {});
    MetricCanvas.mount('#dashboard', {
      document,
      dataGateway: {
        async fetchData() {
          return pendingData;
        }
      }
    });
  }, flowReportDocument);

  const host = page.locator('[data-metriccanvas-runtime]');
  const headerBackground = host.locator('[data-decorative-image="header-flow-background"]');
  const yoyReasonHeader = host.locator(
    '[data-component="customer-analysis/yoy-drop-table"] th[data-column-field="reason"]'
  );
  const yoyReasonNegativeValue = host.locator(
    '[data-component="customer-analysis/yoy-drop-table"] tbody tr:first-child '
      + 'td[data-column-field="reason"] data.tone-negative'
  );
  const yoyReasonPositiveValue = host.locator(
    '[data-component="customer-analysis/yoy-drop-table"] tbody tr:first-child '
      + 'td[data-column-field="reason"] data.tone-positive'
  );
  const analysisSections = host.locator(
    '[data-section-id="track-analysis"], [data-section-id="industry-analysis"]'
  );
  const reportTableHeaderRows = host.locator(
    '[data-component-type="table"] thead tr'
  );
  const customerTagCells = host.locator(
    '[data-component="customer-analysis/yoy-drop-table"] tbody tr:first-child td[data-column-field="customer-name"], '
      + '[data-component="customer-analysis/risk-table"] tbody tr:first-child td[data-column-field="customer-name"]'
  );

  await expect(headerBackground).toHaveAttribute('src', /^data:image\/svg\+xml,/);
  await expect.poll(async () => headerBackground.evaluate((image) =>
    image instanceof HTMLImageElement &&
    image.complete &&
    image.naturalWidth === 1774 &&
    image.naturalHeight === 887
  )).toBe(true);
  expect.soft(await yoyReasonHeader.evaluate((header) => {
    const head = header.querySelector('.head');
    if (!(head instanceof HTMLElement)) return null;
    const style = getComputedStyle(header);
    return {
      whiteSpace: style.whiteSpace,
      singleLine: head.getBoundingClientRect().height <= Number.parseFloat(style.lineHeight) + 1,
      fits: header.scrollWidth <= header.clientWidth
    };
  })).toEqual({ whiteSpace: 'nowrap', singleLine: true, fits: true });
  await expect(yoyReasonNegativeValue).toHaveCSS('color', 'rgb(245, 34, 45)');
  await expect(yoyReasonPositiveValue).toHaveCSS('color', 'rgb(82, 196, 26)');
  expect.soft(await analysisSections.evaluateAll((sections) =>
    sections.map((section) => {
      const summary = section.querySelector('.text-block.report-inline');
      const table = section.querySelector('table');
      if (!(summary instanceof HTMLElement) || !(table instanceof HTMLTableElement)) return null;
      return Math.round(summary.getBoundingClientRect().width - table.getBoundingClientRect().width);
    })
  )).toEqual([0, 0]);
  expect.soft(await customerTagCells.evaluateAll((cells) =>
    cells.map((cell) => Array.from(cell.querySelectorAll('small')).map((tag) => {
      const style = getComputedStyle(tag);
      return {
        color: style.color,
        backgroundColor: style.backgroundColor,
        borderRadius: style.borderRadius,
        padding: style.padding
      };
    }))
  )).toEqual([
    [
      {
        color: 'rgb(20, 118, 255)',
        backgroundColor: 'rgba(20, 118, 255, 0.08)',
        borderRadius: '3px',
        padding: '2px 6px'
      },
      {
        color: 'rgb(20, 118, 255)',
        backgroundColor: 'rgba(20, 118, 255, 0.08)',
        borderRadius: '3px',
        padding: '2px 6px'
      }
    ],
    [
      {
        color: 'rgb(20, 118, 255)',
        backgroundColor: 'rgba(20, 118, 255, 0.08)',
        borderRadius: '3px',
        padding: '2px 6px'
      },
      {
        color: 'rgb(20, 118, 255)',
        backgroundColor: 'rgba(20, 118, 255, 0.08)',
        borderRadius: '3px',
        padding: '2px 6px'
      }
    ]
  ]);
  expect.soft(await reportTableHeaderRows.evaluateAll((rows) =>
    rows.every((row) =>
      Array.from(row.querySelectorAll('th')).every((header, index, headers) => {
        const style = getComputedStyle(header);
        return index === headers.length - 1
          ? style.borderRightWidth === '0px'
          : style.borderRightWidth === '1px' &&
              style.borderRightStyle === 'solid' &&
              style.borderRightColor === 'rgb(216, 222, 235)';
      })
    )
  )).toBe(true);
});

test('流水报告的长代表处名称仍由完整背景包裹', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto('/examples/inline.html');
  const flowReportDocument = await page.evaluate<FlowReportDocument>(async () => {
    const response = await fetch('/pages/flow-analysis-report.json');
    return response.json() as Promise<FlowReportDocument>;
  });
  const reportHeader = flowReportDocument.sections
    .flatMap((section) => section.components)
    .find((component) => component.type === 'reportHeader');
  if (!reportHeader?.props) throw new Error('流水分析报告必须声明 reportHeader props');
  reportHeader.props.badge = '北京政企客户联合代表处';

  await page.evaluate((document: FlowReportDocument) => {
    window.runtime.destroy();
    const pendingData = new Promise<DataGatewayResult>(() => {});
    MetricCanvas.mount('#dashboard', {
      document,
      dataGateway: {
        async fetchData() {
          return pendingData;
        }
      }
    });
  }, flowReportDocument);

  const badge = page.locator('[data-metriccanvas-runtime] .lead-badge');
  const badgeText = badge.locator(':scope > span');
  await expect(badgeText).toHaveText('北京政企客户联合代表处');
  const badgePresentation = await badge.evaluate((element) => {
    const text = element.querySelector(':scope > span');
    if (!(text instanceof HTMLElement)) return null;
    const badgeRect = element.getBoundingClientRect();
    const textRect = text.getBoundingClientRect();
    const shape = getComputedStyle(element, '::before');
    const transform = new DOMMatrixReadOnly(shape.transform);
    return {
      hasSvgImage: element.querySelector('img') !== null,
      stretchesPastBaseWidth: badgeRect.width > 208,
      textFitsSafeArea:
        textRect.left >= badgeRect.left + 15 &&
        textRect.right <= badgeRect.right - 15 &&
        textRect.top >= badgeRect.top + 3 &&
        textRect.bottom <= badgeRect.bottom - 3,
      shape: {
        content: shape.content,
        backgroundImage: shape.backgroundImage,
        borderRadius: shape.borderRadius,
        top: shape.top,
        right: shape.right,
        bottom: shape.bottom,
        left: shape.left,
        skewX: transform.c
      }
    };
  });
  expect(badgePresentation).not.toBeNull();
  expect(badgePresentation).toMatchObject({
    hasSvgImage: false,
    stretchesPastBaseWidth: true,
    textFitsSafeArea: true,
    shape: {
      content: '\"\"',
      borderRadius: '12px',
      top: '0px',
      right: '1px',
      bottom: '0px',
      left: '1px'
    }
  });
  expect(badgePresentation?.shape.backgroundImage).toMatch(
    /linear-gradient\(270deg, rgb\(91, 143, 255\).*rgb\(39, 188, 253\)/u
  );
  expect(badgePresentation?.shape.skewX).toBeCloseTo(Math.tan(-2 * Math.PI / 180), 3);
});

test('流水分析报告在四档桌面宽度完整呈现并沿用统一状态', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto('/examples/inline.html');
  const flowReportDocument = await page.evaluate<FlowReportDocument>(async () => {
    const response = await fetch('/pages/flow-analysis-report.json');
    const value: unknown = await response.json();
    const isRecord = (candidate: unknown): candidate is Record<string, unknown> =>
      typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate);
    const isFlowReportDocument = (candidate: unknown): candidate is FlowReportDocument => {
      if (!isRecord(candidate) || !isRecord(candidate.dataSources)) return false;
      if (!Array.isArray(candidate.sections)) return false;
      const validSources = Object.values(candidate.dataSources).every(
        (source) =>
          isRecord(source) &&
          isRecord(source.source) &&
          typeof source.source.type === 'string'
      );
      if (!validSources) return false;
      return candidate.sections.every(
        (section) =>
          isRecord(section) &&
          Array.isArray(section.components) &&
          section.components.every(
            (component) =>
              isRecord(component) &&
              typeof component.id === 'string' &&
              typeof component.type === 'string' &&
              (component.data === undefined ||
                (isRecord(component.data) && typeof component.data.main === 'string'))
          )
      );
    };
    if (!isFlowReportDocument(value)) {
      throw new Error('流水分析报告 JSON 结构无效');
    }
    return value;
  });
  await page.evaluate((document: FlowReportDocument) => {
    if (
      !Object.values(document.dataSources).every(
        (dataSource) => dataSource.source.type === 'query'
      )
    ) {
      throw new Error('流水分析报告必须通过 query + initial 启动');
    }
    window.runtime.destroy();
    const pendingData = new Promise<DataGatewayResult>(() => {});
    (
      window as typeof window & {
        pendingFlowData: Promise<DataGatewayResult>;
      }
    ).pendingFlowData = pendingData;
    const runtime = MetricCanvas.mount('#dashboard', {
      document,
      dataGateway: {
        async fetchData() {
          return pendingData;
        }
      }
    });
    (window as typeof window & { flowReportRuntime: typeof runtime }).flowReportRuntime = runtime;
  }, flowReportDocument);

  const host = page.locator('[data-metriccanvas-runtime]');
  const analysisTableFrames = host
    .locator('[data-section-id="track-analysis"], [data-section-id="industry-analysis"]')
    .locator('[data-component-type="table"] .content-frame');
  await expect(
    host.getByRole('heading', { name: '2026年2月流水分析报告' })
  ).toBeVisible();
  await expect(host.locator('.page-section')).toHaveCount(7);
  await expect(host.locator('[data-component-type="barChart"]')).toHaveCount(2);
  await expect(host.locator('[data-component-type="metricCard"]')).toHaveCount(7);
  await expect(host.locator('[data-component-type="rankingDetailCard"]')).toHaveCount(2);
  await expect(host.getByRole('table')).toHaveCount(4);
  await expect(host.locator('.ai-summary')).toHaveCount(0);
  await expect(analysisTableFrames).toHaveCount(2);
  await expect(analysisTableFrames.first()).toHaveCSS('border-width', '0px');
  await expect(analysisTableFrames.last()).toHaveCSS('border-width', '0px');
  const customerAnalysis = host.locator('[data-section-id="customer-analysis"]');
  const customerAnalysisTitle = customerAnalysis.locator(':scope > .section-title');
  const customerReportTables = customerAnalysis.locator('[data-component-type="table"]');
  const customerReportTableTitles = customerReportTables.getByRole('heading');
  const customerReportTableFrames = customerReportTables.locator('.content-frame');
  const customerReportTableScrollLayers = customerReportTables.locator('.scroll');
  const customerReportTableElements = customerReportTables.getByRole('table');
  const reportRankingTitles = customerAnalysis.locator(
    '[data-component-type="rankingDetailCard"] h3'
  );
  const reportRankingFrames = customerAnalysis.locator(
    '[data-component-type="rankingDetailCard"] .ranking-content'
  );
  const firstReportRanking = customerAnalysis
    .locator('[data-component-type="rankingDetailCard"]')
    .first();
  await expect(customerAnalysisTitle).toHaveCSS('font-size', '20px');
  await expect(customerReportTableTitles).toHaveCount(2);
  await expect(customerReportTableTitles.first()).toHaveCSS('font-size', '18px');
  await expect(customerReportTableFrames).toHaveCount(2);
  await expect(customerReportTableFrames.first()).toHaveCSS('border-width', '0px');
  await expect(customerReportTableFrames.first()).toHaveCSS('border-radius', '12px');
  await expect(customerReportTableFrames.first()).toHaveCSS('padding', '0px');
  await expect(customerReportTableFrames.first()).toHaveCSS('overflow', 'visible');
  await expect(customerReportTableFrames.first()).toHaveCSS(
    'background-color',
    'rgb(252, 252, 255)'
  );
  await expect(customerReportTableScrollLayers).toHaveCount(0);
  await expect(customerReportTableElements).toHaveCount(2);
  await expect(customerReportTableElements.first()).toHaveCSS('border-radius', '0px');
  await expect.poll(async () =>
    customerReportTables.first().evaluate((tableWidget) => {
      const frameElement = tableWidget.querySelector('.content-frame');
      const tableElement = tableWidget.querySelector('table');
      if (!(frameElement instanceof HTMLElement) || !(tableElement instanceof HTMLTableElement)) {
        return false;
      }
      const frameRect = frameElement.getBoundingClientRect();
      const tableRect = tableElement.getBoundingClientRect();
      const border = frameElement.clientLeft;
      return (
        Math.abs(tableRect.left - frameRect.left - border) <= 1 &&
        Math.abs(tableRect.top - frameRect.top - border) <= 1 &&
        Math.abs(frameRect.right - border - tableRect.right) <= 1 &&
        Math.abs(frameRect.bottom - border - tableRect.bottom) <= 1
      );
    })
  ).toBe(true);
  await expect(reportRankingTitles).toHaveCount(1);
  await expect(reportRankingTitles.first()).toHaveCSS('margin-bottom', '6px');
  await expect(reportRankingFrames.first()).toHaveCSS('padding', '18px 12px');
  await expect.poll(async () => {
    const [title, frame] = await Promise.all([
      reportRankingTitles.first().boundingBox(),
      reportRankingFrames.first().boundingBox()
    ]);
    return Boolean(title && frame && Math.abs(frame.y - title.y - title.height - 6) <= 1);
  }).toBe(true);
  await expect.poll(async () =>
    firstReportRanking.evaluate((card) => {
      const frame = card.querySelector('.ranking-content');
      const row = card.querySelector('.ranking-detail-row');
      const nextRow = row?.nextElementSibling;
      const rank = row?.querySelector('.rank');
      const headline = row?.querySelector('.headline');
      const metric = row?.querySelector('.metric-line');
      const description = row?.querySelector('.semantic-description, p');
      if (
        !(frame instanceof HTMLElement) ||
        !(row instanceof HTMLElement) ||
        !(nextRow instanceof HTMLElement) ||
        !(rank instanceof HTMLElement) ||
        !(headline instanceof HTMLElement) ||
        !(metric instanceof HTMLElement) ||
        !(description instanceof HTMLElement)
      ) {
        return null;
      }
      const frameRect = frame.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      const nextRowRect = nextRow.getBoundingClientRect();
      const rankRect = rank.getBoundingClientRect();
      const headlineRect = headline.getBoundingClientRect();
      const metricRect = metric.getBoundingClientRect();
      const descriptionRect = description.getBoundingClientRect();
      return {
        frameToHeadline: Math.round(headlineRect.top - frameRect.top - frame.clientTop),
        rankToHeadline: Math.round(headlineRect.left - rankRect.right),
        headlineToMetric: Math.round(metricRect.top - headlineRect.bottom),
        metricToDescription: Math.round(descriptionRect.top - metricRect.bottom),
        rowGap: Math.round(nextRowRect.top - rowRect.bottom)
      };
    })
  ).toEqual({
    frameToHeadline: 18,
    rankToHeadline: 12,
    headlineToMetric: 16,
    metricToDescription: 12,
    rowGap: 20
  });
  await expect
    .poll(async () =>
      customerReportTables.evaluateAll((tables) =>
        tables.every((table) => {
          const title = table.querySelector('.table-heading');
          const frame = table.querySelector('.content-frame');
          if (!(title instanceof HTMLElement) || !(frame instanceof HTMLElement)) return false;
          return title.getBoundingClientRect().bottom < frame.getBoundingClientRect().top;
        })
      )
    )
    .toBe(true);
  const summaries = host.locator('.text-block.report-inline');
  await expect(summaries).toHaveCount(3);
  await expect(summaries.locator('.semantic-html')).toHaveCount(3);
  await expect(summaries.locator('.inline-prefix')).toHaveCount(3);
  await expect(summaries.locator('.inline-icon')).toHaveCount(3);
  await expect(summaries.locator('.inline-label')).toHaveCount(3);
  await expect(host.getByText('AI 总结：', { exact: true })).toHaveCount(3);
  await expect(summaries.first().locator('.inline-icon')).toHaveCSS('width', '20px');
  await expect(summaries.first().locator('.inline-icon')).toHaveCSS('height', '20px');
  await expect(summaries.first().locator('.inline-icon')).toHaveAttribute(
    'src',
    /^data:image\/svg\+xml,/
  );
  await expect(summaries.first()).toHaveCSS('display', 'block');
  await expect(summaries.first().locator('.semantic-body')).toHaveCSS('display', 'inline');
  await expect(summaries.first().locator('.semantic-html')).toHaveCSS('display', 'inline');
  await expect(summaries.first().locator('.semantic-html > span').first()).toHaveCSS(
    'display',
    'inline'
  );
  await expect(summaries.first()).toHaveCSS('min-height', '0px');
  await expect.poll(async () =>
    summaries.evaluateAll((elements) =>
      elements.every((element) =>
        getComputedStyle(element).minHeight === '0px' &&
        element.scrollHeight - element.clientHeight <= 1
      )
    )
  ).toBe(true);
  await expect(summaries.first()).toHaveCSS('padding', '10px 14px');
  await expect(summaries.first()).toHaveCSS('background-color', 'rgb(241, 244, 255)');
  await expect(summaries.first()).toHaveCSS('border-color', 'rgb(212, 213, 255)');
  await expect(summaries.first()).toHaveCSS('border-style', 'solid');
  await expect(summaries.first()).toHaveCSS('border-width', '1px');
  await expect(summaries.first()).toHaveCSS('border-radius', '12px');
  await expect(summaries.first()).toHaveCSS('font-size', '18px');
  await expect(summaries.first()).toHaveCSS('line-height', '26px');
  await expect(host.getByText('增长客户：', { exact: true })).toHaveCSS(
    'color',
    'rgb(82, 196, 26)'
  );
  await expect(host.getByText('下降客户：', { exact: true })).toHaveCSS(
    'color',
    'rgb(245, 34, 45)'
  );
  await expect(
    host.locator('.bar-chart[data-tooltip="axis"][data-legend="visible"]')
  ).toHaveCount(2);

  const regionMetricPanels = host.locator(
    '[data-section-id="public-region-flow"] .metric-panel'
  );
  await expect(regionMetricPanels).toHaveCount(8);
  await expect.poll(async () =>
    regionMetricPanels.evaluateAll((panels) => {
      const rows: Array<{ top: number; count: number }> = [];
      for (const panel of panels) {
        const top = panel.getBoundingClientRect().top;
        const row = rows.find((candidate) => Math.abs(candidate.top - top) <= 1);
        if (row) row.count += 1;
        else rows.push({ top, count: 1 });
      }
      return rows.sort((left, right) => left.top - right.top).map((row) => row.count);
    })
  ).toEqual([3, 3, 2]);

  const decorativeIcons = host.locator('[data-decorative-icon]');
  const pageContent = host.locator('.page-content');
  const reportHeader = host.locator('.report-header.short-bar');
  const reportCover = reportHeader.locator('.report-cover');
  const reportTitle = reportCover.locator('h1');
  const reportGeneratedBy = reportCover.locator('.generated-by');
  const reportSummary = reportHeader.locator('.report-summary');
  const reportSummaryTitle = reportSummary.locator('.report-summary-title span');
  const reportSummaryFrame = reportSummary.locator('.report-summary-frame');
  const reportSummaryBody = reportSummaryFrame.locator('.report-summary-content');
  const reportBadge = reportCover.locator('.lead-badge');
  const overviewMetricPanels = host.locator(
    '[data-section-id="flow-overview"] .metric-panel'
  );
  const reportMetricPanels = host.locator('[data-component-type="metricCard"] .metric-panel');
  const panelSections = host.locator('[data-section-container="panel"]');
  const panelSectionTitles = panelSections.locator(':scope > .section-title');
  const pageHeadingTitle = host.locator(
    '[data-component="analysis-heading/heading"] .page-heading-title'
  );
  const headerBackground = host.locator('[data-decorative-image="header-flow-background"]');
  await expect(reportCover).toHaveCount(1);
  await expect.poll(async () => reportTitle.evaluate((title) => {
    const titleStyle = getComputedStyle(title);
    const decorationStyle = getComputedStyle(title, '::after');
    const lineHeight = Number.parseFloat(titleStyle.lineHeight);
    const fontSize = Number.parseFloat(titleStyle.fontSize);
    const expectedTop = title.clientHeight - (lineHeight - fontSize) / 2;
    return Math.abs(Number.parseFloat(decorationStyle.top) - expectedTop) <= 1;
  })).toBe(true);
  await expect.poll(async () => {
    const [contentRect, coverRect, generatedByRect, summaryRect] = await Promise.all([
      pageContent.boundingBox(),
      reportCover.boundingBox(),
      reportGeneratedBy.boundingBox(),
      reportSummary.boundingBox()
    ]);
    if (!contentRect || !coverRect || !generatedByRect || !summaryRect) return false;
    return (
      Math.abs(coverRect.x - contentRect.x) <= 1 &&
      Math.abs(coverRect.y - contentRect.y) <= 1 &&
      Math.abs(coverRect.width - contentRect.width) <= 1 &&
      Math.abs(generatedByRect.x - coverRect.x - 26) <= 1 &&
      Math.abs(generatedByRect.y - coverRect.y - 28) <= 1 &&
      Math.abs(summaryRect.y - (coverRect.y + coverRect.height)) <= 1
    );
  }).toBe(true);
  await expect(reportSummary).toHaveCSS(
    'background-image',
    /linear-gradient\(204deg, rgb\(218, 214, 255\) 4%, rgb\(189, 213, 255\) 45%\)/u
  );
  await expect(reportSummary).toHaveCSS('border-radius', '20px');
  await expect(reportSummaryTitle).toHaveCSS('font-weight', '600');
  await expect(reportSummaryFrame).toHaveCSS('min-height', '0px');
  await expect(reportSummaryBody).toHaveCSS('min-height', '0px');
  await expect.poll(async () => {
    const [frameRect, bodyRect] = await Promise.all([
      reportSummaryFrame.boundingBox(),
      reportSummaryBody.boundingBox()
    ]);
    return Boolean(
      frameRect && bodyRect && Math.abs(frameRect.height - bodyRect.height - 30) <= 1
    );
  }).toBe(true);
  await expect(panelSections).toHaveCount(2);
  await expect(panelSections.first()).toHaveCSS('border-radius', '20px');
  await expect(panelSectionTitles).toHaveCount(2);
  await expect(panelSectionTitles.first()).toHaveCSS('font-weight', '600');
  await expect(pageHeadingTitle).toHaveCSS('font-weight', '600');
  await expect(reportBadge.locator('img')).toHaveCount(0);
  const reportBadgeShape = await reportBadge.evaluate((element) => {
    const style = getComputedStyle(element, '::before');
    const transform = new DOMMatrixReadOnly(style.transform);
    return {
      backgroundImage: style.backgroundImage,
      borderRadius: style.borderRadius,
      skewX: transform.c
    };
  });
  expect(reportBadgeShape.backgroundImage).toMatch(
    /linear-gradient\(270deg, rgb\(91, 143, 255\).*rgb\(39, 188, 253\)/u
  );
  expect(reportBadgeShape.borderRadius).toBe('12px');
  expect(reportBadgeShape.skewX).toBeCloseTo(Math.tan(-2 * Math.PI / 180), 3);
  await expect(reportSummaryFrame).toHaveCount(1);
  await expect(reportSummaryFrame).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(reportSummaryFrame).toHaveCSS('border-style', 'none');
  await expect(reportSummaryFrame).toHaveCSS('border-width', '0px');
  await expect(reportSummaryFrame).toHaveCSS('border-radius', '16px');
  await expect(reportSummaryFrame).toHaveCSS('padding', '15px 16px');
  await expect(reportSummaryBody.locator('p')).toHaveCount(1);
  await expect(reportSummaryBody).toHaveCSS('border-color', 'rgb(212, 213, 255)');
  await expect(reportSummaryBody).toHaveCSS('border-style', 'solid');
  await expect(reportSummaryBody).toHaveCSS('border-width', '1px');
  await expect(reportSummaryBody).toHaveCSS('border-radius', '12px');
  await expect(reportSummaryBody).toHaveCSS('background-color', 'rgb(241, 244, 255)');
  await expect(overviewMetricPanels).toHaveCount(3);
  await expect(overviewMetricPanels.first()).toHaveCSS('border-color', 'rgb(212, 213, 255)');
  await expect(overviewMetricPanels.first()).toHaveCSS('border-style', 'solid');
  await expect(overviewMetricPanels.first()).toHaveCSS('border-width', '1px');
  await expect(overviewMetricPanels.first()).toHaveCSS('border-radius', '12px');
  await expect(overviewMetricPanels.first()).toHaveCSS(
    'background-color',
    'rgb(241, 244, 255)'
  );
  await expect(reportMetricPanels).toHaveCount(11);
  await expect.poll(async () => reportMetricPanels.evaluateAll((panels) => panels.every((panel) => {
    const style = getComputedStyle(panel);
    return (
      style.backgroundColor === 'rgb(241, 244, 255)' &&
      style.borderTopColor === 'rgb(212, 213, 255)' &&
      style.borderTopStyle === 'solid' &&
      style.borderTopWidth === '1px' &&
      style.borderRadius === '12px'
    );
  }))).toBe(true);
  await expect(headerBackground).toHaveCount(1);
  await expect(headerBackground).toHaveAttribute('src', /^data:image\/svg\+xml/);
  await expect(headerBackground).toHaveCSS('object-fit', 'cover');
  await expect.poll(async () => headerBackground.evaluate((image) => {
    if (!(image instanceof HTMLImageElement)) return false;
    const imageRect = image.getBoundingClientRect();
    const headerRect = image.parentElement?.getBoundingClientRect();
    return Boolean(
      image.complete &&
      image.naturalWidth > 0 &&
      image.naturalHeight > 0 &&
      headerRect &&
      Math.abs(imageRect.width - headerRect.width) <= 1 &&
      Math.abs(imageRect.height - headerRect.height) <= 1
    );
  })).toBe(true);
  await expect.poll(async () => reportHeader.evaluate((header) => {
    const background = header.querySelector('[data-decorative-image="header-flow-background"]');
    const cover = header.querySelector('.report-cover');
    const summary = header.querySelector('.report-summary');
    if (!(background instanceof HTMLElement) || !(cover instanceof HTMLElement)) return false;
    if (!(summary instanceof HTMLElement)) return false;
    const backgroundRect = background.getBoundingClientRect();
    const coverRect = cover.getBoundingClientRect();
    const summaryRect = summary.getBoundingClientRect();
    return (
      background.parentElement === cover &&
      Math.abs(backgroundRect.height - coverRect.height) <= 1 &&
      backgroundRect.bottom <= summaryRect.top
    );
  })).toBe(true);
  await expect(host.locator('[data-decorative-icon="section-title-left"]')).toHaveCount(4);
  await expect(host.locator('[data-decorative-icon="section-title-right"]')).toHaveCount(4);
  await expect(host.locator('[data-decorative-icon="risk-warning"]')).toHaveCount(1);
  await expect(host.locator('[data-decorative-icon="ranking-growth"]')).toHaveCount(1);
  await expect(host.locator('[data-decorative-icon="ranking-decline"]')).toHaveCount(0);
  await expect(decorativeIcons).toHaveCount(10);
  await expect(decorativeIcons.first()).toHaveAttribute('src', /^data:image\/svg\+xml/);
  const riskNotices = host.locator('.text-block.risk-notice');
  await expect(riskNotices).toHaveCount(1);
  await expect.poll(async () => riskNotices.evaluateAll((notices) => notices.every((notice) => {
    const body = notice.querySelector('.body');
    return body instanceof HTMLElement && body.scrollWidth - body.clientWidth <= 1;
  }))).toBe(true);

  const trendChart = host.locator('[data-component="flow-overview/overall-trend"] .echart');
  await expect(trendChart.locator('canvas')).toBeVisible();
  const trendBox = await trendChart.boundingBox();
  expect(trendBox).not.toBeNull();
  const januaryTooltip = host
    .locator('[data-component="flow-overview/overall-trend"]')
    .getByText('1月', { exact: true });
  for (const xRatio of [0.05, 0.07, 0.09, 0.11, 0.13, 0.15]) {
    await trendChart.hover({
      position: {
        x: trendBox!.width * xRatio,
        y: trendBox!.height * 0.55
      }
    });
    if (await januaryTooltip.isVisible().catch(() => false)) break;
  }
  await expect(januaryTooltip).toBeVisible();

  for (const width of [1000, 1200, 1680, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(
        () =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth + 1
          ),
        { message: `${width}px horizontal scroll after resize` }
      )
      .toBe(true);
    const layout = await host.locator('.page-content').evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        contentWidth: rect.width,
        centerOffset: Math.abs((rect.left + rect.right) / 2 - window.innerWidth / 2)
      };
    });
    expect(layout.documentWidth, `${width}px horizontal scroll`).toBeLessThanOrEqual(
      layout.viewportWidth + 1
    );
    if (width >= 1680) {
      expect(layout.contentWidth).toBeCloseTo(1200, 0);
      expect(layout.centerOffset).toBeLessThanOrEqual(1);
    }
  }

  await page.setViewportSize({ width: 622, height: 738 });
  await expect.poll(async () => summaries.first().evaluate((summary) => {
    const parent = summary.parentElement;
    if (!parent) return false;
    const summaryRect = summary.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    return summaryRect.left >= parentRect.left - 1 && summaryRect.right <= parentRect.right + 1;
  })).toBe(true);
  await page.setViewportSize({ width: 1200, height: 900 });

  await page.evaluate((sourceDocument: FlowReportDocument) => {
    const document = structuredClone(sourceDocument);
    const pendingSource = structuredClone(document.dataSources['customer-yoy-drop-top']);
    if (pendingSource.source.type !== 'query') {
      throw new Error('客户同比下降数据源必须为 query');
    }
    delete pendingSource.source.initial;
    document.dataSources['customer-yoy-drop-pending'] = pendingSource;
    const table = document.sections
      .flatMap((section) => section.components)
      .find((component) => component.id === 'yoy-drop-table');
    if (table?.type !== 'table' || !table.data) throw new Error('未找到同比下降客户表');
    table.data.main = 'customer-yoy-drop-pending';
    (
      window as typeof window & { flowReportRuntime: RuntimeHandle }
    ).flowReportRuntime.update({
      document,
      dataGateway: {
        async fetchData() {
          return (
            window as typeof window & {
              pendingFlowData: Promise<DataGatewayResult>;
            }
          ).pendingFlowData;
        }
      }
    });
  }, flowReportDocument);
  const yoyDropTable = host.locator('[data-component="customer-analysis/yoy-drop-table"]');
  await expect(yoyDropTable.locator('.skeleton')).toBeVisible();

  await page.evaluate((sourceDocument: FlowReportDocument) => {
    const document = structuredClone(sourceDocument);
    const emptySource = structuredClone(document.dataSources['customer-yoy-drop-top']);
    if (emptySource.source.type !== 'query') {
      throw new Error('客户同比下降数据源必须为 query');
    }
    delete emptySource.source.initial;
    document.dataSources['customer-yoy-drop-empty'] = emptySource;
    const table = document.sections
      .flatMap((section) => section.components)
      .find((component) => component.id === 'yoy-drop-table');
    if (table?.type !== 'table' || !table.data) throw new Error('未找到同比下降客户表');
    table.data.main = 'customer-yoy-drop-empty';
    (
      window as typeof window & { flowReportRuntime: RuntimeHandle }
    ).flowReportRuntime.update({
      document,
      dataGateway: {
        async fetchData() {
          return { rows: [], totalCount: 0 };
        }
      }
    });
  }, flowReportDocument);
  await expect(yoyDropTable.getByText('暂无数据', { exact: true })).toBeVisible();

  await page.evaluate((sourceDocument: FlowReportDocument) => {
    const document = structuredClone(sourceDocument);
    const errorSource = structuredClone(document.dataSources['customer-yoy-drop-top']);
    if (errorSource.source.type !== 'query') {
      throw new Error('客户同比下降数据源必须为 query');
    }
    delete errorSource.source.initial;
    document.dataSources['customer-yoy-drop-error'] = errorSource;
    const table = document.sections
      .flatMap((section) => section.components)
      .find((component) => component.id === 'yoy-drop-table');
    if (table?.type !== 'table' || !table.data) throw new Error('未找到同比下降客户表');
    table.data.main = 'customer-yoy-drop-error';
    (
      window as typeof window & { flowReportRuntime: RuntimeHandle }
    ).flowReportRuntime.update({
      document,
      dataGateway: {
        async fetchData() {
          throw new Error('流水数据网关测试错误');
        }
      }
    });
  }, flowReportDocument);
  // 错误块按分类呈现:标题(处理语义)+ 脱值消息 + 分类标识(issue #51);
  // 普通 Error 未携带查询错误分类,兜底为 UNKNOWN。
  await expect(yoyDropTable.getByRole('alert')).toContainText('流水数据网关测试错误');
  await expect(yoyDropTable.getByRole('alert')).toContainText('UNKNOWN');
  await expect(host.getByRole('heading', { name: '2026年2月流水分析报告' })).toBeVisible();
});

test('详细排行卡可展开受控的嵌套明细字段', async ({ page }) => {
  await page.goto('/examples/inline.html');
  await page.evaluate(() => {
    window.runtime.destroy();
    window.runtime = MetricCanvas.mount('#dashboard', {
      document: {
        schemaVersion: '5.0',
        id: 'nested-detail-browser',
        dataSources: {
          decline: {
            fields: {
              customer: { type: 'string', role: 'dimension', label: '客户名称' },
              delta: {
                type: 'number',
                role: 'measure',
                label: '月变化',
                defaultFormat: 'compact-wan-1'
              },
              attributions: {
                type: 'recordList',
                role: 'detail',
                label: '归因明细',
                items: {
                  fields: {
                    service: { type: 'string', role: 'dimension' },
                    amount: {
                      type: 'number',
                      role: 'measure',
                      defaultFormat: 'compact-wan-1'
                    },
                    reason: { type: 'string', role: 'dimension' }
                  }
                }
              }
            },
            source: {
              type: 'inline',
              rows: [{
                customer: '客户A',
                delta: -1_200_000,
                attributions: [{
                  service: 'ModelArts',
                  amount: -1_200_000,
                  reason: '到期未续订导致流水下降'
                }]
              }]
            }
          }
        },
        sections: [{
          id: 'main',
          components: [{
            id: 'ranking',
            type: 'rankingDetailCard',
            layout: { span: 12 },
            data: { main: 'decline' },
            props: {
              title: '下降客户',
              variant: 'report',
              tone: 'negative',
              nameField: 'customer',
              valueField: 'delta',
              details: {
                field: 'attributions',
                titleField: 'service',
                valueField: { field: 'amount' },
                descriptionField: 'reason'
              }
            }
          }]
        }]
      }
    });
  });

  const host = page.locator('[data-metriccanvas-runtime]');
  await expect(host.locator('[data-decorative-icon="ranking-decline"]')).toHaveCount(1);
  await expect(host.getByText('客户A')).toBeVisible();
  await expect(host.getByText('-120.0万').first()).toBeVisible();
  const details = host.locator('details.nested-details');
  await expect(details.locator('summary')).toHaveText('归因明细（1）');
  await expect(details.getByText('到期未续订导致流水下降')).toBeHidden();
  await details.locator('summary').click();
  await expect(details.getByText('ModelArts')).toBeVisible();
  await expect(details.getByText('到期未续订导致流水下降')).toBeVisible();
});

test('详细排行卡把 DQE 语义 HTML 直接渲染为说明，并由前端映射正负颜色', async ({ page }) => {
  await page.goto('/examples/inline.html');
  await page.evaluate(() => {
    window.runtime.destroy();
    window.runtime = MetricCanvas.mount('#dashboard', {
      document: {
        schemaVersion: '5.0',
        id: 'semantic-html-detail-browser',
        dataSources: {
          decline: {
            fields: {
              customer: { type: 'string', role: 'dimension' },
              delta: {
                type: 'number',
                role: 'measure',
                defaultFormat: 'compact-wan-1'
              },
              attributions: {
                type: 'semanticHtml',
                role: 'detail'
              }
            },
            source: {
              type: 'inline',
              rows: [{
                customer: '客户A',
                delta: -1_200_000,
                attributions:
                  '<span class="detail-title">ModelArts</span>：' +
                  '<span class="detail-description">到期未续订</span>' +
                  '<span class="detail-value tone-negative">（-12.0万）</span>；' +
                  '<span class="detail-title">OBS</span>：' +
                  '<span class="detail-description">用量增加</span>' +
                  '<span class="detail-value tone-positive">（3.0万）</span>'
              }]
            }
          }
        },
        sections: [{
          id: 'main',
          components: [{
            id: 'ranking',
            type: 'rankingDetailCard',
            layout: { span: 12 },
            data: { main: 'decline' },
            props: {
              title: '下降客户',
              nameField: 'customer',
              valueField: 'delta',
              semanticDescriptionField: 'attributions'
            }
          }]
        }]
      }
    });
  });

  const host = page.locator('[data-metriccanvas-runtime]');
  await expect(host.locator('details.nested-details')).toHaveCount(0);
  await expect(host.getByText('ModelArts')).toBeVisible();
  await expect(host.getByText('到期未续订')).toBeVisible();
  await expect(host.getByText('（-12.0万）')).toHaveCSS('color', 'rgb(245, 34, 45)');
  await expect(host.getByText('（3.0万）')).toHaveCSS('color', 'rgb(82, 196, 26)');
});

test('并排的详细排行卡按同一排名的较高内容同步行高', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto('/examples/inline.html');
  await page.evaluate(() => {
    const detailField = { type: 'semanticHtml' as const, role: 'detail' as const };
    const customerField = { type: 'string' as const, role: 'dimension' as const };
    const amountField = { type: 'number' as const, role: 'measure' as const };
    const shortDetail =
      '<span class="detail-title">云通信</span>：' +
      '<span class="detail-description">流水增长</span>' +
      '<span class="detail-value tone-positive">（50万）</span>';
    const longDetail = Array.from({ length: 7 }, (_, index) =>
      '<span class="detail-title">ModelArts</span>：' +
      `<span class="detail-description">第${index + 1}项归因明细内容较长</span>` +
      '<span class="detail-value tone-negative">（-50万）</span>'
    ).join('；');
    const source = (prefix: string, details: string[]) => ({
      fields: {
        customer: customerField,
        amount: amountField,
        details: detailField
      },
      source: {
        type: 'inline' as const,
        rows: details.map((value, index) => ({
          customer: `${prefix}${index + 1}`,
          amount: 5_000_000 - index * 100_000,
          details: value
        }))
      }
    });

    window.runtime.destroy();
    window.runtime = MetricCanvas.mount('#dashboard', {
      document: {
        schemaVersion: '5.0',
        id: 'ranking-detail-row-height-sync-browser',
        dataSources: {
          growth: source('增长客户', [shortDetail, shortDetail, shortDetail]),
          decline: source('下降客户', [longDetail, shortDetail, shortDetail])
        },
        sections: [{
          id: 'customer-analysis',
          container: 'card',
          components: [
            {
              id: 'growth-ranking',
              type: 'rankingDetailCard',
              layout: { span: 6 },
              data: { main: 'growth' },
              props: {
                title: 'TOP增长流水客户',
                variant: 'report',
                nameField: 'customer',
                valueField: 'amount',
                semanticDescriptionField: 'details'
              }
            },
            {
              id: 'decline-ranking',
              type: 'rankingDetailCard',
              layout: { span: 6 },
              data: { main: 'decline' },
              props: {
                title: 'TOP下降流水客户',
                variant: 'report',
                nameField: 'customer',
                valueField: 'amount',
                semanticDescriptionField: 'details'
              }
            }
          ]
        }]
      }
    });
  });

  const host = page.locator('[data-metriccanvas-runtime]');
  const growthRows = host.locator(
    '[data-component="customer-analysis/growth-ranking"] .ranking-detail-row'
  );
  const declineRows = host.locator(
    '[data-component="customer-analysis/decline-ranking"] .ranking-detail-row'
  );
  const growthFrame = host.locator(
    '[data-component="customer-analysis/growth-ranking"] .ranking-content'
  );
  await expect(growthRows).toHaveCount(3);
  await expect(declineRows).toHaveCount(3);
  await expect(growthFrame).toHaveCSS('padding', '18px 12px');
  await expect.poll(async () =>
    growthFrame.evaluate((frame) => {
      const rows = frame.querySelectorAll('.ranking-detail-row');
      const firstRow = rows[0];
      const secondRow = rows[1];
      const rank = firstRow?.querySelector('.rank');
      const headline = firstRow?.querySelector('.headline');
      const metric = firstRow?.querySelector('.metric-line');
      const description = firstRow?.querySelector('.semantic-description');
      if (
        !(firstRow instanceof HTMLElement) ||
        !(secondRow instanceof HTMLElement) ||
        !(rank instanceof HTMLElement) ||
        !(headline instanceof HTMLElement) ||
        !(metric instanceof HTMLElement) ||
        !(description instanceof HTMLElement)
      ) {
        return null;
      }
      const firstRowRect = firstRow.getBoundingClientRect();
      const secondRowRect = secondRow.getBoundingClientRect();
      const rankRect = rank.getBoundingClientRect();
      const headlineRect = headline.getBoundingClientRect();
      const metricRect = metric.getBoundingClientRect();
      const descriptionRect = description.getBoundingClientRect();
      return {
        rankToHeadline: Math.round(headlineRect.left - rankRect.right),
        headlineToMetric: Math.round(metricRect.top - headlineRect.bottom),
        metricToDescription: Math.round(descriptionRect.top - metricRect.bottom),
        rowGap: Math.round(secondRowRect.top - firstRowRect.bottom)
      };
    })
  ).toEqual({
    rankToHeadline: 12,
    headlineToMetric: 16,
    metricToDescription: 12,
    rowGap: 20
  });
  await expect.poll(async () => {
    const [growthBoxes, declineBoxes] = await Promise.all([
      growthRows.evaluateAll((rows) => rows.map((row) => row.getBoundingClientRect())),
      declineRows.evaluateAll((rows) => rows.map((row) => row.getBoundingClientRect()))
    ]);
    return growthBoxes.every((growthBox, index) => {
      const declineBox = declineBoxes[index]!;
      return (
        Math.abs(growthBox.height - declineBox.height) <= 1 &&
        Math.abs(growthBox.top - declineBox.top) <= 1
      );
    });
  }).toBe(true);

  // 响应式堆叠成单列后自动复原:首行回到各自的自然高度。
  await page.setViewportSize({ width: 700, height: 900 });
  await expect.poll(async () => {
    const [growthFirst, declineFirst] = await Promise.all([
      growthRows.first().evaluate((row) => row.getBoundingClientRect().height),
      declineRows.first().evaluate((row) => row.getBoundingClientRect().height)
    ]);
    return declineFirst - growthFirst;
  }).toBeGreaterThan(1);
});
