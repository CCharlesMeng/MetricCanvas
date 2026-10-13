# 公开构件入口

## 已核对清单

覆盖：apps/platform/src 与直接工程入口，2026-10-12。

### COMP-1

[RevisionPreview](../src/lib/RevisionPreview.svelte)、[引擎 UI 入口](../../../packages/engine/runtime-ui/src/index.ts)：按入口复用；第三方 Vue UI 未作为运行依赖。

## 规范

PATTERN-COMP-1：现有组件能力以入口及实现为准，不复制另一套页面渲染。依据样本：RevisionPreview.svelte、PageAuthoringWorkbench.svelte

违例判定：本次修改是否绕过所指入口或改变该入口拥有的职责。
