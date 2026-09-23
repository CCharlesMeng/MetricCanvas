# 平台页面创作与 Relay 的接入隔离

状态：接入交接说明，依据本仓 Bundle 0.3.1 的[正式协议](../metriccanvas-authoring/contracts/authored/platform-v2-protocol.md)、[Relay 交接](../metriccanvas-authoring/RELAY-HANDOFF.md)和[内部验证材料](../metriccanvas-authoring/INTERNAL-VALIDATION-0.3.1.md)。本地未取得真实 Relay 仓库；下文只把已核对的 `.relay/mcp_configs/`、`.skills/` 约定写成确定目录，Relay 插件源码位置必须在目标仓核对后落位。本说明位于 Bundle 外，不改变 0.3.1 发行包与哈希。

## 哪些文件可原样使用

| 文件或目录 | Relay 的用法 | 当前限制 |
|---|---|---|
| `metriccanvas-authoring/dist/metriccanvas-authoring-0.3.1-deployment.zip` | 交付容器：整体 SHA-256 为 `090d8f23b0ed43ee19976c4b7762dfb647eca4c3a0cae18d423bbdcb69e5f703`；解包后运行 `shasum -a 256 -c SHA256SUMS` 和 `python3 scripts/check_bundle.py`。 | **仅本地有文件**。`dist/` 被 Git 忽略，推送本仓 `main` 不会把 ZIP、wheel 或 sdist 同步到 Relay；须传递固定包或在指定提交上重新构建。 |
| ZIP 内 `metriccanvas_authoring-0.3.1-py3-none-any.whl` **或** `metriccanvas_authoring-0.3.1.tar.gz` | 在 Relay 部署使用的 Python ≥3.12 环境安装其中一种；安装后调用包内 Python API。页面及创作契约快照已内嵌在分发包中，不需手工复制 Python 源码或运行时 JSON。 | 包的默认 `metriccanvas-platform-content` 入口缺可信提供方会失败关闭；安装成功不等于业务可用。 |
| ZIP 内完整 `skill/metriccanvas-platform-authoring/` | 将整个目录原样安装为 `.skills/metriccanvas-platform-authoring/`，保留 `SKILL.md`、`workflows/` 和全部 `references/`；它声明九个工具及 MCP server 名 `metriccanvas-platform-content`。 | Skill 不能替 Relay 生成可信轮次、用户身份、确认或产物接收回执。 |
| ZIP 内 `bundle.json`、`bundle.lock.json`、`contract-lock.json`、`contracts/`、`contract-snapshot/`、`SHA256SUMS` | 作为**只读版本与接口校验材料**使用；可运行随包 `scripts/check_bundle.py`。需要核对的核心文本是 `contracts/authored/platform-v2-protocol.md`，轮次形状见 `contracts/authored/authoring-turn.schema.json`。 | 这些文件不是 Relay 插件代码；不能只把 Schema 复制过去就宣称接线完成。 |
| ZIP 内 `INTERNAL-VALIDATION-0.3.1.md` | 直接交给内部实施者，执行其中的验证向量和脱敏回传。 | 它是测试说明，不提供任何生产身份或回执。 |

可复制的起点有 [`examples/platform-oneshot-host.py`](../metriccanvas-authoring/examples/platform-oneshot-host.py)，但**不能原样作为生产入口使用**：它需要 Relay/内部模块提供 `create_host_adapters()`，并配置稳定工作数据库及真实 Java 地址。仓内 [`relay/mcp_configs/metriccanvas-authoring.json`](../metriccanvas-authoring/relay/mcp_configs/metriccanvas-authoring.json) 则是普通问数的 `metriccanvas-authoring` 入口示例，**不是**九工具平台创作配置；不得改名后直接宣称平台接线完成。

## 修改应落在哪一侧

