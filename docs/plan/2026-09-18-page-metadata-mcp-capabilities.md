# 页面元数据 MCP 能力盘点与补齐规划

日期：2026-09-18。状态：用户已批准，本仓实现及本地回归已交付，外部生产联调未验收。下文保留实施前盘点与原规划；当前交付状态以本节、第 11 节和[参数接入交付](page-parameter-inlining/external-integration.md)为准，不代表生产接入承诺。

### 实施状态

- 已注册三个独立参数工具，统一工具面从 5 项增加到 8 项；实际工具 Schema 禁止模型传 baseline、维度身份或完整页面。
- 已实现持久不可变提取/实例记录、有效期与上下文绑定、可信验真提供方接缝、受控文本槽位、模板人工发布保护。
- 已实现临时实例可信读取和工作台只读 RuntimeView 接缝，不写原页面或保存队列；赋值工具自身不执行 DQE。
- 已将 6.x 支持范围收敛到 6.5，并更新当前夹具、契约导出及分发 Skill；历史证据不改写。
- 真实验真提供方、Relay 分流/实例桥接、Java 保存回读和真实 DQE 链路仍需外部联调。未注入相应依赖时失败关闭。

## 1. 结论与范围

当前平台的统一内容 MCP 有 5 个工具，覆盖读取配置、发现数据、生成页面和受控编辑。页面参数提取、人工选择后形成模板、赋值解析已经有内部实现，但没有独立 MCP 工具入口。模板召回和参数化页面执行也不在这 5 个工具中。

建议在现有 `metriccanvas-platform-content` 服务中增加 3 个独立工具：提取候选、应用选择、赋值解析。不要另建一套页面作者或生命周期服务，不把保存发布并入参数工具，也不要求模型传 baseline、维度身份映射或完整页面。

本次盘点和规划不修改实现、不创建 GitHub Issue、不改变服务注册或部署。批准实施后再拆分本仓 GitHub Issues。

## 2. “可用”的三个层次

1. **代码已实现并注册**：仓库存在实际工具定义，测试能通过 MCP 调用。
2. **部署依赖齐备**：真实部署注入当前轮次、身份、候选存储、数据上下文和数据执行等所需能力。
3. **生产验收通过**：真实 Relay/Java/数据服务与模型链路有证据。

下文的“已有”主要指第 1 层，不自动代表第 2、3 层。本次 Codex 会话的已加载工具清单中没有 MetricCanvas 工具，因此这里盘点的是仓库交付能力，不是宣称本会话能直接调用这些业务工具。

## 3. 当前主入口：统一内容 MCP

实际注册位于 [unified_content_mcp.py](../../metriccanvas-authoring/tool/metriccanvas_authoring/adapters/inbound/unified_content_mcp.py)，入口为 `metriccanvas-platform-content`。

| 工具 | 主要输入 | 能力与结果 | 不包含的能力 |
|---|---|---|---|
| `read_page_context` | context_ref、可选 candidate_ref、组件目标、分页 | 有界读取根基线或同轮候选的结构/配置，返回摘要 | 不返回完整页面、DQE 查询体或数据行；不是模板检索 |
| `discover_data_context` | context_ref、query、limit | 发现受治理业务域、指标、维度和消歧信息 | 不是页面文档搜索，不修改页面 |
| `compose_page` | context_ref、Page Build Spec、layout | 新建上下文中生成查询、验真、装配并生成页面候选 | 不覆盖已有页，不保存发布 |
| `create_content_page` | context_ref、title、受控 operations、layout | 新建数据与静态内容混合页面候选 | 不接收任意页面 JSON，不保存发布 |
| `edit_page` | context_ref、受控 operations、可选 candidate_ref | 修改根基线或同轮候选，返回经过整页校验的候选 | 不是通用 JSON Patch，不提供参数提取/赋值入口，不保存发布 |

`edit_page` 当前操作包含：标题、布局、受控属性、系列标签、指标行、表格列、移动组件、页面布局、受控组件类型变换；添加文本、字段文本、地图、容器、运行时 AI 总结和数据组件；删除组件；增改删维度筛选；设置/移除表格链接。各操作有自身限制，不能据此宣称支持任意组件、查询或页面字段修改。

完整产物通过 `structuredContent.artifactEnvelope` 交给可信程序，模型只消费 `modelSummary`。模型不填写完整页面、DQE、数据行或任意业务身份凭据。该隔离依赖 Relay Adapter 正确分流，不能仅凭信封字段名称就认定不会泄漏。

