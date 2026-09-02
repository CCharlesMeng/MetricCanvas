---
status: accepted
---

# 自包含创作 Bundle 与中立契约单向导出

## Context

ADR-0060 把目标创作期分给 Relay/Skill 与 Python FastMCP Tool，但真实 Relay、Java
和 DQE 接口尚不可见。为了不让确定性装配迁移等待外部仓库，本仓需要一个可独立
复制、运行、测试和交付的单元。初始骨架把 `SKILL.md`、Python、产品契约和 Fake
放在同一层，容易产生三种错误理解：Skill 会导入 Python、Authoring 拥有全产品契约、
Fake 是生产 Adapter。

## Decision

**Bundle 是原子发布容器，不是一个混合代码 Module。** Bundle 内含两个平级 Module：
`skill/` 是 Relay/Agent 消费的模型工作流，`tool/` 是 Python 3.12+ 确定性创作 Tool。
二者不互相读取或导入，只通过 MCP Tool Interface 协作；版本发布时与 Authoring
contracts 锁步使用一个 Bundle SemVer。Bundle 不发布 wheel，但锁定 Python 与运行时依赖。

**模型只产出 Page Build Spec。** 它表达业务域、指标、维度、时间、筛选、分析意图
和用户钉住项，不携带 DQE 查询体、结果字段契约、组件 JSON、布局或 `schemaVersion`。
Python 确定性派生这些内容，并在一个粗粒度构建用例中完成验真、执行、装配、完整页面
校验和保存。Python 不持久化 Relay Run。

**MCP 是入站 Adapter，不是领域边界。** Python domain/application 不导入 FastMCP。
模型可见 Interface 最终只暴露数据上下文发现和页面构建两个粗粒度能力；内部算法步骤
不是 MCP tools。Bundle 及契约身份属于运维诊断信息，通过 MCP Resource/health/CLI 暴露，
不进入模型工具面。Java 页面资产和 DQE 只以 application Port 出现。

**产品契约与 Authoring Interface 契约分开归属。** 仓根 `contracts/metriccanvas/` 是
跨 Java/Python/TypeScript 的产品中立契约导出位置，包括 Page Schema、组件能力目录、
页面与查询错误闭集、数据上下文 Schema 和共享验收向量。当前仍由 TypeScript/Zod 作者
真源单向生成。Bundle 自有 `contracts/` 只保存 Page Build Spec 等 Skill↔Tool Interface。
为了整体复制后可离线运行，Bundle 携带生成的只读 `contract-snapshot/`，并用
`contract-lock.json` 锁定根产品契约 manifest；快照不是第二份作者真源。

**规则同步依赖导出和跨语言验收，不靠人工抄写。** CI 检查产品导出物、Bundle 快照、
Authoring contracts 和摘要无漂移。JSON Schema 无法表达的跨引用不变式由共享正反例与
稳定错误 `code/path` 向量承载。固定结构化输入下比较 canonical Page JSON 与错误分类，
不比较模型轨迹、日志或内部代码形状。等价冻结后 Python 成为页面装配真源，TypeScript
双实现退出。创作工具始终产出当前页面协议版本。

**Test Harness 是 Bundle 的外部测试宿主。** `test-harness/` 保存 fixture、Fake Adapter、
进程内验收和真实 stdio 子进程黑盒，不进入生产运行时，不复制 Agent Runner/模型循环，
也不包含装配实现。Fake 只记录 Port 的结构化调用并返回可编程语义结果，不复制 Java
事务、MySQL 生命周期或 DQE 实现。

## Consequences

- Skill 文案、Python Tool、Authoring contracts 与产品契约快照可以独立辨认所有权，
  同时仍以一个不可变 Bundle 交付。
- 产品规则修改只在作者真源发生；导出、manifest、snapshot 和跨语言向量让 Python
  消费者显式升级，不会悄然形成第二份规则清单。
- 本地 Harness 必须同时保留纯核心验收和一条真实 MCP stdio 黑盒；Harness 通过只证明
  Bundle 自洽，不证明真实 Relay、Java 或 DQE 已接通。
- 真实 Relay 接线、Java/DQE 传输 Adapter、发布治理与运维恢复仍需外部契约可见后处理。
  内网身份与鉴权按外部对接方案接入，不纳入本 Bundle 的设计与排期。

## Considered Options

- **把 Skill 与 Python 当成一个 Module。** 会模糊模型工作流与确定性算法的 Interface，
  不采用。
- **让 Authoring Bundle 拥有 Page Schema。** 会把产品协议错误下沉给单一消费者，不采用。
- **Bundle 只引用仓根 contracts。** 整体复制后无法独立运行，不采用；改为锁定快照。
- **把 Fake 放进生产 Adapter 目录。** 会让测试替身看起来像生产 fallback，不采用。
- **等 Relay 仓库可见再开发。** 会阻塞与 Relay 无关的迁移和契约差分验证，不采用。
- **另建独立仓库。** 会在行为基线仍在本仓时提前引入跨仓同步，不采用。
- **复制 Agent Runner 或用本地模型模拟 Relay。** 会建立第二套编排真源，不采用。
