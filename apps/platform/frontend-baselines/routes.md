# 实例 URL 导航

## 已核对清单

覆盖：apps/platform/src 与直接工程入口，2026-10-12。

### ROUTE-1

[路由分发](../src/lib/PlatformRoot.svelte)、[导航](../src/lib/integration/navigation.ts)：按 routeBase 管理跳转与 guard。

## 规范

PATTERN-ROUTE-1：内部跳转沿用实例导航；保留旧 resource 身份。依据样本：PlatformRoot.svelte、integration/navigation.ts。

违例判定：本次修改是否绕过所指入口或改变该入口拥有的职责。
