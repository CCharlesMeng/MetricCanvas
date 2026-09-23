# 平台页面创作与 Relay 的接入隔离

状态：接入交接说明，依据本仓 Bundle 0.3.1 的[正式协议](../metriccanvas-authoring/contracts/authored/platform-v2-protocol.md)、[Relay 交接](../metriccanvas-authoring/RELAY-HANDOFF.md)和[内部验证材料](../metriccanvas-authoring/INTERNAL-VALIDATION-0.3.1.md)。本地未取得真实 Relay 仓库；下文只把已核对的 `.relay/mcp_configs/`、`.skills/` 约定写成确定目录，Relay 插件源码位置必须在目标仓核对后落位。本说明位于 Bundle 外，不改变 0.3.1 发行包与哈希。

## 修改应落在哪一侧

| 所有权 | 修改位置 | 内容 |
|---|---|---|
| 本仓真源 | `metriccanvas-authoring/tool/`、`contracts/authored/`、`skill/metriccanvas-platform-authoring/`、`examples/platform-oneshot-host.py` | 九工具、确定性创作、Port/Adapter 接口、正式协议、Skill 和**无内部凭据的**包外装配模板。契约快照与锁文件只经生成器更新。 |
| Relay 部署配置 | Relay 部署根目录的 `.relay/mcp_configs/` | 为平台创作**单独**登记 `metriccanvas-platform-content` 的 MCP stdio 入口，指向固定版本的包外入口脚本，配置调用专属环境和稳定工作存储路径。先核对 Relay 当前配置加载规则，再确定具体 JSON 文件名。 |
| Relay Skill 安装 | Relay 部署根目录的 `.skills/metriccanvas-platform-authoring/` | 按同一 Bundle 版本安装整个 Skill 目录及 references。既有 `.skills/metriccanvas-page-builder/` 和普通问数入口保留各自用途。 |
| 内部接线代码 | **Relay 仓库现有插件/集成扩展根下**独立的 MetricCanvas 目录；推荐形状为 `<Relay 插件根>/metriccanvas_authoring/` | 保存从[包外入口模板](../metriccanvas-authoring/examples/platform-oneshot-host.py)复制并审定的入口，以及内部 `create_host_adapters()` 实现。`<Relay 插件根>` 是待实仓确认的占位符，不声称 Relay 已有此目录。若仓库惯例不允许插件源码，入口与 Adapter 可置于部署侧独立包，由 Relay 现有配置启动。 |
| 运行期状态 | 部署方管理的持久化数据目录，**不放在源码或 Skill 目录** | `METRICCANVAS_WORK_DB` 对同轮每次 oneshot 调用稳定可达、权限隔离；升级包或重启子进程不得删除未知保存核对记录。跨节点迁移与故障恢复另行设计。 |

仓内 [`relay/mcp_configs/metriccanvas-authoring.json`](../metriccanvas-authoring/relay/mcp_configs/metriccanvas-authoring.json) 是普通问数入口示例，运行 `metriccanvas-authoring`，**不是**九工具平台创作的现成生产配置。不能只复制它并改命令名；还需真实的可信轮次、授权、身份、DQE、保存和产物交接 Adapter。随包默认 `metriccanvas-platform-content` 未装配时会失败关闭；`METRICCANVAS_PROTOCOL_DISCOVERY=1` 仅供协议发现。

## 接线边界

内部 `create_host_adapters()` 每次调用提供 `current_turns`、`analysis_authorization`、`lifecycle_identities`、`relay_preview`、受治理的 `data_context` 与 `dqe`。包外入口复用本仓 `SqlitePlatformState`、`KnownLifecycleHttp`；`source_description` 和参数依赖按需装配。相同用户指令的调用沿用同一个可信 binding、创作基线和工作存储。确认必须绑定该 binding、精确取数请求及数据上下文版本；模型参数不能提供身份或自行授权。

Relay 若不保留 MCP `structuredContent`，内部 `relay_preview.prepare` 须通过现有插件允许的程序通道接收 `{binding,operationId,artifactRef,ref,document,previewJson}`，仅在精确接收后回执匹配的 `artifactRef/ref`。`ready` 表示 Adapter 接收，不表示前端已显示。产物不能通过模型文本或子进程环境变量向父进程回传；并发身份不能靠修改 Relay 主进程共享 `os.environ` 传递。未知保存停止自动重发并保留核对记录。

先运行公共 `platform_readiness` 核对提供方装配，再用真实 contextRef 运行 `current_turn_readiness`；前者不要求启动时已有用户轮次。连接、Java 条件保存、DQE 权限与程序通道仍需内部逐项验证。若 Relay 现有插件扩展点无法安全注入调用上下文或接收完整产物，应回传具体缺口供决策，不能绕过边界修改 Relay 核心。

## 后续如何同步

**本仓提交不会自动进入 Relay 仓库。** 本仓保持 Tool、Skill、协议和生成器的唯一真源；Relay 安装固定版本的 wheel/sdist 与整份 Skill，按 ZIP 和逐文件 SHA-256 验签，然后更新其部署配置。Relay 特有 Adapter 和可信上下文映射留在 Relay 插件/部署仓，由内部维护。不要复制本仓 `tool/metriccanvas_authoring/` 源码到 Relay 后分别修改两份，也不要反向把内部凭据或插件实现并回本仓。

以后可以做**受控的单向自动同步**：本仓 CI 生成带版本、哈希和契约锁的发布物；Relay 的依赖更新流水线固定版本、校验哈希、安装产物，运行公共契约向量和内部最小主流程，再更新部署引用。每次升级都明确记录 Bundle 版本与内部 Adapter 修订，旧运行记录不因代码同步自动迁移。若希望把 Relay Adapter 本身也迁到本仓或做 Git 源码镜像，需先确认 Relay 仓源码布局、凭据边界和双方所有权；当前 0.3.1 接入契约没有授权这种双向源码同步。

内部具体测试向量和脱敏回传格式见[内部验证材料](../metriccanvas-authoring/INTERNAL-VALIDATION-0.3.1.md)。在收到真实 Relay 仓目录树前，本说明不指定其插件源码的虚构绝对路径，也不宣称内部联调已经通过。
