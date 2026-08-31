import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const runtimeSectionSource = readFileSync(
  new URL('../src/RuntimeSection.svelte', import.meta.url),
  'utf8'
);
const runtimeViewSource = readFileSync(
  new URL('../src/RuntimeView.svelte', import.meta.url),
  'utf8'
);
const dashboardToolbarSource = readFileSync(
  new URL('../src/dashboard/DashboardToolbar.svelte', import.meta.url),
  'utf8'
);

describe('运行时组件布局盒响应式契约', () => {
  it('组件布局盒提供 inline-size 容器且父网格不读取子 variant', () => {
    expect(runtimeSectionSource).toMatch(
      /\.cell\s*\{[^}]*container:\s*mc-component-box\s*\/\s*inline-size;/s
    );
    expect(runtimeSectionSource).not.toContain('mc-content-unit');
    expect(runtimeSectionSource).not.toContain(
      ":has(> .cell[data-component-variant='detailSummary'])"
    );
    expect(runtimeSectionSource).not.toContain(
      ":has(> .cell[data-component-variant='projectNorms'])"
    );
  });

  it('共享运行时不依赖页面 id', () => {
    expect(runtimeSectionSource).not.toContain('ioc-project-detail');
  });

  it('运行时布局只按宿主容器响应，不读取外部 viewport', () => {
    expect(runtimeViewSource).toMatch(
      /\.runtime-view\s*\{[^}]*container:\s*mc-runtime\s*\/\s*inline-size;/s
    );
    for (const source of [runtimeViewSource, runtimeSectionSource, dashboardToolbarSource]) {
      expect(source).not.toContain('@media (max-width');
    }
    expect(runtimeSectionSource).toContain('@container mc-runtime (max-width: 1050px)');
    expect(runtimeSectionSource).toContain('@container mc-runtime (max-width: 760px)');
    expect(dashboardToolbarSource).toContain('@container mc-runtime (max-width: 1050px)');
  });
});
