# 本批路径与工作区保护

开工基线：main ea6e453e，存在约 738 条 status 记录及大量未跟踪的并行文件。本批在指定工作区叠加实施，不 reset/clean、不暂存/提交、不推送、不部署。共享执行、where/窗口、搜索和导出以开工时的最新文件为基线。

开工字节快照：`/tmp/metriccanvas-multi-query-baseline-20261014/`，保存 5846 个文件及 manifest；此目录只用于区分本轮叠加，不作为可发布资产。产品根的正文/术语/ADR/公开面是按明确文件编辑；原方案与 docs/plan/README 的其他工作保留。业务数据和凭据未写入证据。

[changed-paths.txt](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/multi-query-table/changed-paths.txt) 记录源文件和已比较的分发路径。`contracts/metriccanvas/` 是本批额外生成目录；包括该版本所有已批准能力的真源投影，保留开工已有的 customBlock、where、查询窗口、表格工具区等基线能力，没有回退到 HEAD 的旧协议。生成项不手工编辑。

曾在更新 Bundle 锁时并发启动隔离复制测试，得到旧锁与新字节混合的 stale 回执；冻结当前输入后的两项定点复测以及 19 项完整隔离检查均通过。此事实不代表真实 DQE 或 CI 验收。

根 `git diff --check` 检出了分发校验器/参考中已有的生成空白模式；未手改生成副本。产品类型、契约摘要、独立安装和行为测试单独记录。
