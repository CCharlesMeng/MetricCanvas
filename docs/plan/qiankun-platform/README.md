# 平台微前端接入状态

更新：2026-10-12。**通用平台HTML微前端及候选loader本地验收已完成；目标门户和真实服务仍待验收。** 原方案与交接已退出执行目录，不重复做平台框架迁移。

| 工作 | 状态 | 当前入口 |
|---|---|---|
| 普通Svelte、URL路由、实例生命周期与静态交付 | 本仓已完成 | [实施证据](../../evidence/qiankun-platform/implementation.md)、[ADR-0093](../../adr/0093-platform-html-microfrontend-and-instance-lifecycle.md) |
| 独立部署Adapter与组合交付边界 | 原则已确定 | [ADR-0094](../../adr/0094-independent-platform-deployment-adapters.md)、[部署边界基线](../../evidence/qiankun-platform/design-baseline/deployment-boundary.md) |
| 内网对话模块与 main 兼容同步 | 默认 adapter 策略已调整，内网迁移待执行 | [同步方案](../2026-10-16-intranet-dialogue-sync.md)：单例 SDK、身份与登录恢复移到部署侧，验收后撤掉 `services.ts` 保护排除 |
| 实际门户HTML entry、资源前缀、路由回退及销毁 | 未验证 | 门户维护方按正式[集成契约](../../host-contract.md)接线，实际loader/刷新/后退/卸载重挂逐项验收 |
| 身份、SDK、Java/DQE及Relay | 未验证 | 核对实际映射与权限；人工业务闭环和AI闭环分别记录，不以候选测试主应用代替 |
| 内部发布与升级回退 | 待实证 | 固定版本产物、配置/Adapter版本、入口地址和真实环境结果；本地打包不计为部署 |

来源材料与内网调查保存在 [门户交接证据](../../evidence/qiankun-platform/portal-handoff/README.md)，不参与运行构建。早期Kit/npm包等方向及交接沿革见 [历史批次](../../archive/qiankun-planning-2026-09/README.md)。新增接入结果只更新这里与对应证据，不重新把历史方案放回plan。
