# 自有 MCP 工具完整盘点与接入状态

核对日期：2026-09-18。代码：HEAD 14526fbb 加当前工作区。范围：内部 dataAgent 报告中用户确认自有的工具，加 metriccanvas-authoring 当前全部生产入口注册面。未包含测试专用 MCP、普通内部函数或未注册工具。

## 更正

此前把内部报告中的 9 个自有工具当作本方全部能力，漏掉了本仓新版工具。这是清单范围错误；用户确认的是该报告中的归属，不是确认本仓只具备 9 个工具。

本次实际用 FastMCP Client 在进程内执行 list_tools，覆盖 4 个 CLI 的 5 种工具面：本仓 15 个不同名称；内部报告的 9 个与本仓有 discover_data_context、compose_page 两个同名；合并为 22 个不同名称。名称去重不是接口等价、22 个同时启用或22 项生产可用的证明。

内部报告的工具和生产对接情况仅以报告为证；本仓注册通过实际枚举验证，未执行工具业务动作或请求外部服务。默认组合缺少提供方的工具必须明确标注不可用。

## A. 本仓当前统一创作：5 个工具

入口 metriccanvas-platform-content，注册作者：`metriccanvas-authoring/tool/metriccanvas_authoring/adapters/inbound/unified_content_mcp.py`。

| 工具 | 业务能力 | 外部调用性质 |
|---|---|---|
| read_page_context | 从可信创作基线或同轮候选读取有界结构、目标配置和分页投影 | 核心为本地投影；可信轮次/候选端口的实现可能涉及外部读取，不直接请求业务数据 |
| discover_data_context | 数据能力发现、业务域路由信息、语义解析及消歧 | 通过数据上下文/解释端口取得能力；网络依赖由 Adapter 决定 |
| compose_page | 按页面构建规格完成查询验真和数据页面装配 | 读取数据上下文、执行 DQE，可请求源描述；呈现构造和校验本地执行 |
| create_content_page | 新建混合内容页面，支持页面结构计划和受控操作组合 | 含新增取数时通过相同取数链访问外部；纯文本/已有来源组合主要内部执行 |
| edit_page | 对完整创作基线或同轮候选局部修改、结构调整、组件追加、交互编辑 | 普通内容/布局/已有源操作内部执行；add_data_component 会访问数据上下文、源描述和 DQE；仍须可信轮次与候选端口 |

五工具的统一入口都要求 context_ref。独立 CLI 可枚举工具，但未注入可信轮次、候选存储等必要依赖时，不能宣称新建/编辑已接通。真实内部工程是否接入后三个新增名称仍需核对，不能因报告未列就判断本仓未实现。

edit_page 与 update_page_metadata 不同：前者修改页面内容并产出候选；后者持久化页面资产修订。两者不可替代。

### edit_page 的 27 类操作（非 27 个 MCP）

直接由当前 UNIFIED_EDIT_SCHEMA 枚举：

- 展示与布局：set_title、set_component_layout、set_properties、set_series_label、set_metric_row、set_table_column、move_component、set_page_layout、change_component_type。
- 内容与容器：add_text、add_field_text、add_map_chart、remove_component、add_composite_card、add_tab_container、add_ai_summary。
- 筛选与导航：add_dimension_filter、update_dimension_filter、remove_dimension_filter、set_table_link、remove_table_link。
- 新增取数组件：add_data_component。
- 分区与已有源复用：add_section、set_section、move_section、remove_section、add_source_component。

操作受各自契约限制；例如 add_ai_summary 要求可信运行时配置，remove_component 并不等于允许删除任意组件，add_source_component 不等于可执行任意新查询。27 项计数表示受控操作种类，不表示无条件支持。

create_content_page 的操作式输入允许 9 类：add_ai_summary、add_composite_card、add_data_component、add_field_text、add_map_chart、add_tab_container、add_text、move_component、set_component_layout；另支持结构计划输入。

## B. 内部报告自有、在本仓未以这些名称注册：7 个工具

来源：`调查报告/dataagent-mcp.md`，加用户对维护归属的确认。

