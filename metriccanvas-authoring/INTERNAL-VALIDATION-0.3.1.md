# 平台创作 0.3.1 内部接线与回传

本批本仓验收到产物交接 Adapter 的精确接收回执。内部页面显示、卡片替换与发布不在本批结果内。正式输入输出及失败码见 [平台协议](contracts/authored/platform-v2-protocol.md)；[来源核查](../docs/evidence/2026-09-23-authoring-result-field-sources.md)记录无需额外字段服务的范围和仍需核对的字段。

## 安装与装配

1. 核对交付目录中的 `SHA256SUMS` 与签收的整体 ZIP SHA-256；使用同目录的 0.3.1 wheel 或 sdist，在仓库外新建 Python 3.12 环境安装。Skill、协议、快照和 Python 包按同一 ZIP 版本部署。
2. 将 `examples/platform-oneshot-host.py` 复制到包外入口位置。内部模块实现 `create_host_adapters()`，返回 `current_turns`、`analysis_authorization`、`lifecycle_identities`、`relay_preview`、`data_context`、`dqe`；可选 `source_description`、`parameter_dependencies`。可信身份、确认与交接回执必须由真实集成上下文提供。包外入口复用 `SqlitePlatformState` 与 `KnownLifecycleHttp`。
3. 配置 `METRICCANVAS_HOST_ADAPTER_MODULE`、稳定共享的 `METRICCANVAS_WORK_DB` 和真实 `METRICCANVAS_LIFECYCLE_COLLECTION_URL`。MCP 调用需要每次传入同轮相同 binding/创作基线，不能在每次 oneshot 调用生成新 turnId 或新数据库。数据库文件权限和部署路由由内部负责。
4. 使用 `bootstrap.readiness.platform_readiness` 检查一次性缺配列表；它只证明提供方装配，`current_turn_readiness` 用实际 contextRef 核验当前轮次。连接、Java 条件更新、DQE 权限和 Adapter 接收仍需独立实测。普通创建/编辑不要求参数能力。

在仓库外可复验发行包的最小命令（`WHEEL` 与 `RELEASE_DIR` 改为实际绝对路径）：

```sh
cd "$RELEASE_DIR"
shasum -a 256 -c SHA256SUMS
python3 scripts/check_bundle.py
uv venv --python 3.12 /tmp/metriccanvas-authoring-031-check
uv pip install --python /tmp/metriccanvas-authoring-031-check/bin/python "$WHEEL"
/tmp/metriccanvas-authoring-031-check/bin/python -c 'from metriccanvas_authoring.bootstrap.readiness import platform_readiness; from metriccanvas_authoring.runtime_assets import bundle_root; print(bundle_root())'
```

部署时让 Relay 以现有插件/配置调用包外入口；本仓不修改 Relay 核心。调用专属 env 映射可以给子进程传配置，父进程共享 `os.environ` 不承担并发身份，子进程 env 也不是向父进程回传完整产物的通道。若 Relay 丢弃 MCP `structuredContent`，内部须用现有程序通道接收 `{binding,operationId,artifactRef,ref,document,previewJson}`，并在接收成功后返回匹配 `artifactRef/ref` 的 `ready`。失败时保留已保存状态，单独报告交接失败。

## 内部最小验证向量

每条业务调用分别启动新 MCP 子进程，使用同一个可信 binding 和存储位置。记录每个用例的请求关联 ID、工具错误码、DQE 调用数、Java 保存数和 Adapter 接收数，不记录凭据、SQL、完整业务行或原始响应。

| 用例 | 操作和预期 |
|---|---|
| 装配与轮次 | 缺轮次提供方时静态 `deploymentReady=false`；已装配且尚无用户轮次时静态检查通过；错 contextRef/身份/页或已取消轮次在调用前拒绝 |
| 数据创建 | 精确确认范围和数据上下文版本后取数一次，结果字段契约匹配真实行键；创建保存一次，产物 `document` 与 `previewJson` 的查询定义一致；交接回执匹配精确引用 |
| 配置调整 | 从已保存页面建立新的创作轮次，只改用户授权字段；DQE 调用数为零，未触及内容精确相等 |
| 新增数据组件 | 原页面数据源和组件不变；只执行本轮获授权的新查询；单次条件保存 |
| 拒绝与竞争 | 授权请求/版本不匹配时 DQE 调用数为零；Java 当前修订过期时保存数为零；工作版本或 SQLite CAS 竞争仅一方成功 |
| 行与字段 | 公式 null、按月时间列、别名/重名、21 行之后的坏值、空结果、金额/百分比尺度未知分别按正式协议处理；未知尺度不转换 |
| 保存与交接失败 | 未知保存不自动重发且冻结提交保留；已保存而交接失败不再取数或保存，重试仅针对相同 artifactRef |

上述用例在本地 HTTP 替身及脚本化 runner 已有基础轨迹；内部必须在真实身份、Java、DQE 和程序通道下执行并回传。真实 DS 模型、浏览器及内部前端不属于本批轻量验收。

## 脱敏回传模板

```json
{
  "bundleVersion": "0.3.1",
  "releaseZipSha256": "<收到的 ZIP 哈希>",
  "installedArtifactSha256": "<wheel 或 sdist 哈希>",
  "adapterRevision": "<内部版本或变更号>",
  "environment": "<脱敏环境标识>",
  "providerAssembly": {"status": "pass|fail", "missing": []},
  "currentTurn": {"status": "pass|fail", "failureCode": null},
  "cases": [
    {
      "id": "<上表用例>",
      "status": "pass|fail|blocked|not-run",
      "reasonCode": null,
      "correlationId": "<脱敏 ID>",
      "dataContextVersion": "<可公开版本摘要>",
      "queryCount": 0,
      "saveCount": 0,
      "handoffCount": 0,
      "artifactRefDigest": "<摘要，不填产物正文>",
      "observedCodes": [],
      "sanitizedEvidencePath": "<脱敏日志或报告路径>"
    }
  ],
  "unresolvedFieldFacts": [
    {"queryShape": "<脱敏查询形态>", "expectedField": "<字段名>", "actualField": "<列键>", "scaleFact": "<有来源的尺度或 unknown>"}
  ]
}
```

回传请省略 token、Cookie、物理 SQL、完整页面和原始业务行；保留足够的字段名、类型、版本、计数和稳定错误码以定位失败。内部结果尚未回传时，本仓报告为“本仓完成，待内部接线/验证”。
