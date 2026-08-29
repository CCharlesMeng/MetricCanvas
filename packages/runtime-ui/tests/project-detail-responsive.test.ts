import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const runtimeSectionSource = readFileSync(
  new URL('../src/RuntimeSection.svelte', import.meta.url),
  'utf8'
);

describe('项目详情中屏布局', () => {
  it('档案与指标在 1200px 以下按 variant 收成单列', () => {
    expect(runtimeSectionSource).toMatch(
      /@media \(max-width: 1200px\)[\s\S]*?data-component-variant='detailSummary'[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);/
    );
    expect(runtimeSectionSource).toContain(
      ".cell[data-component-variant='projectNorms']"
    );
  });

  it('共享运行时不依赖页面 id', () => {
    expect(runtimeSectionSource).not.toContain('ioc-project-detail');
  });
});
