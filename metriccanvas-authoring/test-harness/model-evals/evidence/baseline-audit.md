# TB2 基线及来源核验（2026-09-15）

## 工作边界

执行 worktree `/private/tmp/metriccanvas-unified-evals-20260915`，分支 `codex/unified-authoring-evals`，起始 HEAD `9d4f4444efc43f47d039d882b141207b915c8e9e`，起始干净。写入仅 model-evals/** 和新 tests/test_model_eval_harness.py；未改 main、Skill 作者、生成器、bundle/锁、共享契约或旧 worktree。

依据正式 spec、implementation、architecture 及 S0/S1/TB2 slice 规划。实际现行内容 MCP 是 `discover_data_context / compose_page / create_content_page / edit_page`。主实现确认生产名单相同；无公开 latest/配置补读工具。配置摘要由本地 fixture 程序提供，不能证明生产只读补读/最新同步。

## 历史真实来源

旧分支 `codex/deepseek-platform-eval`，只读来源 `/Users/moon/.codex/worktrees/91c4/DataDashboard/metriccanvas-authoring/test-harness/model-evals`。历史 handoff baseline `39b587481a0e9ff3f97aa9b7ce8d2b49126d0a48`、product baseline `7f998ba8407fd0b988bb6252c05a30b5c80b7c08`，以原 provenance 为准，不与本次 HEAD 混淆。

`history/` 六文件逐字节拷贝保留。历史 runner 的实际 SHA256 为 `62d207fdeee5c80eb371fed18d687d7d6189548cd5471e94f8e8ff2b1bf8fda8`，等于历史运行 manifest 记录。原始证据仍在 `/private/tmp/metriccanvas-deepseek-eval-20260915`，163 个文件全部存在且与 provenance hash 相同；不复制其中完整页面/原始请求到 Git。

原 14 例成绩 6 pass / 3 fail / 5 blocked；13 例实际模型调用、34 请求（汇总复用 calibration 与 first-round，不是每例重复三次）。prompt 551,073、completion 7,179、total 558,252 token；API耗时累计71.120秒、用例耗时76.853秒。缓存输入510,720、非缓存输入40,353。费用 unknown。每个场景真实 Relay 路由均 blocked；历史 local pass 不能升级为平台端到端 pass。

请求 `deepseek-v4-flash`，响应 `deepseek-flash`；provider metadata 没有返回固定不可变模型修订。temperature=0/max_tokens=4096/thinking disabled，无重试。使用真实 HTTP 模型及生产 stdio 内容工具，本地可信 baseline，未配置 Data Context/DQE，无 Relay/Java/盘古。

## 三个误调用的原始证据

| 用例 | 工具与真实 query | 证据 |
|---|---|---|
| existing-add | discover_data_context: `platform authoring conventions dashboard baseline` | 原目录 existing-add 的 response/tool/result；原结果中 skillAllowedToolScope fail |
| switch-dashboard | discover_data_context: `dashboard layout baseline conventions for explicit page layout switch` | 原目录 switch-dashboard 的 response-1-0 / tool-1-0-1 / result |
| switch-report-backdrop | discover_data_context: `report layout baseline conventions for platform page editing` | 原目录 switch-report-backdrop 的 response-1-0 / tool-1-0-1 / result |

三例编辑产物本身符合历史产物断言；失败为用数据发现查文档。旧实际 prompt 只注入该 Skill 的 SKILL、references/platform-authoring、report/dashboard 两个布局参考。全工具集合暴露发现能力使误调可观察；不得归因于九万行目录被全部注入。历史评分器包含固定语义 REVIEW 字典，已归档，新的 scorer 要求逐样本 hash 绑定评审。

## 本轮交付与缺口

- 已冻结 9 例、每例3次；原误用全部保留、正例包含局部编辑/手工宽度多轮保持/数据创建；留出独立冻结，不供提示改写。
- 真实 runner 来自上述可追溯实现，新增不可覆盖输出、配置目标限制、注册工具名单校验、参数/源码/注入/依赖/原始 trace/usage/调用/耗时记录和停止门禁。
- 新 scorer 不含固定语义答案 pass：检查原始消息、工具轨迹、产物完整性与保持；审阅缺失或 hash 过期为 inconclusive。routing/latest另记blocked。
- 预检通过，0 模型请求。Python3.12.13 / fastmcp3.4.7 / httpx0.28.1 可用，四工具真实 stdio 注册确认；10项新门禁单测通过，CLI help通过、git diff --check通过。
- 自动审批拒绝向 DeepSeek 发送此次具体载荷；未执行网络请求，没有改路径绕过。108个计划样本全部blocked，usage/耗时/产物为null。具体授权稿附目的服务、样例、预算、停止条件和拒绝原文。
- 新 Skill 正在另一独立 worktree 提交，本分支未混入其未提交作者；统一注入源在本次 preflight 中缺失符合事实。集成最终提交后再预检/冻结哈希。
- 生产集合与全工具诊断相同，尚未进行任一新模型比较，不能宣称生产独立比较完成或工具集缩减改善。
- 真实数据创建、Relay路由、服务端latest、保存/发布/产物分流仍需要对应提供方环境；本地工具成功不能替代。新 runner 暂无 errors/examples 动态补读接线，当前声明未注入，缺参考不得用发现冒充。

## 集成

本提交只含独占范围，可 cherry-pick 到主实现；不需要重建生成器/锁。集成后跑 README 的10项测试和 preflight。旧/新比较应分别在固定基线（保留旧两个入口）与统一 Skill commit 上运行相同 runner和冻结suite，不把手工 Skill选择当路由验收。被拒真实请求必须等用户具体批准，不能作为合并本地设施的隐含条件。