**部署限制：** 单独启动 [unified_content_server.py](../../metriccanvas-authoring/tool/metriccanvas_authoring/unified_content_server.py) 会展示工具，但没有可信 current-turn 提供方时明确不可用；写候选还需要 candidate_store。不能把 `list_tools` 成功当作业务可执行，也不能回退旧文件 token 绕过这些要求。

## 4. 其他入口：不能与当前平台能力混算

| 入口 | 实际工具 | 定位 |
|---|---|---|
| `metriccanvas-content` | discover_data_context、compose_page、create_content_page、edit_page | 旧内容调用方；使用 page_id/baseline_token 等接口，不是当前平台推荐入口 |
| `metriccanvas-authoring`，relay 模式 | discover_data_context、compose_page | 原页面生成/问数链路；产物经 Relay 交付，无保存副作用 |
| `metriccanvas-authoring`，compatibility 模式 | discover_data_context、build_page | 历史生成并保存链路；不能用其旧幂等承诺代替当前 Java 单次保存契约 |
| `metriccanvas-lifecycle` | 下列 9 项工具 | 已注册的强生命周期协议兼容面，当前生产默认依赖不支持 |

生命周期 MCP 的 9 项工具：

- 草稿：`save_draft`、`get_save_result`。
- 读取：`read_revision`、`list_revisions`。
- 发布候选：`prepare_candidate`、`read_candidate`、`revise_candidate`。
- 发布：`confirm_publish`、`get_publish_operation_result`。

这 9 项只接受可信程序的 request_token。生产组合的强保存、精确读取、历史、操作查询及发布能力默认不可用；不能仅因工具名存在就认为当前 Java 已支持这些保证。`prepare_candidate` 也不是本次 6.5 的本地参数提取工具，它向权威发布服务委托操作。

当前 Java 保存/发布依照 [ADR-0080](../adr/0080-java-assets-single-attempt-save-and-status-publication.md)：可信程序单次提交，工作台明确发布，可信回执确认；未知结果停止、不重发，不要求旧强协议的 lookup/lease/exactRead。新增参数工具不能借机把这些前置重新引入。

## 5. 没有独立 MCP 入口的能力

| 能力 | 当前实现 | 缺口 / 归属 |
|---|---|---|
| 页面结构校验 | TS parsePage、Python validate_page_document；内容操作内置校验 | 当前入站 MCP 未注册独立 validate_page；不能把文档中出现这个名字当成可调用工具 |
| 参数候选提取 | TS extractPageParams | 缺模型可调用入口与可信提取记录 |
| 选择后生成无值模板 | TS applyPageParamSelection | 缺候选选择、文本确认的 MCP 工作流 |
| 参数赋值与确定性解析 | TS resolvePageParams | 缺可引用模板/候选的 MCP 入口；不是执行器 |
| Python 参数交接 | prepare_page_parameters + 注入 ParameterProgram | 是内部函数，不是 MCP；当前摘要只有数量/所选 ID，不够承载模型审阅候选 |
| 参数预览 | 工作台 inline-parameter-publication 与预览接缝 | 不是 MCP，仍需可信来源和真实执行接入 |
| 模板检索/召回 | 外部提供方负责 | 不能用 read_page_context 冒充检索，也没有确认可用的模板搜索契约 |
| 参数化页面运行 | 统一运行时解析并执行已定义查询 | 不在本次 5 个内容工具中；赋值成功不等于执行成功 |
| 保存/发布 | 当前可信提交程序、工作台和 Java Adapter | 不应授予新增参数工具直接写入权限 |

源码依据：[参数提取](../../packages/page/src/extract-page-params.ts)、[参数解析](../../packages/page/src/resolve-page-params.ts)、[Python 交接](../../metriccanvas-authoring/tool/metriccanvas_authoring/application/parameter_preparation.py)、[工作台确认](../../apps/platform/src/lib/workbench/inline-parameter-publication.ts)。

## 6. 建议的目标工具面

以下名称、字段均为**拟议接口**，不是当前可调用工具。依照 codebase-design 的深 Module 原则，把来源获取、身份映射、校验和产物隔离收进同一个参数 Module；MCP Adapter 和工作台复用该 Module，不各写一套逻辑。

### 6.1 `extract_page_parameters`：只提取和解释候选

拟议输入：`context_ref`、可选 `candidate_ref`。省略 candidate_ref 时读当前根基线；提供时读取同轮可信候选，绝不默默改用“最新页”。

内部完成：取得完整页面、确认查询验真依据、从可信提供方获取维度身份、调用提取函数、保存不可变提取记录。模型不提交 baseline/dimensionIdentities，也不自行声明“已验证”。仅有修订号或文档 hash 不足以证明查询验真。

