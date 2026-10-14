# 实例 URL 导航

## 已核对清单

覆盖：apps/platform/src 与直接工程入口，2026-10-14。

### ROUTE-1

[路由定义](../src/lib/integration/routes.ts)、[路由分发](../src/lib/PlatformRoot.svelte)、[导航](../src/lib/integration/navigation.ts)：按 routeBase 管理地址与 guard，正式创作路径为 `/create`。旧入口兼容与参数解析集中在 routes.ts，根组件仅消费已解析路由。

## 规范

PATTERN-ROUTE-1：内部跳转沿用实例导航与集中地址生成函数；保留 resource/任务身份，阅读由路径决定。异步跳转携带取消信号及地址/导航版本检查，过期请求不能提交；后退与点击共用串行 guard。恢复记录必须校验任务 key 与 URL 身份一致，旧地址迁移保留工作副本。依据样本：integration/routes.ts、integration/navigation.ts、workbench/work-session.ts、PlatformRoot.svelte。

违例判定：本次修改是否绕过所指入口或改变该入口拥有的职责。
