import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  canSubmitComposer,
  shouldSubmitComposerKeydown
} from '../../src/lib/workbench/composer-behavior';

const layoutSource = readFileSync(
  fileURLToPath(new URL('../../src/routes/+layout.svelte', import.meta.url)),
  'utf8'
);
const workbenchSource = readFileSync(
  fileURLToPath(new URL('../../src/lib/PageAuthoringWorkbench.svelte', import.meta.url)),
  'utf8'
);
const runtimeViewSource = readFileSync(
  fileURLToPath(
    new URL('../../../../packages/engine/runtime-ui/src/RuntimeSurface.svelte', import.meta.url)
  ),
  'utf8'
);

describe('Platform 样式 token 边界', () => {
  it('统一运行时保有 --mc-* token，Platform 壳层不重复声明', () => {
    expect(runtimeViewSource).toContain('--mc-color-canvas:');
    expect(runtimeViewSource).toContain('--mc-color-surface:');
    expect(`${layoutSource}\n${workbenchSource}`).not.toMatch(/--mc-[\w-]+\s*:/);
  });

  it('分析会话轨使用浅色 surface，输入由独立盘古模块承担', () => {
    expect(workbenchSource).toMatch(/\.chat\s*\{[^}]*color:\s*var\(--text\)[^}]*background:\s*var\(--surface\)/);
    expect(workbenchSource).toContain('<PanguDialogue');
    expect(workbenchSource).not.toContain('<textarea');
  });

  it('分析会话轨在所有工作台断点保持 480px 宽', () => {
    expect(layoutSource).toMatch(/--analysis-rail-w:\s*480px;/);
    const breakpointWidths = [...workbenchSource.matchAll(/--analysis-rail-w:\s*([^;]+);/g)]
      .map((match) => match[1].trim());
    expect(breakpointWidths).toEqual(['480px']);
  });

  it('强调背景前景消费语义 token，页面管理入口只保留在全局导航', () => {
    expect(layoutSource).toMatch(/--text-on-strong:\s*#(?:fff|ffffff);/);
    expect(layoutSource).toMatch(/--down-strong:\s*#[0-9a-f]{6};/i);
    expect(`${layoutSource}\n${workbenchSource}`).not.toMatch(
      /(?:color|background):\s*#fff\b/
    );
    expect(workbenchSource).not.toContain('rgb(99 102 241 / 16%)');
    expect(workbenchSource).not.toContain('打开页面目录');
    expect(layoutSource).toContain("{ href: '/manage', label: '页面管理' }");
  });
});

describe('AI composer 键盘与禁用判定', () => {
  it('仅在非输入法组词、未按 Shift 的 Enter 上提交', () => {
    expect(
      shouldSubmitComposerKeydown({ key: 'Enter', shiftKey: false, isComposing: false })
    ).toBe(true);
    expect(
      shouldSubmitComposerKeydown({ key: 'Enter', shiftKey: true, isComposing: false })
    ).toBe(false);
    expect(
      shouldSubmitComposerKeydown({ key: 'Enter', shiftKey: false, isComposing: true })
    ).toBe(false);
    expect(
      shouldSubmitComposerKeydown({ key: 'A', shiftKey: false, isComposing: false })
    ).toBe(false);
  });

  it('空白输入或运行中拒绝再次提交', () => {
    expect(canSubmitComposer('', false)).toBe(false);
    expect(canSubmitComposer('   ', false)).toBe(false);
    expect(canSubmitComposer('各区域 Tokens 消耗量', true)).toBe(false);
    expect(canSubmitComposer('各区域 Tokens 消耗量', false)).toBe(true);
  });
});