模型结果：`extraction_ref`、受控候选摘要（candidate_id、建议参数 ID、类型/精度、标签、覆盖/未覆盖查询、默认勾选、跳过原因）、待处理文本位置。原值摘要是否可显示受当前身份和数据暴露策略控制，完整查询和原始行不返回模型。

副作用：只写过程记录，不改变页面、不执行 DQE、不保存资产。跨源身份缺失时保守分开；来源未经验证时明确不可用，不伪造证据。

### 6.2 `apply_page_parameter_selection`：按确认形成模板候选

拟议输入：`context_ref`、`extraction_ref`、`selected_ids`、受控 `text_choices`。

建议由提取记录提供文本位置标识，模型选择“改为参数整值引用/通用字面文本”等受控操作；不要暴露任意 JSON Pointer 写入通道。内部转成现有 textReplacements。新增候选 ID 与页面参数 ID 在契约中分别定义，不能混用。

内部完成：核对来源、当前身份和提取记录，应用选择与文本修正，原值回填验证查询等价，删除所选参数 value/default 及旧 initial，整页校验，产生不可变模板候选。

模型结果：`candidate_ref`、文档用途为无值模板、选择与变更摘要、尚待预览/确认状态。完整文档只进程序通道。

副作用：生成候选，不覆盖原页面、不发布。模型提交选择不等于独立人工发布确认。来源或选择变化后旧预览与确认失效。

### 6.3 `resolve_page_parameters`：赋值和解析，不执行或保存

拟议输入：`context_ref`、可选 `candidate_ref`、`values`（参数 ID → 规范值）。读取已打开的可信模板，或当前轮次的模板候选；不允许任意完整页面输入。

内部调用现有解析函数，验证未知键、必需输入、维度值形状、时间区间与窗口。输出与根基线绑定的**临时运行产物引用** `instance_ref`，不能直接包装成可自动提交的创作候选，避免普通召回运行意外触发保存。

模型结果：成功状态、生效输入的受控摘要，或缺值/非法值问题。完整填值文档及执行副本交程序通道。`instance_ref` 是拟议过程引用，不是页面 JSON 新字段，也不是 Java 资源 ID。

副作用：只产生运行产物，不执行 DQE、不保存、不发布。无论从无值模板还是填值文档输入，都明确本次全部生效值；不能悄悄沿用旧实例值。自然语言期间先规范化、歧义先追问。

### 6.4 暂不增加的工具

- 不将内部每个校验步骤都暴露为工具。整页校验是上述写候选/解析 Interface 的必经步骤；独立 `validate_page` 仅在确定“外部导入文档诊断”需求和可信上传入口后再立项。
- 不新增 MCP 保存发布工具绕过现有单次提交路径。
- 不把模板搜索嵌入参数解析。先明确外部模板目录、权限、发布状态和修订读取契约；已有业务检索若能提供可信引用就复用。否则另立 `search_page_templates` 提案，不能靠猜接口实现。
- 不把解析包装成执行。首期由现有工作台/运行时消费 instance_ref 对应的填值文档；若目标是纯对话运行，再单独定义执行入口、取消、权限、成本和结果回传契约。

## 7. 四个场景的完整调用关系

| 场景 | 调用路径 | 产物与动作 |
|---|---|---|
| 初次生成运行 | discover_data_context → compose_page/create_content_page → 可信程序交工作台 | 创作候选；查询已在创作期验真，页面预览与保存按既有流程 |
| 提取模板 | extract_page_parameters → 人工审阅 → apply_page_parameter_selection | 无值模板候选，不自动发布 |
| 预览模板 | resolve_page_parameters（预览输入）→ 程序交运行时 → 人工发布确认 | 预览执行填值文档；发布保存原无值模板，不保存预览值 |
| 召回赋值运行 | 外部模板检索/选择 → 将精确模板装载为可信上下文 → resolve_page_parameters → 程序交运行时 | 临时页面实例；不复用失效轮次引用，不自动保存 |

新工具首期只面向当前统一平台入口；旧问数若要使用，需要显式接入同一 Module 和可信上下文，不能直接沿用另一会话的 context_ref。

## 8. 实施顺序与验收

