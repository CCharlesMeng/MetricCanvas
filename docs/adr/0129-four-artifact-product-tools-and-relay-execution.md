---
status: accepted
date: 2026-11-03
note: 目标职责与稳定发行裁决；MC 纯核心与四项分发已完成本地集成验收；真实 Relay 迁移未完成
---

# MC 交付稳定的资源与纯产品工具，Relay 拥有线上执行和 MCP 装配

Relay 需要普通升级只同步 `mc-content/`、`mc-content.md`、`mc-tool/`、`mc-tool.md` 四项。若直接同步内部 Python/Node/内容分片结构，MC 每次重构都会迫使 Relay 重新适配；若只给现有 MCP 注入 Port，页面用例仍可能查询、保存和访问存储，无法满足无 Web 调用的产品工具要求。

MC 因而保留确定性页面/查询派生/结果处理、通用作用域/版本/回执核对规则、产品资源和可重复导出。工具接收显式完整输入，返回候选与诊断，不通过 Client 或回调执行在线 I/O。Relay 自有程序维护真实 MCP 工厂、身份/轮次、授权/数据发现/DQE、状态及原子 CAS、Java 单次保存/unknown 恢复和精确前端交接；Skill 负责选择任务、解释回执。规则留 MC 不代表 MC 持有线上状态，显式哈希也不等于可信授权。

四项在稳定 facade、资源 ID/索引和版本化机器契约处交接。内部结构由导出层适配；同一冻结输入生成相同路径/字节。普通更新先校验完整性与保守兼容，再运行固定旧消费者和实际 Relay 包装回归，整批采用且可回退；破坏性契约/依赖变化走显式迁移。兼容预检查不能证明算法行为或自动授权部署，不要求每次普通兼容更新重新人工适配。

本决策局部修订 [0060](0060-static-svelte-java-page-governance-relay-python-authoring.md)、[0061](0061-self-contained-authoring-bundle-and-neutral-contract-export.md)、[0083](0083-platform-evidence-work-and-internal-draft-save.md) 的交付单元与线上协调所有权；确定性页面算法仍归 MC，单发送者、unknown 不重发及可信轮次仍成立。渲染期引擎/数据网关、Java 页面资产、当前前端工作副本及普通问数不自动保存的规则不变。local-authoring 从同一产品真源生成并独立安装，不依赖上述相邻目录。

迁移期按明确消费者清单保留现有在线路径；新路径验证并由 Relay 接收后再按文件退役，不将两套实现长期并行演进，也不在保存结果未知时切换另一条业务写入路径重试。MC 已形成实际四项候选和产品 facade，已验证离线产品回放；这些本地结果不代表完整生产迁移。

Interface 和验收见 [Spec](../plan/2026-11-02-product-relay-evolution/relay-reference-spec.md)，推进状态见[执行台账](../plan/2026-11-02-product-relay-evolution/relay-reference-execution.md)。
