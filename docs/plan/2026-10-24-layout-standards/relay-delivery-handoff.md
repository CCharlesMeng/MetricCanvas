# MC → Relay 接续交接

日期：2026-10-24。接续工作目录：`/Users/moon/.codex/worktrees/mc-content-layout/DataDashboard`。本轮用户已授权将分发修复与交接文档提交并推送 main；真实 Relay 的提交、push 和生产发布仍按其执行任务书另行处理。

## 阅读与核对顺序

1. 读取执行仓 AGENTS.md，核实 Git HEAD、origin/main、dirty 清单及实际服务路径，保留并行修改。本机主检出和其他工作树不属于本轮交付范围。
2. 读取本文，再读 [Relay 实施任务书](relay-integration-execution.md) 和 [交付复验](../../evidence/mc-content-layout/relay-readiness.md)。在 Windows Relay 环境按任务书顺序实施，以每节完成条件收口。
3. 仅在需要追溯 MC 内容范围时读 [完整性主计划](mc-content-completeness-plan.md) 第 11 节、[实施验收](../../evidence/mc-content-layout/implementation-results.md) 和 [复杂度记录](../../evidence/mc-content-layout/implementation-complexity.md)。原 implementation-handoff 前 6 节是实施起点，不能用其中的历史缺口覆盖当前结论。

## 当前交付状态

| 层次 | 已完成 | 接续判断 |
|---|---|---|
| MC 内容补全 | W1–W6、本仓 G01–G16 按实施验收逐项收口；旧页、迁移、产品引擎回放及 local-authoring 独立安装已验 | 不重复补发旧 387 文件包中缺失、当前已存在的内容 |
| main 基线 | `edab0baa9521ad3c6f6ab5b21c00e084c05a1f38`；[完整 CI 通过](https://github.com/CCharlesMeng/MetricCanvas/actions/runs/40080278690) | 这是本轮 CI 修复之前的基线，不能证明新下载检查已通过 |
| 本轮修复 | authoring 上传保留隐藏文件，上传后下载到新目录并运行随包 check_bundle | 本文随修复提交；用包含本文的 Git 提交 SHA 查远端和完整 CI，不用旧绿色结果替代 |
| MC 复验与交付准备 | 最小依赖独立运行、9 个公共工具契约逐项对账、完整公有归档两次摘要检查通过 | [交付复验](../../evidence/mc-content-layout/relay-readiness.md)列明环境、归档身份和原始记录 |
| 真实 Relay | 未执行；本机没有 Windows 源码或远程连接 | 需要可访问执行环境的 Relay 执行者继续，不声称程序接缝、权限或部署已完成 |

## 分发修复为何必要

基线 CI 的完整 authoring 目录产物漏传清单内的 `test-harness/model-evals/.gitignore`，实际下载后 check_bundle 失败；此前 CI 的源目录检查未覆盖上传后的文件。本轮在现有上传步骤加 `include-hidden-files: true`，随后使用同名 download-artifact 回读并检查。MC 独立 tar 未受影响。

本轮仅改 CI YAML 与交接 Markdown，不改产品 Schema、MC 内容、公共工具实现、Skill 规则或摘要清单。未新增或修改 TypeScript/Python 函数，函数复杂度不适用。复用同输入的 MC 验收，并检查 YAML 步骤顺序、条件、路径和文档链接；远端下载完整性必须由本次提交的 CI 新步骤实证。

## 固定内容与转交材料

- MC：`contentVersion=1-ebf417635014c58b`，`contentSha256=ebf417635014c58bbfa4d967e2eaf9da543ce72f7ac98593deef949595da43a5`，1754 个受清单保护文件，另有版本清单；Schema 6.58 / platformProtocol 2.0 / authoring 0.3.1。
- 配套公共源码固定在上述 edab0baa 基线；本轮仅 CI/文档变更，不要求更改内容版本。两个归档及 bundle.lock 的完整摘要见交付复验，必须逐一核验，不能对损坏产物重算清单。
- 本机材料：`/tmp/mc-content-main-edab0baa.tar.gz`、`/tmp/metriccanvas-authoring-public-edab0baa.tar.gz`，各附 release.json。临时路径不是长期下载地址；MC 的固定 CI 下载链接见任务书。完整 authoring 优先使用本轮修复提交的 CI 产物，并运行随包 check_bundle。
- `/tmp/relay-mc-integration-edab0baa-ready.zip` 是已校验的准备期转交包，包含两份归档、任务书及回执；其中文档身份标记为工作树准备态，不含后续 Git/CI 回执。需要转交最新说明时使用已提交的本文及任务书，不将准备期标记冒充已部署。

## 接续执行与验收

MC Git 交付：从本工作树按 scoped-main-delivery 显式暂存本批文件，推送 HEAD:main 后核实远端，执行 `node tools/scripts/wait-ci.mjs <完整提交SHA>`。确认全部 CI job 通过，且 authoring 的下载和随包校验两步成功；实际下载后的完整 Bundle 应有隐藏清单文件并通过 5692 项摘要检查。若远端前进，fetch 后核实差异，不 force push。提交和 CI 的实际回执以 Git、Actions 和本次交付回复为准。

Relay 接续：报告定位 `D:\PythonWorkspace\CDIRelayAgentService-1`、分支 `feature_2026090792115_build_metadata`、探查 HEAD `31d0901bd9ea05e361030b57b921d4477b4b8898`，进入后重新核实。先安装当前包并对齐公共实现、引擎和本地扩展，再实现可信产物与原样 spec 通道、精确请求关联、实际执行授权与有界 ToolResponse；最后执行任务书全部验收矩阵，保留 passed/failed/not_run。

真实 DQE/权限、Java 保存、预览卡片/标记注入、包重载和执行账户只读权限仍需实际环境验收。MC 提供技术事实、确定性实现和检查结论，Skill 保留采用及流程决定；不新增保存准入，不因预览失败重复保存。检查 1 秒/迁移 2 秒仍是候选预算，尚非 SLA；真实 DS 模型专项不在本轮默认范围。

收口保留本工作树供 Relay 接续和本地证据复查；本任务未创建分支，不清理其他任务的工作树或主检出。
