# Svelte 5 · 组件库

## 已核对清单

覆盖：packages/ui/src 与直接工程入口，2026-10-12。

### STRUCT-1

[packages/ui/package.json](../../../packages/ui/package.json)、[packages/ui/src](../../../packages/ui/src)：exports 与挂载入口以源码为准。

## 规范

PATTERN-STRUCT-1：组件使用 Svelte 单文件，领域逻辑与视图分离；依据样本：packages/ui/src/index.ts

违例判定：本次修改是否绕过所指入口或改变该入口拥有的职责。

栈签名：Svelte 5 · 组件库。
