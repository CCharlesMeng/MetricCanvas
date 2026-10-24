# MC 内容包补全：新窗口实施交接

日期：2026-10-24。状态：本仓补全已实施并完成本地验收；用户已授权提交并推送 main，实际交付以 Git 和 CI 回执为准；实际 Relay 部署另验。

本文件交接 MC 仓后续工作，不是已经完成的 Relay 接入证明。执行范围和缺口以[完整性主计划](mc-content-completeness-plan.md)为准；本文只记录接续步骤、已确认边界与现场状态。

## 1. 从哪里继续

复用现有检出：

```text
/Users/moon/.codex/worktrees/mc-content-layout/DataDashboard
```

交接时 HEAD 为 `6f471f0230b276d5d217e74f8b278c79fc8f732d`，detached HEAD。该目录是已恢复的受管工作树，有尚未提交的本轮文档；进入后先核实 Git 状态和主线差异，再决定是否需要更新基线。主检出 `/Users/moon/Documents/Code/公司项目/DataDashboard` 有其他并行修改，不能以那里缺少本文为由重新开始，也不能覆盖其工作。

原交接文件清单（均保留）：

- `docs/plan/2026-10-24-layout-standards/mc-content-completeness-plan.md`：主计划，G01–G16、W1–W7、范围与完成定义。
- `docs/plan/2026-10-24-layout-standards/implementation-handoff.md`：本交接。
- `docs/plan/2026-10-24-layout-standards/architecture.md`：已补完整性纠正入口。
- `docs/plan/README.md`：已登记当前未完成工作。
- `docs/evidence/mc-content-layout/completeness-audit.md`：静态审查基线。
- `docs/evidence/mc-content-layout/schema-latency-probe.md`：30 次底层冷进程探测的口径与结果。

这些文档当前仅在该工作树中，尚未提交或推送。原始 JSON 按当前 `.gitignore` 留本地；摘要 Markdown 才是交付记录。工作树恢复后依赖已移除，按实际环境恢复声明依赖，不能将缺失 node_modules 或 Python 环境当成产品故障。

阅读顺序：本文件 → 主计划第 1、3、4、7–9 节 → [架构责任](architecture.md)；按实施分支查源文件。先读仓库 AGENTS.md、CONTEXT.md 和 ADR 索引，再按需定位现行结论。修改知识投影前读 [local-authoring 维护要求](../../agents/local-authoring-skill-maintenance.md)；编码遵循[复杂度要求](../../agents/code-complexity.md)及[功能与协议验收](../../agents/feature-acceptance.md)。

## 2. 已确认的目标与边界

用户要求：补齐 mc-content 所需的全部 MC 产品依赖，使 Relay 的单个 Skill 可以整体替换内容包；今后每次 Schema 或相关协议语义更新，同批构建、检查并交付该部分。

Q1–Q6 的已确认结论集中在主计划第 1.1 节。实施时保留以下关键边界：

- MC 提供事实、确定性程序和检查结论；Skill 决定采用、编排、保存及交付。仓库构建/发包完整性检查可以失败，不能因此给运行时保存工具增加内容包准入状态。
- 最新内容包面向配套引擎；历史页面遵循产品可读、能力下限和迁移规则。最新包保留当前完整知识、历史差异和迁移说明；精确旧知识使用对应历史包。
- MC 技术约束从原工作流拆出，Skill 保留任务与交付编排；按责任组织到协议、工具或运行参考。只服务一个 Skill，不建设多 Skill 框架。
- MC 自有知识、脚本、例子、说明与引用在独立包中闭合。外部运行依赖和平台/引擎/Relay 基础设施明确声明；不要求把全部外部服务塞进包。
- MC 发包前完成产品契约、支持范围内旧页/迁移及受影响的产品引擎回放，预先披露已知不兼容；Relay 采用前验证实际部署。
- local-authoring 保持独立安装；共同事实来自产品真源/共享核心，不从已安装 Skill 目录反向复制。

唯一尚未冻结的产品目标是 Q7 性能预算：约 1 MiB / 1 万 inline 行常规样例的检查 1 秒、必要迁移 2 秒为候选。先实施已确认范围并测完整包；需要把数字变成正式承诺时再定，不将候选数字写成已批准 SLA。

## 3. Relay 疑虑的具体处理

**P1 发现/查询协议字段表：必补。** 从实际公开 Schema、公共实现及注册契约生成/维护字段含义、方向、枚举、条件、错误、版本和例子，区分模型输入、可信程序输入、模型摘要、程序输出。覆盖 dataContextVersion、validationMode、discoveryProtocolVersion、readyRequirementIds、interactionEnvelope、businessDomain、queryBinding、granularities、metricCompatibility 等。实际字段语义与源位置见主计划第 4.4 节，不根据旧 Skill 的措辞重新猜测协议。

**P2 业务域场景：必补。** 纳入现有业务报表、使用分析场景及索引/例子；区分产品约束、可选场景建议、真实数据要求。场景名不等于 discover 返回的 businessDomain，示例对象不写成固定业务事实。

**P3 工作流中的 MC 依赖：边界已认可。** 工具前置、精确引用/版本、受控操作语法、保存/预览回执及现有标记协议归 MC；任务选择、解释确认、模板采用及交付编排归 Skill。建立逐段迁移对照，不能整份机械搬迁或全部留在 Skill。

