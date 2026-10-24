# Relay 接入 MC：实施任务书

日期：2026-10-24。用户已同意从只读探查推进实施。本文件交给能够访问 Relay 源码和运行环境的执行者；MC 本机准备记录见[交付复验](../../evidence/mc-content-layout/relay-readiness.md)。真实 Relay 实施尚未在 MC 主机执行。

## 1. 锁定本轮输入

先读取执行仓 AGENTS.md，记录 Git HEAD、dirty 清单、实际进程和导入路径。报告中的 `D:\PythonWorkspace\CDIRelayAgentService-1` 与 `31d0901bd9ea05e361030b57b921d4477b4b8898` 是探查现场，进入后重新核对，保留并行修改。

本轮允许修改完整接入所需的 Relay 程序接缝、Skill 接线和部署说明。实现、隔离测试和专用测试页验收完成后交付可审阅 diff；提交、push 和生产发布另行执行。不重开已确认的 Skill/MC 责任划分，不建设多 Skill 框架，不新增 MC 保存准入。

| 交付物 | 固定身份 / 用途 |
|---|---|
| MC 独立包 | `contentVersion=1-ebf417635014c58b`；`contentSha256=ebf417635014c58bbfa4d967e2eaf9da543ce72f7ac98593deef949595da43a5` |
| MC 归档 | `archiveSha256=7ce0f35dc9209a2a2488b47c5bb5fc65ff9a4861b464203360ca63e5e744d869`；[CI 下载](https://github.com/CCharlesMeng/MetricCanvas/actions/runs/40080278690/artifacts/12555266075) |
| 配套公共源码 | 固定 `edab0baa9521ad3c6f6ab5b21c00e084c05a1f38`，使用完整公有 authoring 归档及其 release.json；具体归档摘要见[交付复验](../../evidence/mc-content-layout/relay-readiness.md) |
| 当前包使用说明 | 安装包内 README.md、HANDOFF.md、index.json、runtime/contract-alignment.json、runtime/source-identity.json |

此前 387 文件包的实验只保留为历史证据。此前完整 authoring CI 目录下载漏了清单内的隐藏文件，完整性检查失败；本轮使用从固定 Git 提交重建并校验的公有归档。MC 独立 tar 归档不受该问题影响。

完成条件：实际使用的两个归档各自与发行记录匹配；既有 Relay 修改已记录，不被整包覆盖。

## 2. 安装 MC 并对齐实际契约

1. MC 归档解压到全新暂存目录，以原始字节运行包内 verify，读取 version、layout/catalog、layout/template.schema、knowledge/table.width、protocol/discovery-query、scenario/business-report 和完整 compose_page inputSchema。CLI 业务结果按 JSON 字段判定。
2. 将完整 MC 目录按实际加载路径安装到 Skill；配置 Python/Node 依赖、执行账户只读权限、整体替换与重启。新进程复验；版本切换期间同轮固定内容摘要。安装位置和是否纳入 Git 分别记录，完整性以 verify 为准。
3. 通过实际 MCP 服务取得 list_tools 和 bundle-info，记录公共工具源码/构建身份、请求 Schema 摘要和实际渲染引擎身份。解释报告中的 6.11、6.54、6.58 各来自哪里；修改版本字面量不能代替实现对齐。
4. 比较公共工具全部参数分支和装配能力。当前 MC 公共平台注册 9 个工具；逐项保留 Relay 的 publish_page、submit_ai_summary_body、list_existing_page_urls 的实际行为和权限，追溯 publish_page 来源后再确定归属。
5. 对齐配套公共实现与引擎，保留内部 Adapter 和 Relay 扩展。使用公共同步程序时先预览；`tool/metriccanvas_authoring/adapters/` 属内部目录。公共文件中的本地扩展也要逐项迁移；sync_upstream 的冲突必须审阅，不能强制覆盖。优先复用现有扩展注册入口。

sync_upstream 的 `--source` 需要 Git 检出和固定 `--ref`；公有归档作为逐文件对账及迁移输入，不假定脚本已有归档参数。保持既有 Adapter 接口；需要新增私有事实来源时单列真实缺口，不能用默认值补齐。

两份 COMPOSE_SCHEMA 有共同子集，不是所有 plan 都互斥；共同子集实验不能代替完整兼容验收。以配套版本对齐为默认，不静默删除 description/dateFilters/pagedJoins，不为迁就旧服务手改 MC 快照。所需协议变化应回到产品真源单独实施。

完成条件：当前包安装验证通过；公共工具与内容包逐字段对账；扩展工具、Adapter 和原有工作流回归；实际服务与引擎身份有运行证据。未知的 targetVersions 字段省略，not_run 是结果而非版本输入，字段匹配仍不等于实际部署验真。

## 3. 实现可信产物与关联通道

先追踪报告定位的 mcp_manager.call_tool、MCPToolProxy._process_result 和 preview bridge，以实际源码选择最小接缝。优先在程序侧保留 MCP structuredContent/structured_content；模型通道继续只有 modelSummary 和经授权的有界结果。禁止把完整信封拼入 ToolResponse 文本或会被模型序列化的 metadata。

编译包装层在可信上下文中保留原始编译输入、原样 inspectionSpec、编译 plan 摘要及内部引用。装配结果保留完整 document、artifactRef/ref/binding、operationId 和实际请求摘要。关联使用既有可信身份/工作上下文及每次请求标识；同一 turn 可以有多次装配，不能只按 turn_id 找“最新文件”。

检查器由程序解析当前作用域的产物和原样 spec，使用包内摘要函数构造 correlation。模型可见的 inspect 工具只接受受控引用；完整 document、任意文件路径和可信上下文不得由模型作为事实提交。错引用、旧 spec、跨上下文或错摘要必须给出明确结果，不回退到别的产物。

实际 compose request 与编译 plan 不同，应据实标记关联未验证/错配，由 Skill 决定是否重新编译；保留既有 compose/save 行为。MC 的 correlation=checked 仅证明所提供值的关联，不证明身份授权、真实保存或业务意图。

如果选择 emit_preview 后读取文件的方案，先以事件证据确认落盘、工具后置钩子、响应转换、卡片注入和模型下一步的顺序，并实现同样的可信上下文、精确引用和原样 spec 关联。仅移动检查步骤不能关闭通道缺口。

完成条件：一次隔离 compose 的完整产物在程序通道可供 inspect 使用；模型输入快照没有完整 document/previewJson/原始查询；同轮两次请求、跨轮及重试均精确关联。现有保存工具行为和回执保持。

## 4. 接入 Skill 工具、权限和有界报告

- 按实际 skill_loader/agentscope 版本注册 tool_mc_query、tool_mc_compile、tool_mc_inspect，使用正确类型注解、Args 文档和 ToolResponse。模型可见参数与可信程序参数分离。
- 将工具纳入实际 mode、可见性与执行授权链。覆盖当前绕过 interceptor 的 subagent_tools 路径；以真实调度入口的拒绝测试证明权限，而非只读 allowed-tools 文本。沿用现有拦截机制，避免另建权限系统。
- MC 原始检查结果含 schema 和随页面增长的数组。程序侧保留完整报告，模型侧返回明确有界的摘要；记录总体结论、检查/关联状态、缺口总量和省略范围，提供受控继续读取或明确的超限结果。显式输出预算与 UTF-8 字节测量，不能依赖 SDK 静默截断。
- Skill 从 MC 读取 catalog、模板、hardPins、空值语义和协议事实；Skill 本身保留采用及交付决定。用数证据和标记继续遵守包内协议。字符限制须有实际接口/数据库依据，“utf8mb4 禁 emoji”不作为 MC 事实传播。
- injectedResources 声明按实际消费情况处理；当前报告中该字段未被消费，不把元数据存在当作注册成功。

完成条件：实际模型可见集合、执行权限、返回类型与报告预算都有回归；MC 安装目录在执行账户下具备部署只读隔离。

## 5. 验收矩阵

| 场景 | 必须证明 |
|---|---|
| 正常编译→装配→检查 | 原始输入、编译 plan、实际请求、原样 spec、产物和绑定均有来源与关联；模型只有有界结果 |
| 同一 turn 两次装配 | A/B 引用、spec 和产物分别关联，交换引用失败 |
| 跨 turn/用户/工作空间 | 旧或外部作用域引用不能被读取或借用 |
| 重试与迟到回执 | 冻结提交和 operationId 不变；迟到结果不覆盖新请求 |
| 旧 spec/包更新 | 不混用内存旧代码和新磁盘；新进程整包校验，旧 spec 有明确结果 |
| 未授权工具 | 从真实执行入口拒绝，工具函数未执行；模型可见性另验 |
| 可写性 | 用执行账户与安全测试目录验证同类 ACL/文件工具路径，记录生产安装权限；不破坏生产包做试验 |
| 超大报告/缺依赖 | 报告有界且不冒充完整；Node 等依赖缺失明确 not_run/不可用 |
| 保存 unknown/pending/rejected | 原有锁定与核对流程保持；预览失败不新增保存 |
| 实际预览与标记 | 精确 artifact/ref/binding、占位符顺序、卡片内容及最终可见性均有证据；ready 单独解释 |

先完成隔离测试，再以现有测试账户、专用测试页面和合成数据验收真实 Relay、DQE/权限、Java 保存和预览。真实业务页修改、真实发布及 DS 模型专项不在本任务范围。没有相应环境时标 not_run，并列明缺少的端点、身份或部署物，不用模拟结果代替。

检查 1 秒/迁移 2 秒仍是候选预算，测量环境和完整链路范围分别记录；测试等待时间与产品预算分开。

## 6. 交付回执

输出：实际源码/服务/引擎/MC 身份，按文件的变更职责，真实调用链，测试矩阵及命令结果，模型通道可见性证据，复杂度前后与存量项，兼容及回退说明，最终 Git 状态。区分源码推断、隔离实验和真实部署验证。

每项以 passed/failed/not_run 记录。query/compile 可用不能关闭完整 inspect；通道/权限/部署证据缺失时仍保留对应未完成项。原报告中基于旧包的缺口用新版重测结果关闭，不重复要求 MC 补发已交付内容。
