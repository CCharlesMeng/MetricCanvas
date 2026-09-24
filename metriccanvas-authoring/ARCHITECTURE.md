# 创作接入架构

## 唯一交付目录与所有权

`metriccanvas-authoring/` 是完整源码交付目录。公共更新保护 `tool/metriccanvas_authoring/adapters/` 整棵树；不再有包外 Relay 扩展工程、顶层 Relay 实现、company 或 local 目录。

公共代码拥有页面规则、查询派生、工作稿、保存与产物核对、MCP 工具定义及消费方接口。内部拥有全部实际系统适配，包括身份来源、配置、HTTP 映射、共享存储及 Relay 的程序通道。

`ownership.json` 定义内部目录与公共参考模板位置。`bundle.lock.json` 只列公共文件；内部实现由公司 Git 和内部构建产物哈希追溯。源码合并后在内部构建一个 Python 包，不另外发布一个 Relay 扩展包。

## 平台运行链

`entrypoints/mcp/platform_server.py` → `bootstrap/platform.py` → `bootstrap/deployment.py` → 动态加载 `adapters.factory:create_adapters()` → 公共就绪检查 → `PlatformAuthoring`。

工厂返回 `bootstrap/adapter_contract.py` 中的 `AuthoringAdapters`。工厂负责创建实现；公共 bootstrap 负责构成服务。缺实现、版本不匹配或装配错误明确失败；完整异常和凭据不输出。`METRICCANVAS_PROTOCOL_DISCOVERY=1` 仅用于离线检查工具 Schema，不加载内部实现、不证明生产就绪。

`semantic_catalog` 显式注入，不再按某个 Java 类的 isinstance 判断。可复用公共 `data.semantic_catalog.SemanticCatalog`，由内部实现其元数据提供方。没有该可选能力时仍支持基于数据上下文的发现，但不能声称具备指标详情能力。

平台固定九工具：read_page_context、discover_data_context、query_data、compose_page、edit_page、page_metadata_emit_preview、extract_page_parameters、apply_page_parameter_selection、resolve_page_parameters。模型接收 modelSummary；完整页面通过 artifactEnvelope 和受信任程序通道交接。

## 代码定位

| 模块 | 职责与公共接口 |
|---|---|
| data | 数据上下文、查询派生与执行、精确查询授权、指标发现 |
| pages | 页面组合、编辑、结构与字段校验、参数处理 |
| work | 可信创作轮次、固定创作基线、工作稿与持久状态 CAS |
| assets | 单次条件保存、当前页面修订核对、未知保存状态保留 |
| delivery | 定义/预览分离、精确 artifactRef/ref 交接核对 |
| bootstrap | 适配器集合、内部加载与统一装配 |
| adapters | 内部 firstparty/relay/storage 实现、factory、配置与测试 |

公共业务模块不导入内部实现。旧普通问数和生命周期入口仍通过 `bootstrap/environment.py` 委托内部 `adapters/environment.py`，这是兼容路径；平台入口不经过它。内部若只接平台，可不配置这些兼容能力。

## 首次交付、mock 与模板

`examples/adapter_template/` 是受维护的初始参考，内部目录初次提供同类实现，此后可独立修改。公共适配测试显式导入模板；test-harness 的 fakes、HTTP fixture 和脚本化模型只用于测试。平台启动绝不自动选择它们。

公共更新可改变模板，不改变内部实现。内部应阅读接口变更、运行兼容检查，再按实际环境吸收参考修复。任何公共接口类型均不得放在内部目录作为真源。

## 状态规则

同轮多次 MCP 子进程必须共享持久工作状态与稳定 binding；数据请求先确认后执行。编辑核对 Java 当前修订；保存未知或冲突不自动重发。保存 document 去掉查询 initial，previewJson 保留对应预览数据。程序通道接收成功不等于前端已经显示，保存也不等于发布。

## 分发与验证

参考 [接入说明](RELAY-HANDOFF.md)、[接口](contracts/authored/adapter-interface.md)、[真源](SOURCES.md)。公共同步先校验源锁和目标公共修改，再更新清单文件并删除已退役公共文件；内部树始终保留。内部依赖写 adapters/requirements.txt，由内部安装和固定版本。

本地检查证明公共规则、参考协议和创建/编辑主流程；真实 Relay、Java、DQE、身份与页面可见性需要内部验收。
