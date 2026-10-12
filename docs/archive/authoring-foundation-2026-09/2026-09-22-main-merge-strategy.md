# 当前分支差异说明与 main 合并策略

日期：2026-09-22。只读审计后制定策略；本轮未创建提交、未重置索引、未推送。

## 比较基线

- 当前分支 `codex/grouped-page-params`，HEAD `0d3b3453`。
- 本地 main 为 `b843e1e7`，本地记录的 origin/main 与 MERGE_HEAD 都为 `20213dd9`。没有联网 fetch，远端是否新增提交需在提交前确认。
- HEAD 比本地 main 多 6 个提交，但相对 origin/main 是本分支独有 44 个、远端独有 7 个。当前进行中的 merge 正在吸收后者。
- 未合并索引条目为零，MERGE_HEAD 仍存在。索引和工作树不是同一份最终结果：仅提交当前索引会遗漏本轮修复和新增迁移文件。

## 行数口径

统计的是 `git diff <base> --numstat`，不含未跟踪文件；rename 检测会将搬迁从整文件增删变为差量。它是当前最终树与基线之差，不是每轮编辑量累加。

| 比较范围 | 新增 | 删除 |
|---|---:|---:|
| 工作树 vs HEAD（识别搬迁） | 47,326 | 10,582 |
| 工作树 vs 本地 main（识别搬迁） | 78,709 | 181,398 |
| 工作树 vs origin/main（识别搬迁） | 159,631 | 183,123 |
| 工作树 vs origin/main（不识别搬迁） | 206,238 | 229,730 |

这说明 UI 的“20 万+/18 万-”受比较基线、搬迁识别与未跟踪文件口径影响；本次无法在单一 Git 口径下精确复现这一对数字。不能把它解释为本轮新增 20 万行业务逻辑。

以下按 origin/main 且识别搬迁统计：

| 部分 | 新增 | 删除 | 差异记录数 |
|---|---:|---:|---:|
| 契约与参考分发 | 41,017 | 173,063 | 885 |
| 文档与归档 | 103,095 | 880 | 592 |
| 创作源码与测试 | 4,996 | 5,576 | 233 |
| 业务页面 | 4,260 | 2,008 | 5 |
| DQE本地夹具 | 2,897 | 40 | 7 |
| 运行时平台及其他 | 1,869 | 1,022 | 52 |
| 页面协议 | 1,497 | 534 | 37 |

未跟踪文件在此次盘点合计 3,885 行，其中 3,393 行是必须提交的 Python 迁移目标。上述统计发生在本策略文件创建前，后续文档编辑会产生少量变化。

## 各部分是什么

1. 契约与参考分发：`contracts/metriccanvas/`、`metriccanvas-authoring/contract-snapshot/`、`metriccanvas-authoring/skill/` 中的派生参考及 lock。Schema、conformance、示例和索引会多处投影。反例由整页改成触发点片段，重复错误按 type/message 聚合，机读索引停止重复完整结构；所以删行远大于加行。完整反例仍保留于 conformance，不能以减少 PR 行数为由删除离线 Bundle 副本。
2. 文档与归档：docs/plan、docs/evidence、docs/archive 分层，ADR 索引/主题与冻结历史参考。仅 docs/archive 就显示 +93,631 行，其中包含搬迁以及旧参考冻结副本；单个冻结 index.json 为 10,559 行。这是历史追溯材料，不是新增运行逻辑，也不能将旧测试证据当成本轮验收。
3. 创作架构：平台 v2 单工作稿、独立取数和工具内保存；bootstrap/entrypoints/adapters 按边界归位；application/domain 分散职责迁入 data/pages/work/assets。此次续跑把结构计划 v1/v2/v3 收成同一个维护源，将 page_validation/grouped_params 迁入 pages/validation，并保留新架构“不构造临时整页再拆取”的行为。
4. 页面协议与运行时：分层参数、时间整段引用与窗口、层级筛选逐级查询字段、非维度筛选目标、查询分页排序/表头筛选、页内详情浮层、initialParam 扩展和百万格式。前面多数已在 44 个既有提交中，本轮主要修复 merge 接口错配，统一到当前 6.11 写法及 6.5/5.x 兼容边界。
5. 业务页面与本地数据：四张 IOC 页面接入受控查询，补齐维度候选与 DQE Sim 数据集；这是本分支已有成果，不是此次续跑新编造的数据或生产验真。
6. 工作台与参数消费：参数提取/填值/预览/实例与发布契约、运行时内嵌初始行失效规则及消费者测试。安全边界是模板不变、执行副本解析、显式输入不被历史值代替。

## 必须一起提交与默认排除

