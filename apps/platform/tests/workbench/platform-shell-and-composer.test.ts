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
    new URL('../../../../packages/runtime-ui/src/RuntimeView.svelte', import.meta.url)
  ),
  'utf8'
);

describe('Platform 样式 token 边界', () => {
  it('统一运行时保有 --mc-* token，Platform 壳层不重复声明', () => {
    expect(runtimeViewSource).toContain('--mc-color-canvas:');
    expect(runtimeViewSource).toContain('--mc-color-surface:');
    expect(`${layoutSource}\n${workbenchSource}`).not.toMatch(/--mc-[\w-]+\s*:/);
  });

  it('分析会话轨与 AI composer 统一使用浅色 surface', () => {
    expect(workbenchSource).toMatch(
      /\.chat\s*\{[^}]*color:\s*var\(--text\)[^}]*background:\s*var\(--surface\)/
    );
    expect(workbenchSource).toMatch(
      /\.composer\s*\{[^}]*background:\s*var\(--surface\)/
    );
    expect(workbenchSource).toMatch(
      /\.composer-box\s*\{[^}]*background:\s*var\(--surface-subtle\)/
    );
    expect(workbenchSource).not.toMatch(
      /\.(?:chat|composer)\s*\{[^}]*background:\s*var\(--panel-dark(?:-strong)?\)/
    );
  });

  it('强调背景前景与浅色会话链接消费语义 token', () => {
    expect(layoutSource).toMatch(/--text-on-strong:\s*#(?:fff|ffffff);/);
    expect(layoutSource).toMatch(/--down-strong:\s*#[0-9a-f]{6};/i);
    expect(`${layoutSource}\n${workbenchSource}`).not.toMatch(
      /(?:color|background):\s*#fff\b/
    );
    expect(workbenchSource).not.toContain('rgb(99 102 241 / 16%)');
    expect(workbenchSource).toContain(
      'color-mix(in srgb, var(--accent) 16%, transparent)'
    );
    expect(workbenchSource).toMatch(
      /\.composer \.stop:hover\s*\{[^}]*background:\s*var\(--down-strong\)/
    );
    expect(workbenchSource).toMatch(
      /\.linkish\s*\{[^}]*color:\s*var\(--accent-strong\)/
    );
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

describe('新建会话的异步边界', () => {
  it('保存期间不允许清空会话', () => {
    expect(workbenchSource).toMatch(
      /function startNewSession\(\)\s*\{\s*if \(running \|\| savePending\) return;/
    );
    expect(workbenchSource).toMatch(
      /data-testid="new-session"[\s\S]*?disabled=\{running \|\| savePending\}/
    );
  });

  it('新建会话使旧会话回放结果失效', () => {
    expect(workbenchSource).toContain('let sessionGeneration = 0;');
    expect(workbenchSource).toMatch(
      /replayRecordedSession\(fromUrl, sessionGeneration\)/
    );
    expect(workbenchSource).toMatch(
      /if \(generation !== sessionGeneration \|\| sessionId !== id\) return;/
    );
    expect(workbenchSource).toMatch(
      /function startNewSession\(\)[\s\S]*?sessionGeneration \+= 1;/
    );
  });
});

describe('会话检查点恢复与本地编辑', () => {
  it('回放同时恢复续跑基线、钉住状态和临时页面态', () => {
    expect(workbenchSource).toContain(
      'conversationBaseline = replay.baselineMessages ?? []'
    );
    expect(workbenchSource).toContain('pins = checkpoint?.pinnedComponents ?? []');
    expect(workbenchSource).toContain(
      'if (checkpoint?.document) replaceCurrentDocument(checkpoint.document)'
    );
  });

  it('本地有效编辑防抖写检查点,并带期望版本防静默覆盖', () => {
    expect(workbenchSource).toContain('scheduleCheckpointSave(result.draft.pageDocument)');
    expect(workbenchSource).toContain('expectedVersion');
    expect(workbenchSource).toContain('/checkpoint`');
    expect(workbenchSource).toContain('response.status === 409');
  });
});
