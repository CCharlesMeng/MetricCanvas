# 创作评测入口与证据边界

当前入口为 platform protocol 2.0，注册九个工具，使用工作稿与精确产物引用。旧候选流程的 runner 已删除，历史结果不作为当前平台验收。

| 目的 | 入口 | 证据范围 |
|---|---|---|
| 无凭据核对工具与 Schema | `preflight.py --surface unified-content --output <new-file>` | 当前平台注册及分发配置，不调用模型 |
| 本地确定性回归 | `../run_tests.py` | 现行结构、参数、工作稿、单次保存、失败恢复及模拟适配器 |
| 结构装配样例 | `run_structure_acceptance.py --output <new-directory>` | 直接调用现行结构用例，不属于自主模型或公共 MCP 评测 |
| 真实模型与本地夹具 | `run_platform_v2.py --output <new-directory>` | 会读取平台环境中的模型配置并调用真实模型；Java、Relay 和数据仍是本地替身 |
| 历史证据检查 | `eval_evidence.py` | 保留原评分与 hash，退役候选协议不能计为当前通过 |

从仓库根目录运行，Python 环境使用 `tool/.venv/bin/python`，导入路径包含 `tool`、`test-harness`、`test-harness/tests` 和本目录。输出路径必须全新。

真实模型运行与无凭据检查分开执行。`run_platform_v2.py` 当前只覆盖一个区域运营报告场景，不代表七类任务的完整质量门禁；参数端到端行为由本地参数回归覆盖。此次迁移不需要运行真实模型或浏览器。

只有 `modelSummary` 进入模型消息；有界查询证据须经过计划确认和数据策略授权。完整页面、预览、参数模板与实例留在程序通道。参数模块的依赖未注入时返回明确不可用。

`history/`、`evidence/` 和冻结 case/protocol 文件保留原始历史语义。历史五工具、candidate_ref、旧 Skill 与授权稿只说明当时的实验；不能据此调用已删除的 runner，也不能视为当前生产授权或验收。需要复现实验时使用对应 Git 历史版本。

真实 Relay 身份注入、Java 权限与保存回执、前端消费及自主模型质量均需单独证据。本地测试通过不等于生产联调通过。
