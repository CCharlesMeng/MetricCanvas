# 创作链迁移批次（2026-09-03 ~ 10，已收口）

## 这批做了什么

把 Agent 创作链从仓内 TypeScript（`agent-runner` + platform 服务端）整体搬到 **Relay Skill + Python FastMCP Tool**，并把仓根的自包含创作 Bundle 定成锁步发布容器。三份文件：完整迁移方案（M0–M8 里程碑）、与原实现的已批准差异清单、以及 Bundle 的结构定义。

## 结论落在哪

现行结论见[领域建模、包边界与部署形态](../../adr/topics/domain-modeling-and-package-boundaries.md)。

| ADR | 裁决 |
|---|---|
| [0060](../../adr/0060-static-svelte-java-page-governance-relay-python-authoring.md) | 静态 Svelte + Java 页面治理 + Relay/Python 创作期取代 Node 平台 |
| [0061](../../adr/0061-self-contained-authoring-bundle-and-neutral-contract-export.md) | 自包含创作 Bundle 与中立契约单向导出 |
| [0063](../../adr/0063-relay-dqe-facts-revise-authoring-boundaries.md) | Relay 与 DQE 真实接口对创作期四个前提的修正 |
| [0064](../../adr/0064-agent-returns-page-artifact-relay-and-java-own-persistence.md) | Agent 只返回页面构建产物，Relay 与 Java 分别持久化 |

落地形态由 [`metriccanvas-authoring/ARCHITECTURE.md`](../../../metriccanvas-authoring/ARCHITECTURE.md) 与 [`RELAY-HANDOFF.md`](../../../metriccanvas-authoring/RELAY-HANDOFF.md) 接手维护。

## 被推翻的方向

- **「删除 TS 双实现」不包括人工组件切换与沉淀**：[ADR-0074](../../adr/0074-browser-component-building-and-isolated-legacy-baseline.md) 把这项最小能力长期判给浏览器工作台，且要覆盖 Python 的全部可装配组件。
- **旧链保留方式改了**：从「等生产灰度门槛」改为「完整提交 + 固定 tag 的可复现历史基线，按需在仓外检出」。主线完成依赖解耦即可移除旧实现，不必等门槛。**但隔离完成不等于迁移完成**，功能等价与生产验收条件继续有效。
- **旧基线不得再作为主线构建、CI 或当前测试预期生成的前置。**
- **浏览器不自打旧 WebSocket / `role_name`**：盘古按 [ADR-0077](../../adr/0077-pangu-dialogue-in-existing-workbench-and-ask-turn-outcomes.md) 使用实例 API + adapter，真实接线待 #106–#108。
- 方案顶部写的 M1 全量黄金集、M3–M8 **未退出**，不要把 M0–M2 的完成当作整条链迁完。
