# 局部样式所有权

## 已核对清单

覆盖：apps/platform/src 与直接工程入口，2026-10-12。

### STYLE-1

[PlatformFrame](../src/lib/PlatformFrame.svelte)：工具面与引擎内容样式边界。

## 规范

PATTERN-STYLE-1：不向 RuntimeView 广域覆盖主题；新 UI 官方来源由 Story 冻结。依据样本：apps/platform/src/lib/PlatformFrame.svelte、packages/engine/runtime-ui/src/RuntimeView.svelte。

违例判定：本次修改是否绕过所指入口或改变该入口拥有的职责。
