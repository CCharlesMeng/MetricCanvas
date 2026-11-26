# OM 对接 MC 表格 Excel 导出权限

## 双方交付

OM 根据**当前目录所属应用与当前用户的有效权限**计算布尔值，并通过 Embed 的 `mount` / `handle.update` 传入 `permissions.canExport`。MC 对当前页面的表格 Excel 导出统一控制显隐，并在开始导出前再次检查。业务页面 JSON 无需修改；页面已配置的导出标题、筛选和其他显示条件继续生效。

## OM 实现

1. 接入包含本功能的完整 Embed `dist/`，一起替换 ES 或 global 入口及同版本的 `chunks/`。旧构建会忽略顶层权限，包版本字符串不足以区分构建。
2. 在 AiPageView 组装 mount input 的地方复用 `hostPermissions()`。它应基于当前菜单最终生效的 `activeApp.funcAuthority`（含 `belongApp` 覆盖）调用现有 `PermissionUtil.hasDownloadPerm`。权限未就绪、非数组或当前目录无匹配授权时返回 false。MC 只读取布尔位，OM 可省略原始权限数组。
3. 首次挂载即传权限。目录、菜单、角色变化时先切到新目录的有效权限；若需等待异步结果，先传 false，丢弃上一目录迟到的结果。每次传完整的最新 input，并更新宿主保存的副本，避免后续地图、导航等更新恢复过期权限。组件销毁时取消订阅并销毁 handle。

沿用 OM 的渲染入口，下面的公共更新函数可同时供权限事件和其他宿主更新调用：

```ts
// buildCurrentInput() 返回当前 document、dataGateway、displayInputs、导航等字段。
const readPermissions = () => ({
  canExport: runtimeConfig.hostPermissions().canExport === true,
});

let lastMountInput = { ...buildCurrentInput(), permissions: readPermissions() };
const handle = mount(anchor, lastMountInput);

// 仅更新权限时复用现有 document、网关和导航对象，保留筛选和打开的详情。
function updateCanvas(input = lastMountInput) {
  lastMountInput = { ...input, permissions: readPermissions() };
  handle.update(lastMountInput);
}

const subscription = loginService.onFuncAuthorityChanged().subscribe(() => updateCanvas());
// 目录文档、地图等其他输入需要更新时：updateCanvas({ ...lastMountInput, ...changes });
// 组件销毁时：subscription.unsubscribe(); handle.destroy();
```

## 本地复测

在 MC 仓运行 `pnpm --filter @metriccanvas/embed build` 和 `pnpm --filter @metriccanvas/embed preview:examples`。打开 [商务决策明细](http://127.0.0.1:4175/examples/navigation.html?page=business-decision-all-details&hostExportDemo=1&mtime=2026-04) 或 [机会点清单](http://127.0.0.1:4175/examples/navigation.html?page=ioc-opportunity-list&hostExportDemo=1&mtime=2026-04)，用顶部「模拟宿主导出权限」选择授权或撤权。Embed 本地服务为机会点清单提供下载用的合成数据。商务决策明细可在该入口对照按钮显隐，验证其工作簿还需接入覆盖商务查询的 DQE Sim 或 OM 业务网关。正式 OM 以当前用户及目录权限为准。

## 接口行为与联调验收

| 宿主输入或操作 | MC 可观察结果 |
|---|---|
| 首次传 `permissions: { canExport: false }` | 即使表格已配置 Excel 导出，按钮也隐藏 |
| 同一实例更新为 `true` | 页面已配置且自身条件允许的导出按钮出现，可以下载当前匹配数据 |
| 再次更新为 `false` | 按钮消失，不能开始新的导出 |
| 显式传入 `permissions: {}`、`null` 或非布尔权限值 | 按拒绝处理。只有布尔值 `true` 授权 |
| 完全省略 `permissions` | 使用旧宿主行为。普通导出照页面配置；已有权限条件继续读取原有 displayInputs |
| 顶层权限与 displayInputs.permissions.canExport 冲突 | 顶层权限优先；其余权限位和展示事实继续取自原快照 |

用「商务决策明细（全部）」验证无显隐条件的既有表格，用「机会点清单」验证已有 `visibleWhen: { permission: "canExport" }` 的表格。两页都应只传一次顶层权限。未配置导出的表格不会凭授权新增按钮。

本接口控制新发起的表格 Excel 下载。在途导出沿用启动时的上下文；真正切换登录身份时由宿主管理实例和网关生命周期。报表 PDF/PNG、OM 自有导出按钮及后端服务鉴权分别由原入口处理。联调时记录页面 id、实际加载的构建标识、mount/update 的布尔值和按钮状态即可。
