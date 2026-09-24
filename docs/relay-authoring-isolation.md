# 平台页面创作与 Relay 的代码隔离

本仓同时存放 MetricCanvas 通用创作包和 **Relay 自管扩展**。扩展的确定位置是 [`integrations/relay/metriccanvas_authoring/`](../integrations/relay/metriccanvas_authoring/README.md)，位于 Bundle 目录之外。Relay 可以从 GitHub 同步本仓代码并在这个目录内独立实现接线；不需要先取得另一个 Relay 仓库的目录树。这里的“独立”指源码所有权与构建发布分离，同一 Git 仓库内提交仍需正常合并。

## 直接同步的路径与所有权

| 本仓路径 | 使用方式 | 后续修改方 |
|---|---|---|
| `metriccanvas-authoring/tool/` | 安装固定的 `metriccanvas-authoring==0.3.1` Python 包，提供九工具、Port、通用 Adapter 和确定性主流程。 | MetricCanvas 通用包；Relay 不在同步副本里改其源码。 |
| `metriccanvas-authoring/skill/metriccanvas-platform-authoring/` | 整目录安装到 Relay 使用的 `.skills/metriccanvas-platform-authoring/`。 | MetricCanvas 通用 Skill。 |
| `metriccanvas-authoring/contracts/`、`contract-snapshot/`、`bundle.json`、`bundle.lock.json`、`contract-lock.json` | 按同一提交校验协议、页面 Schema 和逐文件哈希。派生文件只由本仓生成器维护。 | MetricCanvas 通用契约。 |
| `integrations/relay/metriccanvas_authoring/` | 安装独立的 `metriccanvas-relay-authoring` 扩展包，把 Relay 的可信上下文、内部服务和产物通道接到通用包。 | Relay 对接方，可在本仓这个目录内独立修改。 |
| `integrations/relay/metriccanvas_authoring/mcp_configs/metriccanvas-platform-content.json` | 九工具 MCP 注册样例；部署方将其内容登记到真实 `.relay/mcp_configs/`，审定命令路径和调用专属配置。 | Relay 对接方。 |

普通问数配置 [`metriccanvas-authoring/relay/mcp_configs/metriccanvas-authoring.json`](../metriccanvas-authoring/relay/mcp_configs/metriccanvas-authoring.json) 使用的是另一入口，不能直接代替九工具平台配置。0.3.1 的 `metriccanvas-platform-content` 默认命令缺少可信提供方会失败关闭；Relay 使用本仓扩展的 `metriccanvas-relay-authoring` 命令。

## Relay 后续具体改哪里

从 [`adapters.py`](../integrations/relay/metriccanvas_authoring/src/metriccanvas_relay_authoring/adapters.py) 的 `create_host_adapters()` 开始，在同一 `src/metriccanvas_relay_authoring/` 目录添加内部 Adapter 文件。这里负责从 Relay **可信调用上下文**取得当前轮次和认证身份，核对绑定确认范围、精确请求及数据上下文版本，连接数据上下文、DQE、Java 页面仓储及程序通道预览接收。部署配置在该扩展的 `mcp_configs/`；内部契约测试在 `tests/`。可以独立调整这些实现和部署配置，保留 [`host.py`](../integrations/relay/metriccanvas_authoring/src/metriccanvas_relay_authoring/host.py) 定义的 `relay-authoring/1.0` 接口。

扩展的入口 [`entrypoint.py`](../integrations/relay/metriccanvas_authoring/src/metriccanvas_relay_authoring/entrypoint.py) 只装配并运行服务；它在提供方缺失时失败关闭。`HostAdapters.store` 可注入内部存储 Adapter；否则配置同轮所有 oneshot 调用稳定可达的 `METRICCANVAS_WORK_DB`，使用本仓 SQLite CAS 实现。`HostAdapters.lifecycle_service` 可注入内部页面仓储 Adapter；否则配置 `METRICCANVAS_LIFECYCLE_COLLECTION_URL`，使用已有 `KnownLifecycleHttp`。参数依赖与额外源描述提供方是可选项，不阻塞主流程。运行记录和未知保存核对记录不得在子进程退出时删除。

通用包维护九工具的名称、输入输出、结果字段契约、查询字段映射、binding 与确认语义、单次条件保存和产物交接结果。若 Relay 需要改变这些协议，先在通用包升级契约和版本；仅更换内部 URL、认证、存储路径、可信上下文映射或接收程序通道，可只发布 Relay 扩展修订。扩展里不放凭据或用户数据；它们由真实部署的调用专属机制提供。不得靠修改 Relay 主进程共享 `os.environ` 传递并发身份，也不得靠子进程环境变量向父进程回传预览。

## 能够分开同步的检验标准

1. **固定通用版本**：本批通用包为 `0.3.1`，平台工具协议 `2.0`，可信轮次接口 `authoring-turn/1.0`。扩展 `pyproject.toml` 固定依赖该版本，`HostAdapters.interface_version` 必须为 `relay-authoring/1.0`。同步新通用版本时先执行兼容测试，再更新依赖；Git 只按目录同步不会自动保证运行兼容。
2. **公共接口与就绪检查**：[`host.py`](../integrations/relay/metriccanvas_authoring/src/metriccanvas_relay_authoring/host.py) 通过通用 `platform_readiness` 验证提供方已装配，缺当前轮提供方不能报告就绪；启动时不要求已有用户轮次。实际轮次再通过 `current_turn_readiness` 检验。扩展测试核对九工具及失败关闭。
3. **协议与行为向量**：[`platform-v2-protocol.md`](../metriccanvas-authoring/contracts/authored/platform-v2-protocol.md)、[`authoring-turn.schema.json`](../metriccanvas-authoring/contracts/authored/authoring-turn.schema.json) 及 [`INTERNAL-VALIDATION-0.3.1.md`](../metriccanvas-authoring/INTERNAL-VALIDATION-0.3.1.md) 规定授权、同轮状态、未知保存、精确产物回执和内部验证。`bundle.lock.json`、`contract-lock.json` 与固定提交哈希校验通用文件；扩展本身由独立 Git 提交或扩展包版本固定。

源码同步可在同一提交取 `metriccanvas-authoring/` 和 `integrations/relay/metriccanvas_authoring/`，只在后一目录做 Relay 专用修改。此后通用包更新时单向同步前一目录，保留后一目录，再运行扩展契约和内部验证。现有 0.3.1 本地发行 ZIP 的 SHA-256 为 `090d8f23b0ed43ee19976c4b7762dfb647eca4c3a0cae18d423bbdcb69e5f703`；它只在本地 `dist/`，GitHub 源码同步**不包含**该 ZIP。源码构建得到的新产物须重新计算哈希，不能沿用该值。

目前本仓只实现扩展形状、失败关闭入口和本地契约测试；[`adapters.py`](../integrations/relay/metriccanvas_authoring/src/metriccanvas_relay_authoring/adapters.py) 故意尚未接真实 Relay。真实 DS、Relay、Java、身份和程序通道联调未运行，也未验证页面已显示。接线步骤及脱敏回传要求见[扩展说明](../integrations/relay/metriccanvas_authoring/README.md)和[内部验证材料](../metriccanvas-authoring/INTERNAL-VALIDATION-0.3.1.md)。
