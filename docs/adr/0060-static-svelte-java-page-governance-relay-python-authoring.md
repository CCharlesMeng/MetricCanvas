---
status: accepted
---

# 静态 Svelte、Java 页面治理与 Relay/Python 创作期取代 Node 平台

ADR-0009 把页面搭建、Agent Runner、MCP 与页面生命周期共同放进独立 SvelteKit Node + PostgreSQL 平台；该形态已完成可运行验证，但不符合公司后端统一 Java、模型只能经内部 Relay 调用以及生产环境不运行 Node 服务端的约束。目标生产形态改为静态 Svelte SPA + 独立部署的 Java 17/Spring Boot 3.5.15 模块化单体 + Relay Skill-Play + Python FastMCP Tool，Java 以 MySQL 保存页面资产；Node 只保留在前端开发与 CI 构建阶段。本 ADR 取代 ADR-0009 的目标部署结论，不把尚未迁移的当前实现描述成已经完成。

## 决策

**Svelte SPA 是唯一产品界面。** 页面管理、精确修订预览和统一运行时继续由 Svelte 呈现；Relay 自带的 Vue/Web 界面不进入 MetricCanvas。Svelte 通过 Chat Interface 提交用户问题和受控 Skill key，Relay 服务端解析真正的 Skill 内容、版本和工具白名单；浏览器不得提交或覆盖 `SKILL.md` 正文与工具权限。

**Relay 是 Agent 运行宿主，不是页面元数据生成器。** Relay 负责内网模型调用、Skill 加载、自然语言理解、工具调度、对话和 Agent Run；MetricCanvas 不在 Java 或 Node 中建设第二套 Agent Runner，也不直接调用模型。模型只形成结构化创作输入，不自由手写最终页面元数据。

**Python 页面装配 Module 是页面元数据装配算法的真源。** Relay 唤起 MetricCanvas Skill 后，通过 Python FastMCP Tool 调用数据上下文检索、DQE 验真和页面装配。页面装配以结构化输入、已验真查询、组件能力目录与当前页面 Schema 版本为输入，确定性生成并校验完整页面元数据；相同输入必须得到相同输出。Skill 可以调整推理路径，但权限、DQE 验真、页面校验和保存准入由 Tool 与 Java 强制，采用约束确定性而非承诺每次模型工具轨迹相同。

**Java 是小而深的页面资产 Module，不是任意 JSON CRUD。** 首批 Interface 只需 `savePageRevision`、`getLatestPage`、`getPageRevision` 和 `listPages`；保存 Implementation 必须重新执行页面校验、生成不可变页面修订、检查基线并发、按幂等键重放结果、记录身份审计。Python Tool 不直连 MySQL；保存成功后返回结构化 `pageId`、`revisionId` 与 `revisionNumber`，Svelte 再从 Java 加载精确页面修订预览。首批不开放审核、发布和回滚，但每次保存已经追加不可变页面修订而非覆盖 JSON。

**数据权限仍以 DQE 为真源。** MetricCanvas 不另拆数据发现、执行和创作三套申请权限，也不以后台高权限身份替用户验真。创作者没有目标数据权限时，DQE 拒绝并返回可行动的申请提示；数据上下文结果按身份过滤。统一运行时始终以当前查看者身份执行 DQE，发布者权限不传递给查看者。

**AI 数据只进入固定内网模型。** 公网模型不可接收用户问题、页面内容或 DQE 数据；即使进入内网模型，也只提供完成当前步骤所需的最少字段和有限结果。Relay 是完整对话与 Agent Run 的真源，Java 只在页面修订记录 `sourceRunId`、`sourceSkillVersion`、创建人和创建时间；现有分析会话与 Relay Run 的最终映射、保留期和恢复能力留待后续集成决策。

## Consequences

- 当前 `apps/platform` 的 SvelteKit Node、TypeScript Agent Runner、MCP 与持久化实现成为迁移参考和行为基线，不再是目标生产部署形态；迁移完成前仍可用于本地验证。
- ADR-0024 关于当前 TypeScript 包收敛的结论仍解释现有代码，但其中 Agent Runner 最终落在 `apps/platform` 的位置已被本 ADR 的目标形态取代。
- 页面 Schema、组件能力目录、错误分类和跨语言结构化结果必须成为 Java、Python 与 TypeScript 可共同验证的中立契约，不能各写一份真源。
- Java 不代理或复制模型编排逻辑；Python Tool 不复制页面资产事务；Relay 不持有页面数据库写入旁路。
- MCP 在目标形态中是 Relay 与 Python Tool 之间的内部传输 Adapter，不成为页面领域依赖，也不因“未来可能外放”提前增加第二套外部能力面。
- Chat Interface 的具体流式协议、身份如何以非模型可见方式贯穿 Relay→MCP→Java→DQE、Relay 重启恢复和取消能力、发布工作流以及灾备目标仍需后续逐维度裁决。

## Considered Options

- **保留独立 Node Agent/平台。** 已验证但违反公司后端与部署约束，并与 Relay 的模型所有权重复，不采用。
- **把 Agent 与模型编排迁入 Java。** 固定内网模型已经封装在 Relay Skill-Play 运行时内，Java 再建 Agent Runner 会形成第二条编排与审计路径，不采用。
- **让 Relay 模型直接生成整份页面元数据。** 页面布局、字段绑定和版本规则会受模型方差影响，无法维持现有确定性装配不变量，不采用。
- **让 Python Tool 或浏览器直接写 MySQL。** 会绕过页面校验、不可变修订、幂等和身份审计，形成第二条页面治理路径，不采用。
- **Java 代理 Relay 的全部 Chat 流。** 会形成 Java→Relay→Python→Java 的环形调用和无领域价值的流式转发；目标上由 Chat Interface 直接接入 Relay，Java只承载页面资产 Interface。