现有平台 v2 的完整产物走 structured_content，模型只拿摘要；预览精确匹配 artifact/ref/binding。现有标记规则继续按平台契约表达。真实 Relay 的替换/注入不在当前本地验证内，不另造一种标记协议冒充完成接线。

## 4. 接续实施顺序

1. **锁定覆盖分母与来源。** 沿 W1 为产品参考、知识主题、实际工具、公共协议、场景、组件能力、规则和示例建立源到分发 key 的迁移/覆盖清单。完整性应能发现“生成器根本没选中”的遗漏，而非只校验已有文件 hash。
2. **补全同源输出与检索。** 沿 W2/W3 复用 page-reference、knowledge 构建/局部读取核心，将完整语义、父约束、规则、例子及工具完整 inputSchema 纳入 MC。完整 Schema 留包内，常见任务通过有界主题读取；超预算与未展开引用如实报告，并有继续入口。
3. **接入现有构建链。** 沿 W4 扩展现有 `pnpm authoring:contracts` / `authoring:contracts:check`，而非增加人工记忆的同步步骤。结构不变的语义、校验器、工具或场景变更同样触发。共享构建输入，验证输出后再发布，保持幂等。
4. **完成检查、兼容与分发。** 沿 W5/W6 检查组件遍历/数据绑定范围、旧文件和真实语义升级、完整包独立安装、说明/依赖/许可证及发布身份。当前不支持的能力明确标记；IOC 自动装配不扩围。
5. **更新交接并报告边界。** 关闭 G01–G16 对应项，保留可核实的未关闭项。W7 的 Relay 注册、可信上下文、并发关联、包重载与真实部署验收由 Relay 对接；本仓可提供契约与调用样例，不能以没有 Relay 仓为由延后 MC 知识补全。

每步以主计划的完成证据收口，避免把一次查询成功或一组摘要一致当作整个补全完成。具体接口兼容修改先查现有调用者与回归；不擅自改变既有 MCP 签名、保存行为或渲染样式。

## 5. 现有基础与容易误判的事实

- 基础实现提交为 `1ba49b1742ebbed7353853cb5f82e5b692993fd4`，已推 main 且该 SHA 的完整 CI 曾通过。它证明基础能力，不证明本轮完整性缺口已关闭。
- 当前基线的完整页面 Schema 已入包，缺的是完整语义/知识/场景及消费与覆盖链；不要把产品真源和校验器重写一遍。
- 活动 9 个工具当前没有完整运行时 inputSchema 投影，compose 只有内层 requestSchema；从实际注册对账，不能拿 AST 签名代替。
- 当前只有 3 个协议查询 key；知识主题和部分已入包布局正文没有入口。大型 Schema 超默认预算时现有程序会保留整原子，不应靠截断约束解决。
- 主计划里建议的 `mc:content:coverage`、`mc:content:check` 尚未实现；先查 package.json 再执行。已有 `mc:content:test`、`mc:content:fixtures` 可按职责复用。
- 历史页面“仍可读”与“可自动升级”分别报告；迁移保留原始字节/hash，默认 dry-run，显式写入全新目录。使用 versionPolicy.current，不写死本次 6.58。
- 底层本地耗时约 0.16–0.22 秒，只是小样本 Node 冷进程探测，未覆盖 Python 包校验和真实部署。不要默认每次串行检查、dry-run、写出三遍。
- 新增/修改函数与所有辅助函数按仓库口径实测；既有超限单独说明。真实 Relay、DQE、保存/预览服务、DS 模型与本地产品回放分别报告。

## 6. 实施完成与交付

执行主计划第 7.3、7.4、9 节：除正常回归，还要用独立真源变更证明遗漏会失败；完成 MC 仓外安装、共同知识一致性和 local-authoring 独立安装，以及支持范围内历史页面与升级回归。受影响协议/行为按仓库要求补文档、可观察场景和产品引擎回放。

最终报告列出：关闭的 G 项、剩余项及原因、实际运行命令/结果、复杂度前后口径与数值、独立安装/旧页/性能证据、兼容说明和 Relay 需验的部署项。实现、提交、远端 SHA、CI、真实部署作为不同层次报告。

当前请求仅制作交接，不包含本轮代码提交或 push。新窗口按用户粘贴的任务开展实施；实际交付 Git 时读取本仓 scoped-main-delivery，使用明确文件清单、保留并行修改，并验证对应 SHA 的真实 CI。此工作树承载未提交的接续文档，当前应保留。

## 7. 实施后的交接更新

本文件前 6 节保留交接起点与已确认边界；“尚未实施”等描述属于当时基线。当前结果见 [实施与验收](../../evidence/mc-content-layout/implementation-results.md) 和主计划第 11 节。MC 包自带 `HANDOFF.md`、完整契约与独立运行样例。下次接续先核实本工作树 Git 状态；用户现已授权提交并推送 main；不把基线 SHA 视作本次交付 SHA，交付后另核实远端与完整 CI。实际 Relay 注册、双通道、并发关联、重载、真实服务及标记注入仍需部署方验收。Q7 只完成测量，候选预算未变为 SLA。
