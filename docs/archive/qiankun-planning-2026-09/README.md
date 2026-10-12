# 平台微前端历史规划结论

本批保存HTML微前端、独立部署组合、候选loader和门户handoff的旧过程方案。通用实现与候选测试主应用已有本地证据；**目标门户及真实服务验收仍未完成**，当前工作集中到[接入状态](../../plan/qiankun-platform/README.md)。

现行规则在[ADR-0093](../../adr/0093-platform-html-microfrontend-and-instance-lifecycle.md)、[ADR-0094](../../adr/0094-independent-platform-deployment-adapters.md)与[集成契约](../../host-contract.md)。[实施证据](../../evidence/qiankun-platform/implementation.md)、[决策基线](../../evidence/qiankun-platform/design-baseline/deployment-boundary.md)及[门户调查](../../evidence/qiankun-platform/portal-handoff/README.md)留在evidence，保持决策论证和真实来源入口。

平台npm包、内存导航和Kit迁移的早期方向被普通Svelte、客户端URL路由和HTML静态交付取代；内部部署Adapter依然独立维护，不在平台实现私有映射。归档不把候选loader通过写成目标门户通过。