| 所有权 | 修改位置 | 内容 |
|---|---|---|
| 本仓真源 | `metriccanvas-authoring/tool/`、`contracts/authored/`、`skill/metriccanvas-platform-authoring/`、`examples/platform-oneshot-host.py` | 九工具、确定性创作、Port/Adapter 接口、正式协议、Skill 和**无内部凭据的**包外装配模板。契约快照与锁文件只经生成器更新。 |
| Relay 部署配置 | Relay 部署根目录的 `.relay/mcp_configs/` | 为平台创作**单独**登记 `metriccanvas-platform-content` 的 MCP stdio 入口，指向固定版本的包外入口脚本，配置调用专属环境和稳定工作存储路径。先核对 Relay 当前配置加载规则，再确定具体 JSON 文件名。 |
| Relay Skill 安装 | Relay 部署根目录的 `.skills/metriccanvas-platform-authoring/` | 按同一 Bundle 版本安装整个 Skill 目录及 references。既有 `.skills/metriccanvas-page-builder/` 和普通问数入口保留各自用途。 |
| 内部接线代码 | **Relay 仓库现有插件/集成扩展根下**独立的 MetricCanvas 目录；推荐形状为 `<Relay 插件根>/metriccanvas_authoring/` | 保存从[包外入口模板](../metriccanvas-authoring/examples/platform-oneshot-host.py)复制并审定的入口，以及内部 `create_host_adapters()` 实现。`<Relay 插件根>` 是待实仓确认的占位符，不声称 Relay 已有此目录。若仓库惯例不允许插件源码，入口与 Adapter 可置于部署侧独立包，由 Relay 现有配置启动。 |
| 运行期状态 | 部署方管理的持久化数据目录，**不放在源码或 Skill 目录** | `METRICCANVAS_WORK_DB` 对同轮每次 oneshot 调用稳定可达、权限隔离；升级包或重启子进程不得删除未知保存核对记录。跨节点迁移与故障恢复另行设计。 |

Relay 平台配置需指向其审定后的包外入口；随包默认 `metriccanvas-platform-content` 未装配时会失败关闭。`METRICCANVAS_PROTOCOL_DISCOVERY=1` 仅供协议发现。

## 哪些由 Relay 独立维护

Relay 侧拥有 `.relay/mcp_configs/` 中平台 MCP 的注册与部署配置，以及现有插件根下的 `metriccanvas_authoring/` 内部 Adapter 和入口。具体插件根目录须由 Relay 仓源码确认。该目录可以独立改动内部 API 调用、调用专属身份映射、当前轮次读取、用户确认记录读取、DQE/数据上下文连接、Java 凭据及 `relay_preview` 程序通道；还要维护部署路由、持久工作数据库路径和内部契约测试。凭据和用户数据不进入本仓 Bundle。

本仓继续独立维护九工具的确定性业务行为、Python Port 形状、页面及结果字段契约、Skill、正式协议和生成器。Relay 如果只调整内部系统的 URL、鉴权、存储部署或产物通道，在既有 Port 行为内可独立发布 Adapter 修订；一旦要改工具输入输出、binding/确认语义、页面契约、错误码或保存/交接结果，就必须先在本仓更新协议与版本并同步验证，不能在 Relay 单方改出第二套协议。

## 接线边界

内部 `create_host_adapters()` 每次调用提供 `current_turns`、`analysis_authorization`、`lifecycle_identities`、`relay_preview`、受治理的 `data_context` 与 `dqe`。包外入口复用本仓 `SqlitePlatformState`、`KnownLifecycleHttp`；`source_description` 和参数依赖按需装配。相同用户指令的调用沿用同一个可信 binding、创作基线和工作存储。确认必须绑定该 binding、精确取数请求及数据上下文版本；模型参数不能提供身份或自行授权。