| 工具 | 能力 | 外部调用性质 |
|---|---|---|
| save_page_metadata | 创建页面资产 | Java 创建接口 |
| update_page_metadata | 更新已有页面资产 | Java 更新接口 |
| get_page_metadata | 读取页面资产详情 | Java 详情接口 |
| list_page_metadata | 查询页面资产目录 | Java 列表接口 |
| delete_page_metadata | 删除页面资产 | Java 删除接口 |
| execute_page_metadata | 按参数执行已存页面 | Java 页面执行接口 |
| page_metadata_emit_preview | 从程序注入的产物输出 previewJson 工作台事件 | 本地组装与交付，不请求远程服务 |

内部报告另外的 discover_data_context、compose_page 已在 A 中按名称去重；内部版与本仓版的参数、信封、页面版本、轮次和候选机制不据此视为一致。

## C. 本仓兼容专用：1 个额外名称

build_page：旧 compatibility 工具面下，组合后继续调用页面资产保存。涉及数据上下文、DQE 和资产服务。是既有兼容能力，不应作为新版内容工具失败时的回退。

## D. 本仓独立生命周期：9 个已注册工具

入口 metriccanvas-lifecycle。注册作者：`adapters/inbound/lifecycle_mcp.py`、`publish_mcp.py`；生产组合：`lifecycle_server.py`。

| 工具 | 能力 | 对外依赖 / 默认可用性 |
|---|---|---|
| save_draft | 保存可信程序提供的页面命令 | 依赖资产端口；当前默认 single_save 不能由裸生命周期 MCP 绕过持久执行协调直接提交 |
| get_save_result | 查询原保存操作 | 依赖 operation_lookup 等保证；当前默认 Java Adapter 不提供远端查询能力 |
| read_revision | 读取精确历史修订 | 依赖 exact_read；当前默认 Java Adapter 不具备 |
| list_revisions | 固定快照/游标的修订历史 | 依赖 history；当前默认 Java Adapter 不具备该强端口 |
| prepare_candidate | 准备发布候选 | 依赖发布服务；默认 UnavailablePublicationService |
| read_candidate | 读取发布候选 | 同上 |
| revise_candidate | 调整发布候选选择 | 同上 |
| confirm_publish | 使用可信人工确认完成发布 | 依赖发布服务与人工确认提供方，默认均不可用 |
| get_publish_operation_result | 查询原发布类操作 | 依赖发布服务，默认不可用 |

这里的发布候选不同于内容工具生成的创作候选。注册这些旧强契约入口不代表 ADR-0080 要求恢复强保存/发布治理。本次盘点不据此扩大改造范围，应在之后讨论中明确兼容保留或后续处理。

## 实际 list_tools 证据

通过包内环境的 fastmcp.Client(server).list_tools() 枚举，只读取注册面：

```json
{
  "compatibility": ["discover_data_context", "build_page"],
  "relay": ["discover_data_context", "compose_page"],
  "content": ["discover_data_context", "compose_page", "edit_page", "create_content_page"],
  "unified-content": ["read_page_context", "discover_data_context", "compose_page", "create_content_page", "edit_page"],
  "lifecycle": ["save_draft", "get_save_result", "read_revision", "list_revisions", "prepare_candidate", "read_candidate", "revise_candidate", "confirm_publish", "get_publish_operation_result"]
}
```

content 是旧内容入口，使用 baseline_token/page_id 等参数；unified-content 是可信创作轮次入口。compatibility 与 relay 是同一 CLI 的互斥配置。工具不能跨面按同名随意替换。

## 不计为额外 MCP 的能力

authoring_turns、authoring_candidates、authoring_submission、authoring_recovery、source_mapping、组件构造、布局、整页校验等有程序接口，但没有各自的 MCP 注册项。最终候选提交和恢复协调不能因此被遗漏于架构，也不能计入 MCP 工具数量。

## 后续讨论范围修正

接下来联合讨论统一创作的五工具：read_page_context、discover_data_context、compose_page、create_content_page、edit_page。先确定新建、当前页修改和配置问答三种旅程及交接对象，再裁决取数、表达、编辑如何共享内部能力以及模型决策点。外部保存、预览交付及旧生命周期兼容面作为相关但独立的责任范围。

原始 dataAgent 报告不在此改写；它描述内部现状。我们负责在本清单中记录与本仓能力的差集和接入状态。
