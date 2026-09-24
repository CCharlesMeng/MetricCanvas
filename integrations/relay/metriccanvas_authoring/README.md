# Relay 页面创作扩展

这是 **DataDashboard 本仓内留给 Relay 独立维护的目录**。它不在 `metriccanvas-authoring/` Bundle 中；同步通用包时保留本目录。当前版本 `0.1.0` 是接线骨架，未接真实 Relay。

## 维护文件

| 路径 | 用途 |
|---|---|
| `src/metriccanvas_relay_authoring/adapters.py` 及同目录新增文件 | Relay 专用可信上下文、数据上下文、DQE、页面仓储和预览接收 Adapter；主要修改处。 |
| `src/metriccanvas_relay_authoring/host.py` | `HostAdapters` 的 `relay-authoring/1.0` 接口、默认 SQLite/Java Adapter 装配及公共就绪检查。改变它需同步更新本目录测试和版本。 |
| `src/metriccanvas_relay_authoring/entrypoint.py` | oneshot MCP stdio 启动和脱敏启动错误。 |
| `mcp_configs/metriccanvas-platform-content.json` | Relay 部署配置样例，服务名必须匹配 Skill 的 `metriccanvas-platform-content`。 |
| `tests/test_extension.py` | 独立扩展契约检查，不调用内部服务。 |

## 接入步骤

在固定 Git 提交的仓库根目录，使用 Python ≥3.12 的隔离环境：

```sh
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python ./metriccanvas-authoring/tool ./integrations/relay/metriccanvas_authoring
uv pip check --python .venv/bin/python
.venv/bin/python -m unittest discover -s integrations/relay/metriccanvas_authoring/tests -p 'test_*.py'
```

将同提交的 `metriccanvas-authoring/skill/metriccanvas-platform-authoring/` 整目录安装到 Relay 的 `.skills/metriccanvas-platform-authoring/`，并按 `mcp_configs/metriccanvas-platform-content.json` 登记九工具 MCP。真实部署配置必须提供稳定的 `METRICCANVAS_WORK_DB` 和 `METRICCANVAS_LIFECYCLE_COLLECTION_URL`，或在 `HostAdapters` 中注入符合对应 Port 的存储和页面仓储；部署方还须配置调用专属可信上下文、鉴权和内部地址。配置样例不包含凭据。

实现 `adapters.py:create_host_adapters()`，每次 oneshot 启动时返回 `HostAdapters(interface_version='relay-authoring/1.0', ...)`：

- `current_turns` 从 Relay 可信调用上下文读取同轮稳定的 binding、基线和确认范围；不能由模型参数自行声明。
- `analysis_authorization` 核对精确 binding、请求摘要和数据上下文版本；`lifecycle_identities` 获取调用专属已认证身份。
- `data_context` 和 `dqe` 使用内部受治理连接；`relay_preview` 通过程序通道接收完整页面产物并返回匹配的 `artifactRef/ref`。
- `store` 如自行实现，须提供跨同轮 oneshot 调用可读的 `read`/`compare_and_swap`；不得在退出时删除未知保存核对记录。
- `source_description`、`parameter_dependencies` 可选；本批主流程不依赖参数配置。

`relay_preview.prepare` 接收包含 `binding`、`operationId`、`artifactRef`、`ref`、`document` 和 `previewJson` 的完整产物。只在程序通道精确接收后回执匹配的 `artifactRef/ref`；`ready` 只表示 Adapter 已接收，不表示前端已经显示。未知保存必须停止自动重发并保留核对记录。

服务启动只检查提供方装配，不要求那时已有用户轮次。内部接线后以真实 `contextRef` 调用通用 `current_turn_readiness`，并运行 [`INTERNAL-VALIDATION-0.3.1.md`](../../../metriccanvas-authoring/INTERNAL-VALIDATION-0.3.1.md) 的向量。扩展目录的本地替身测试不代表真实 Relay/Java/DQE 联调通过。

本目录可随本仓 GitHub 源码直接同步，但通用包 `0.3.1`、平台协议 `2.0` 与接口版本 `relay-authoring/1.0` 必须相容。通用包升级时先运行本目录测试及内部最小主流程，再更新这里的依赖固定版本。详情见[隔离说明](../../../docs/relay-authoring-isolation.md)。
