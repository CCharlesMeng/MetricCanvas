# Svelte 5 · 微前端子应用

## 已核对清单

覆盖：apps/platform/src 与直接工程入口，2026-10-12。

### STRUCT-1

[apps/platform/package.json](../../../apps/platform/package.json)、[apps/platform/src](../../../apps/platform/src)：exports 与挂载入口以源码为准。

## 规范

PATTERN-STRUCT-1：组件使用 Svelte 单文件，领域逻辑与视图分离；依据样本：apps/platform/src/lib/PlatformRoot.svelte、workbench/authoring-coordinator.ts

违例判定：本次修改是否绕过所指入口或改变该入口拥有的职责。

栈签名：Svelte 5 · 微前端子应用。