| 阶段 | 工作 | 验收结果 |
|---|---|---|
| P0：收敛事实与契约 | 确定 5+3 工具面、过程引用和临时运行产物类型；明确提供方责任；清理 README 中旧/新入口混写 | 一份工具清单与能力状态；拟议与已实现不混写；输入不含模型自报基线/身份/原文 |
| P1：6.5 与公共参数 Module | 将“6.5 为 6.x 唯一支持版本”落实为 TS/Python/生成契约/测试统一规则，5.x 不扩大变更；复用提取与解析逻辑，补可信程序适配 | 两侧拒绝 6.0—6.4；迁改本仓活跃样例/测试；历史冻结证据不伪造；不顺带删除仍被 6.5 使用的字段 |
| P2：提取与选择 MCP | 注册 extract/apply 两工具，接入可信来源、提取记录、文本选择和候选存储 | 真 MCP list_tools/call_tool 验证；原值回填等价；单/多查询覆盖；跨源无身份不错误合并；无保存调用 |
| P3：赋值与运行产物 | 注册 resolve 工具，扩展 read_page_context 的受控参数摘要，接入临时产物到工作台/运行时 | 缺值不执行；非法显式值不回退；文本/查询同步；发送 DQE 无 param；原模板不变；运行不触发保存 |
| P4：端到端与交付 | 更新工具契约、Skill、Bundle、部署配置；真实调用生成→提取→选择→预览→确认→召回运行 | 完整产物不经过模型转抄；确认与来源绑定；unknown 不重发；真实 Java/Relay/DQE 证据与本地替身证据分开 |

P1 的版本收窄来自本次用户要求，现已落实到代码、生成器、活跃样例和跨版本测试。**这与 ADR-0051 对同主版本内已发布次版本保持可读的规则存在冲突；本次按用户明确裁决，对 6.x 读取范围作例外收窄，只保留 6.5，5.x 读取例外不变。** 能力历史表不删除，历史冻结产物不伪造升级。

公共否定测试：旧/跨身份/跨轮次引用拒绝；来源变化使候选失效；延迟结果丢弃；进程重启后引用持久性与过期明确；没有提供方时不可用而不回退；文档/查询/数据行不得泄漏到模型摘要。

## 9. 外部前置与待确认决策

1. 推荐批准“现有服务新增 3 工具”，不单独部署一个参数 MCP 服务。
2. 推荐首期按工作台完成预览与运行闭环；纯对话执行入口另行确定，不能以参数解析完成冒充运行完成。
3. 真实提供方需明确：查询验真依据如何取得，维度身份由谁治理，提取记录与临时运行产物存在哪里、保留多久，模板检索返回什么可信引用。没有这些输入可完成本地工具测试，但不能完成生产验收。
4. 当前同轮候选和召回资产的引用寿命不同，必须在新轮次重新建立可信上下文，不把 candidate_ref 当永久模板 ID。

## 10. 实施前核验记录（历史）

- 阅读实际注册、CLI 组合、参数内部实现与 ADR-0080；未仅按 README 推断生产可用性。
- 运行 `test_unified_content_mcp`、`test_content_mcp`、`test_parameter_preparation`：共 19 项通过，覆盖实际工具枚举、MCP 调用与参数程序交接。
- 这些结果只证明规划时的本地既有能力；当时新增 3 工具尚未实现，当前实现状态见第 11 节。

## 11. 实施后核验记录

- 实际 FastMCP Client 枚举 8 项工具，并调用提取→选择→赋值；参数程序真实启动 Node 子进程。完整解析查询不含 param 对象，模板原文不变，临时实例不进入候选存储。
- 边界覆盖：缺少提供方、只读禁止应用选择、过期/跨轮次/跨身份/篡改记录、来源变化、撤销验真、迟到结果、缺值/非法值、重建 SQLite 适配器后读取、子进程超时与输出限制。模板及后续编辑拒绝普通自动保存。
- Python 全量回归、工作区类型检查、Page/Engine/MetricCanvas 包构建、包完整性检查及 Platform 生产构建通过；Bundle 校验 1,495 项 digest，导出契约一致性检查通过。
- Vitest 全量：1,446 通过、5 跳过、2 个既有失败。失败分别为 `tests/dev-server-contract.test.ts` 的 5174 断言与 HEAD 默认 443 冲突，以及 `tests/page-reference.test.ts` 的历史来源清单 hash 已与 HEAD 参考文件不一致；只读核验 HEAD 确认两者先于本次存在，没有重写历史 hash 或放宽断言。
- PAGE-PARAMETERS.md 的 14 段 JSON 全部可解析，4 个完整页面通过当前页面校验。文档、八工具 Skill、工具清单、程序协议和部署职责已同步。
- 以上是本地 MCP、程序、状态模块与构建证据；没有新增浏览器视觉验收、真实模型调用或真实 Relay/Java/DQE 生产联调证据。部署方仍须完成真实验真、模板召回、信封分流、可信实例读取桥接和人工发布接线，不能把工具注册或赋值成功当成生产运行完成。
