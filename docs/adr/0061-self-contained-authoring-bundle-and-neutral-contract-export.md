---
status: accepted
---

# 自包含创作 Bundle 与中立契约单向导出

ADR-0060 把目标创作期分给 Relay/Skill 与 Python FastMCP Tool，但真实 Relay、Java 和 DQE 接口尚不可见。为了不让迁移等待外部仓库，当前仓库新建一个可独立复制、运行、测试和交付的自包含创作 Bundle：它包含唯一一份 MetricCanvas Skill、Python 3.12+ 脚本模块、FastMCP stdio Adapter、确定性创作核心、外部 Port 的假 Adapter、本地 Harness、中立契约与验收向量；它不依赖 pnpm workspace 包或外部团队才能完成本地验收。Bundle 不发布 wheel，但必须锁定 Python 基线与运行时依赖。

## 决策

**模型只产出页面构建规格。** 页面构建规格表达业务域、指标、维度、时间、筛选、分析意图和用户钉住项；DQE 查询体、结果字段契约、组件 JSON、布局与 `schemaVersion` 都由 Python 确定性派生。Python 不持久化 Relay Run；数据上下文发现可以独立调用，页面构建则由粗粒度阶段工具内聚验真、执行、装配、页面校验和保存，避免在工具之间经模型上下文往返完整 DQE 结果与页面正文。

**MCP 是 Adapter，不是领域边界。** 确定性核心不导入 FastMCP；stdio 是当前可证的首个传输 Adapter，真实 Relay 协议可见后可替换这一 Adapter，不改页面构建规格或装配核心。Java 页面资产和 DQE 只以 Port 出现；本地假 Adapter 只模拟语义结果，不复制页面生命周期、MySQL 事务或 DQE 实现。

**迁移期由 TypeScript/Zod 单向导出中立契约。** 当前 `packages/page` 继续是 Page Schema 与组件能力目录的作者真源，生成版本化的 Page JSON Schema、组件能力目录、错误分类和共享正反例向量，Python 运行时只消费 Bundle 内的导出物。CI 必须同时检查导出物无漂移、TypeScript/Python 对共享向量的分类一致，以及 Python 黄金输出能通过 TypeScript 完整页面校验。JSON Schema 无法表达的跨引用不变式由中立验收向量承载，不在 Python 中悄然建第二份规则清单。

**TypeScript 装配实现是有限期行为基线。** 固定结构化输入下，迁移期比较 canonical Page JSON 与稳定错误 `code/path`，不比较模型轨迹、日志或内部代码形状；达成冻结向量等价后，Python 成为页面装配真源，TypeScript 双实现退出。创作工具始终产出当前页面协议版本；编辑旧修订时生成新的当前版本修订，不改写旧修订。

**Skill、Tool 和 contracts 锁步成为一个 Bundle 版本。** Bundle 以 SemVer、根 manifest 与内容摘要标识不可变交付物；页面协议版本独立记录，Git commit 只用于溯源。Bundle 内只有一份环境无关 Skill，真实 Relay 的安装与注册是薄 Adapter，不复制或分叉 Skill 正文。

## Consequences

- Bundle 可在真实 Relay、Java 和 DQE 不可见时独立开发，但本地假 Adapter 的通过不证明真实线路已接通。
- 本地 Harness 必须同时有纯核心进程内验收与一条真实 MCP 子进程黑盒验收；传输实现可替换，这两层验收责任不变。
- 真实内网接口、Run 恢复、Java 事务、发布治理与运维恢复仍需后续逐维度裁决，不因 Bundle 可本地运行而被视为已完成。

## Considered Options

- **等到 Relay 仓库可见再开发。** 会一并阻塞与 Relay 无关的装配迁移和契约差分验证，不采用。
- **另建独立仓库。** 会在行为基线尚在本仓时立即引入跨仓契约同步，不采用。
- **Python 手写第二份 Page Schema 和组件目录。** 无法区分刻意升级与无意漂移，不采用。
- **复制 Agent Runner 或用本地模型模拟 Relay。** 会建第二套编排真源，不采用。
