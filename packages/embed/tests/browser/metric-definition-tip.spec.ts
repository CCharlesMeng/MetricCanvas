import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { MetricDefinition } from '../../src';

const demo: unknown = JSON.parse(readFileSync(
  new URL('../../../../pages/capabilities/layout/metric-card-definition-tip.json', import.meta.url), 'utf8'
));

declare global {
  interface Window {
    metricDefinitionCalls: { code: string; signal?: AbortSignal }[];
    finishFirstMetricDefinition: () => void;
  }
}

for (const mode of ['classic', 'esm', 'esm-without-signal-any'] as const) {
  test(`${mode} 英文宿主的标题及指标行气泡使用中文并取消过期请求`, async ({ page }) => {
    if (mode === 'esm-without-signal-any') {
      await page.addInitScript(() => Object.defineProperty(AbortSignal, 'any', { value: undefined }));
    }
    await page.goto('/examples/inline.html');
    await page.evaluate(async ({ demo, mode }) => {
      document.documentElement.lang = 'en-US';
      window.runtime.destroy();
      const url = '/dist/metriccanvas-runtime.es.js';
      const api = mode === 'classic' ? MetricCanvas : await import(url);
      class Gateway {
        async fetchData() { return { rows: [] }; }
        async fetchFilterCandidates() { return { kind: 'unavailable' } as const; }
        async fetchMetricDefinitions(codes: string[], options?: { signal?: AbortSignal }): Promise<MetricDefinition[]> {
          const code = codes[0]!;
          this.calls.push({ code, signal: options?.signal });
          if (code === 'ZB0000377') {
            await new Promise<void>(resolve => { window.finishFirstMetricDefinition = resolve; });
          }
          if (code === 'DEMO-RETRY') throw Object.assign(new Error('模拟鉴权拒绝'), { detail: { status: 401 } });
          if (code === 'DEMO-NO-LINK') return [];
          return [{
            code, name: code === 'ZB0000377' ? '旧定义' : '当前定义',
            definition: 'Original gateway definition.', formula: 'Revenue / cost', manager: 'Operations team',
            latestUpdateTime: null, url: 'javascript:void(0)'
          }];
        }
        calls: Window['metricDefinitionCalls'] = [];
      }
      const dataGateway = new Gateway();
      window.metricDefinitionCalls = dataGateway.calls;
      window.runtime = api.mount('#dashboard', { document: demo, dataGateway, onAuthRequired() {
        throw new Error('指标定义失败不应终止页面');
      } });
    }, { demo, mode });
    const first = page.getByRole('button', { name: '查看销售毛利率的指标定义' });
    const second = page.getByRole('button', { name: '查看销售收入的指标定义' });
    const panel = page.getByRole('dialog');
    await expect(first.locator('..')).toHaveRole('heading');
    await expect(first.locator('..')).toHaveText('销售毛利率?');
    expect(await page.evaluate(() => window.metricDefinitionCalls)).toHaveLength(0);
    await first.hover();
    await expect(panel.getByRole('status')).toContainText('正在加载');
    await second.hover();
    await expect(panel).toHaveCount(1);
    await expect(panel).toContainText('当前定义');
    await expect(panel.locator('dt')).toHaveText(['指标名称（指标编码）', '指标定义', '计算公式', '指标解释人']);
    await expect(panel.locator('dd')).toHaveText([
      '当前定义（DEMO-REVENUE）', 'Original gateway definition.', 'Revenue / cost', 'Operations team'
    ]);
    await expect(panel.getByRole('link')).toHaveCount(0);
    expect(await page.evaluate(() => window.metricDefinitionCalls.map(call => [call.code, call.signal?.aborted])))
      .toEqual([['ZB0000377', true], ['DEMO-REVENUE', false]]);
    await page.evaluate(() => window.finishFirstMetricDefinition());
    await expect(panel).not.toContainText('旧定义');
    await second.press('Enter');
    await expect(panel).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(second).toBeFocused();
    await page.mouse.move(0, 0);
    await second.hover();
    await expect(panel).toContainText('当前定义（DEMO-REVENUE）');
    expect(await page.evaluate(() => window.metricDefinitionCalls.map(call => call.code)))
      .toEqual(['ZB0000377', 'DEMO-REVENUE']);
    await expect(page.getByRole('heading', { name: '闭环指标', exact: true })).toBeVisible();
    await page.locator('.row-label').getByRole('button', { name: '查看总闭环率的指标定义' }).hover();
    await expect(panel).toContainText('DEMO-TOTAL-CLOSURE');
    await page.locator('.row-label').getByRole('button', { name: '查看框架执行率的指标定义' }).hover();
    await expect(panel).toContainText('DEMO-FRAMEWORK-EXECUTION');
    await page.getByRole('heading', { name: '框架执行率', exact: false }).getByRole('button').hover();
    await expect(panel).toContainText('网络出小差了');
    await expect(first).toBeVisible();
    await page.getByRole('button', { name: '查看闭环率的指标定义' }).hover();
    await expect(panel).toHaveAccessibleName('闭环率');
    await expect(panel.getByRole('button', { name: '重新加载' })).toBeVisible();
    await first.hover();
    await expect(panel.getByRole('status')).toContainText('正在加载');
    await page.evaluate(demo => window.runtime.update({ document: demo }), demo);
    await expect(page.locator('[data-metric-definition-trigger]')).toHaveCount(0);
    expect(await page.evaluate(() => window.metricDefinitionCalls.at(-1)?.signal?.aborted)).toBe(true);

    await page.evaluate(demo => window.runtime.update({
      document: demo,
      dataGateway: {
        async fetchData() { return { rows: [] }; },
        async fetchMetricDefinitions([code]) {
          return [{ code: code!, name: '新会话定义', definition: '定义', formula: '公式', manager: '解释人', latestUpdateTime: null, url: null }];
        }
      }
    }), demo);
    await second.hover();
    await expect(panel).toContainText('新会话定义（DEMO-REVENUE）');
  });
}
