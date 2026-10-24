# Relay 接入：MC 交付复验

日期：2026-10-24。MC 源码固定为 `edab0baa9521ad3c6f6ab5b21c00e084c05a1f38`。本轮已完成 MC 交付准备；本机没有报告中的 Windows Relay 源码或远程连接，Relay 程序修改与部署验收均为 not_run。[Windows 执行任务书](../../plan/2026-10-24-layout-standards/relay-integration-execution.md)已准备。

## 交付物与身份

| 交付物 | 身份 |
|---|---|
| MC 内容 | `1-ebf417635014c58b`；1754 个清单保护文件，另有版本清单 |
| MC 内容 SHA256 | `ebf417635014c58bbfa4d967e2eaf9da543ce72f7ac98593deef949595da43a5` |
| MC 独立归档 | `mc-content-main-edab0baa.tar.gz`；SHA256 `7ce0f35dc9209a2a2488b47c5bb5fc65ff9a4861b464203360ca63e5e744d869` |
| 公有 authoring 归档 | `metriccanvas-authoring-public-edab0baa.tar.gz`；SHA256 `6d9fd5b4fb55865ec4babf5b44dd011c47945df197898ee9aa7367488ad819d7` |
| 公有 bundle.lock SHA256 | `1143d20aa7e09f3463f96b44ff470c05f9b978797c3ce54fd56922f09e4b2c45` |

MC 独立归档来自已验证的 [CI 产物](https://github.com/CCharlesMeng/MetricCanvas/actions/runs/40080278690/artifacts/12555266075)，与本地固定提交归档逐字节一致。公有 authoring 归档使用现有 sync_upstream.snapshot 从固定 Git 提交提取清单文件，4517 个文件（含 bundle.lock），内部 Adapter 不入归档。归档附各自 release.json；它们是两个交付物，完整公有源码不等于 MC 独立运行包。

## 本轮实际复验

环境：macOS，Python 3.14.7，Node v24.11.1。MC 使用独立最小 Python 环境，仅有 jsonschema 4.26.0，fastmcp 不存在。公共平台注册探查另用声明的完整构建依赖环境。

| 检查 | 结果 |
|---|---|
| 新目录解包、verify 与 version | 通过，内容及归档摘要匹配固定交付 |
| layout/catalog、layout/template.schema | 通过，均可由当前 index 查询 |
| knowledge/table.width | 通过，完整原子在预算内返回 |
| protocol/discovery-query、scenario/business-report、runtime/delivery | 通过，当前包已经提供报告中基于旧包标缺的内容 |
| 完整 compose_page inputSchema | 通过，显式预算内返回完整外层参数 |
| 独立程序样例 compile/inspect/correlation | 通过，三个状态分别为 ok/ok/checked；仅合成程序关联，不是身份或保存验真 |
| 旧 chart-filter 输入 dry-run、写入新目录、目标可读 | 通过，5 项迁移，输入和 original 副本字节不变 |
| 公共 FastMCP 注册与 MC 工具契约 | 通过，9 个工具的完整 inputSchema 逐项相等，COMPOSE_SCHEMA 与 MC 快照相等 |
| 完整公有归档暂存与仓外解包 | 两次 check_bundle 通过，每次 5692 项摘要检查 |

原始机器记录保留在本机 `/tmp/mc-relay-readiness.json`、`/tmp/mc-relay-public-contracts.json` 和 `/tmp/mc-relay-public-distribution.json`；实施材料包附可转交的回执副本。这里的安装、注册实验均不声称已在真实 Relay 服务运行。

## 本轮发现并修复的分发配置问题

实际下载 `metriccanvas-authoring-edab0baa9521ad3c6f6ab5b21c00e084c05a1f38` 的 CI 目录产物，运行随包 check_bundle 失败：`test-harness/model-evals/.gitignore: missing`。逐项对照固定 Git 快照，缺失的清单文件仅此一项；公共工具源码仍与 MC 契约一致。

上传步骤未包含隐藏文件。本轮 CI 修复：完整 authoring 上传保留隐藏文件；上传后使用 download-artifact 回读到新目录，运行随包 check_bundle，作为实际分发完整性检查。MC tar 的上传方式不变。本记录形成时新的远端下载回读验收为 not_run。修复随本轮交付提交，实际提交与远端验收按[接续交接](../../plan/2026-10-24-layout-standards/relay-delivery-handoff.md)核实，不能引用旧 CI 成功冒充修复后验收。

供 Relay 使用的公有归档独立从固定 Git 提交重建，保留原始隐藏文件并校验原 bundle.lock；未给损坏的下载目录重算或修改清单。内部 Adapter 和 Relay 本地扩展仍需按任务书逐项保留、迁移。

## 接入未关闭项

| 项 | 状态及责任 |
|---|---|
| Windows 安装当前 MC 包 | not_run；由可访问该环境的 Relay 执行者完成 |
| 实际 MCP/引擎身份与 6.11/6.54/6.58 差异 | not_run；需要运行中的服务和源码证据 |
| 结构化产物通道、原样 spec 及同轮多请求关联 | not_run；Relay 程序接缝实施 |
| subagent_tools 授权链、模型可见性、安装目录只读 | not_run；Relay 权限与部署验证 |
| ToolResponse、有界检查摘要、完整 Skill 串接 | not_run；Relay 包装与工作流实施 |
| 真实 DQE/权限、Java 保存、预览与标记注入 | not_run；专用测试环境验收 |

本轮仓内修改为 CI 配置与交接文档，未修改可执行 TypeScript/Python 函数或产品协议，函数复杂度测量不适用；既有复杂度记录及存量项见 [MC 实施测量](implementation-complexity.md)。未触碰主工作区并行修改；本轮提交及 push 已获用户授权，实际 Git/CI 结果以交付回执为准。