必须纳入所有迁移目标：data/{metric_relations,structure_query_cache}.py；pages/components/{section_presentation,structure_presentation}.py；pages/composition/{structure_diagnostics,structure_preflight,structure_scope}.py；pages/editing/structure_revision.py；pages/parameters/ 两个实现及 __init__.py；pages/validation/ 两个实现及 __init__.py。旧路径删除、所有消费者导入修订、对应测试、派生产物及锁必须同步。

本轮新建的续跑记录和本策略纳入审计文档。旧的 structure-plan-convergence.md 仍写“等待裁决”，提交前应改为已按现行方向实施的历史对比，避免同时存在互斥状态。

默认不纳入 `ioc-data-dev/ADS开发说明.md` 和 `packages/embed/single-option-check.mjs`：前者是另一套数据开发体系说明，后者是硬编码本地预览地址的临时检查脚本，没有证据表明属于本轮交付。保留文件，不删除，不使用 git add -A。

`.github/workflows/ci.yml` 对 HEAD 显示删除 compatibility job，但对 origin/main 没有差异：这是合并来的远端状态，不能把它描述为本轮为了过测删 CI。仍需检查 main 的现有必需检查和缺失的兼容验证是否应独立补回。

## 推荐提交与 PR 顺序

### 1. 一次原子合并提交收口当前 merge

建议题目：`merge: integrate main with current authoring and parameter contracts`。

当前 merge 的源代码修复、测试和生成结果互相依赖，先收成一个完整可运行的合并提交，保留 HEAD 与 MERGE_HEAD 两个父提交。不要先提交旧索引，再把必需的新文件补在下个提交；也不要把原子合并强拆成若干中间坏树。此前 44 个提交已有主题拆分，保留其历史即可。

操作顺序：备份当前 tracked diff 与明确的新文件清单；核对纳入清单；重新生成契约；按清单暂存；核对 staged 中没有“旧文件删除但新文件遗漏”；核对测试对应的最终树与 staged 一致；最后创建 merge commit。现有 Git 索引写权限受审批服务影响，不假定助手已能执行。

### 2. 后续独立收尾提交

- `docs(authoring): close source and generated artifact provenance`：A11 来源矩阵、生成命令、离线分发必要性及片段化验收；已有片段化实现不重做。
- `test(authoring): classify harness by verification layer`：A12 按规则、适配器、交付、真实模型分层，同时改发现入口、导入、CI/脚本；不能只搬目录导致测试少跑。
- 必要的 gate 修复单列提交，只修实际失败；不降低断言或删除检查来换绿。

以上建议作为同一个整合 PR 的顺序提交。直接推 main、强推或全仓 squash 都不推荐。若必须拆 PR，需要从最新 origin/main 建干净分支按依赖重新挑提交并逐个生成/验收，成本明显高于保留现有历史。

### 3. 更新远端基线后创建面向 main 的 PR

提交前或推送前 `git fetch origin`，复核真实 main 是否前进；如前进则正常 merge 新 main，重新处理冲突、生成和回归。推送当前 codex 分支，PR base 明确为 main；PR 正文按本文件七类目录解释差异，生成物与文档归档列为可机械检查区域。

PR 应区分“本地实现闭合”和“真实外部接线未验收”。A11/A12 可以作为完成原实施计划的退出条件；真实部署联调是否是 main 合并门槛依赖仓库既有交付政策，不能将它伪报通过，也不擅自增加不存在的审批要求。

### 4. 合并条件

- 已暂存与最终工作树一致，未跟踪交付文件无遗漏；无冲突标记/未合并项。
- 全仓类型检查，契约导出 --check，Bundle 校验，diff --check。
- TS 完整测试恢复 HTTP 两文件共 14 项；Python 完整测试恢复端口相关 3 项。最近证据是 TS 1494 通过/1 跳过，Python 536 通过，但 17 项端口测试尚因沙箱被排除。
- 在能够启动本地服务的环境完成受影响的 embed/工作台浏览器验收、打包/安装检查；报告和 IOC 页面应人工可见地检查结构及布局，不能只靠 Schema。
- GitHub 必需检查在 PR 最新 SHA 上成功；确认保护规则允许后合入 main，再核验 main SHA 与 CI。建议 merge commit 保留分支及整合历史；若仓库只允许 squash/rebase，应遵守真实保护规则另选方式。

用户已授权执行策略。A11/A12 代码与文档已准备，构建、类型检查、打包、页面文档校验通过；具体测试边界见续跑记录。Git 写入和 fetch 所需的自动审批服务返回 HTTP 503，提交和 PR 尚未创建。远端 refs 仅来自本地缓存，尚未宣称最新远端或 CI 已通过。
