import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const viewerSource = readFileSync(
  fileURLToPath(new URL('../src/routes/(viewer)/pages/[pageId]/+page.svelte', import.meta.url)),
  'utf8'
);

describe('Canvas dashboard 外框', () => {
  it('默认占满宿主宽度，在 1980px 视口不回退到固定 1679px 轨道', () => {
    const dashboardRule = /\.page-frame\.frame-dashboard\s*\{([^}]*)\}/s.exec(viewerSource)?.[1] ?? '';

    expect(dashboardRule).toContain('width: 100%;');
    expect(dashboardRule).toContain('max-width: none;');
    expect(viewerSource).not.toContain('width: 1679px;');
  });
});