Relay 若不保留 MCP `structuredContent`，内部 `relay_preview.prepare` 须通过现有插件允许的程序通道接收 `{binding,operationId,artifactRef,ref,document,previewJson}`，仅在精确接收后回执匹配的 `artifactRef/ref`。`ready` 表示 Adapter 接收，不表示前端已显示。产物不能通过模型文本或子进程环境变量向父进程回传；并发身份不能靠修改 Relay 主进程共享 `os.environ` 传递。未知保存停止自动重发并保留核对记录。

先运行公共 `platform_readiness` 核对提供方装配，再用真实 contextRef 运行 `current_turn_readiness`；前者不要求启动时已有用户轮次。连接、Java 条件保存、DQE 权限与程序通道仍需内部逐项验证。若 Relay 现有插件扩展点无法安全注入调用上下文或接收完整产物，应回传具体缺口供决策，不能绕过边界修改 Relay 核心。

## 后续如何同步

**本仓提交不会自动进入 Relay 仓库。** 本仓保持 Tool、Skill、协议和生成器的唯一真源；Relay 安装固定版本的 wheel/sdist 与整份 Skill，按 ZIP 和逐文件 SHA-256 验签，然后更新其部署配置。Relay 特有 Adapter 和可信上下文映射留在 Relay 插件/部署仓，由内部维护。不要复制本仓 `tool/metriccanvas_authoring/` 源码到 Relay 后分别修改两份，也不要反向把内部凭据或插件实现并回本仓。

以后可以做**受控的单向自动同步**：本仓 CI 生成带版本、哈希和契约锁的发布物；Relay 的依赖更新流水线固定版本、校验哈希、安装产物，运行公共契约向量和内部最小主流程，再更新部署引用。每次升级都明确记录 Bundle 版本与内部 Adapter 修订，旧运行记录不因代码同步自动迁移。若希望把 Relay Adapter 本身也迁到本仓或做 Git 源码镜像，需先确认 Relay 仓源码布局、凭据边界和双方所有权；当前 0.3.1 接入契约没有授权这种双向源码同步。

## 靠什么标准保证兼容

1. **版本与完整性**：锁定 `bundleVersion=0.3.1`、平台工具协议 `platformProtocolVersion=2.0`、可信轮次接口 `authoring-turn/1.0` 和页面 Schema `6.11`；逐文件哈希由 `SHA256SUMS`、`bundle.lock.json`、`contract-lock.json` 校验。它们证明文件与约定版本一致，不证明 Relay 内部实现正确。
2. **机器可核对接口**：FastMCP stdio 实际公布的九个工具名称和输入 Schema，与 Skill 的 `allowed-tools`、`metadata.mcp_servers` 一致；`authoring-turn.schema.json`、页面/编辑请求 Schema 和正式平台协议约束数据形状与错误语义。安装包内嵌运行时契约；本仓的测试核对注册结果及包外安装。
3. **行为契约**：`platform-v2-protocol.md` 规定可信 binding、精确请求与版本授权、同轮跨进程状态/CAS、单次条件保存、未知保存停止重发、产物的精确接收回执；[内部验证材料](../metriccanvas-authoring/INTERNAL-VALIDATION-0.3.1.md) 给出正反向量。Relay 的 Adapter 必须在真实身份、Java、DQE、程序通道下跑过这些向量，才能宣称接线可运行。

因此“文件可直接安装”与“集成已经通过”是两件事：0.3.1 只完成本仓和本地替身验证，真实 Relay Adapter、连接与产物交接仍待内部执行并回传。2026-09-23 的 `main` [CI 运行 35836308183](https://github.com/CCharlesMeng/MetricCanvas/actions/runs/35836308183) 因既有工作台 `480px` 断言失败，上传创作 Bundle 的步骤未执行；不能把 Git 推送当作发行包已发布。

内部具体测试向量和脱敏回传格式见[内部验证材料](../metriccanvas-authoring/INTERNAL-VALIDATION-0.3.1.md)。在收到真实 Relay 仓目录树前，本说明不指定其插件源码的虚构绝对路径，也不宣称内部联调已经通过。
