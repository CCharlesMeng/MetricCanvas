# 伙伴健康度 main 交付复验（2026-10-28）

交付 checkout：`/Users/moon/.codex/worktrees/deliver-partner-health/DataDashboard`；初始远端基线 `ce0aa79b4289f26e5d9b77bb317853f861a7af63`，提交前重放到 `f5861079f1203e748781ad1f3afaeed1b8c6b7e1`。从主项目仅迁移本任务作者文件，保留远端已有层级表格能力与原工作区的并行修改。依赖按现有锁文件离线安装，锁文件未改。

## 范围与版本

- 覆盖伙伴健康度页面：11项已加权子分数先横向生成4类分数，再横向生成总分；负分直接相加，缺项及全缺项归零，不纵向合并组织、不重复乘权重。
- Playground专属模拟适配器返回原始DQE字段，沿真实归一化、compute及统一运行时渲染；日期和组织范围共享，上下页签独立，中国区/海外仅控制顶部。各粒度为预设模拟值，页面有黄色说明。
- `sumFields`单字段及`onMissing:"zero"`为Schema6.71能力，6.70及以下拒绝；保留远端6.70层级表格能力。local-authoring1.7.0，所有派生产物经官方生成器生成。示例入口 `/pages/sum-fields-missing-values`。
- 开发期两个相邻证据目录中的6.70/1.6.0及“未提交”是历史时间点，最终版本以本目录为准。

## 当前基线上的验证

`pnpm check`通过，全工作区Svelte检查0错误0警告；`pnpm build`通过（既有chunk体积提示）；`pnpm validate pages`为129/129通过。`authoring:contracts:check`及MC诊断夹具检查通过，最终结果在提交前重核。完整测试结果在下方追加。

仓外复制local-authoring完整目录699文件、无软链接；冻结页面原始字节见`snapshot/partner-health.json`。首次以额外版本后缀命名快照，被同一性规则拒绝；按实际页面文件名保存后完整校验通过，前后原始回执均保留。真实业务DQE、Relay与生产发布未执行。

## 浏览器

本目录证据来自交付checkout的`http://localhost:5194`，普通页面加载，无HTTP拦截。原主项目5193和其他服务保留。

- 默认中国区81.3，4个地区部；Chart有华东、华南。
- 切海外70.8，Chart为亚太、拉美，下表仍4个地区部。
- 独立将下表切到代表处后8行；广州部分缺项为0，智利全缺项总分0。
- 共享地区部筛选选亚太：顶部78.6、Chart只剩亚太、下表只剩新加坡与泰国。
- 能力页显示部分缺项8+(-2)=6、全缺项及真实零值均0。

AX原文与截图保留在本目录；此前日期、具体代表处、移动端等开发期证据见相邻两个历史目录。临时浏览器tab已关闭。

## 复杂度

同一工具`metriccanvas-ts-ast/1`、TypeScript5.9.3，逐函数`selfCC`含闭包/回调；Svelte只抽取script按同口径测量。相对当前远端基线：applyOperator8→8，新增sumFields8；pageExternalInputs12→13，scenarioEnvironment9→10，loadPage13→13；新增模拟数据函数最大1、模拟网关最大8，新增计算测试最大2、预览测试最大3，能力探测新增回调1/2/4。本次修改/新增函数均≤15，未关闭项0；其他未改存量函数未扩展重构。原始前后报告见complexity-before/after.json。

本地运行附件统一保存到主项目`.scratch/partner-health-delivery-20261028/evidence/`，不加入版本管理；本目录提及的JSON、AX文本、PNG及逐函数报告均指该本地副本。依赖锁SHA256为`1a33c68c0755b6d9bf6d05bbf45438b9b5e2b9bc574a6f41908944dfe5fc2f4f`。

最新基线复验：101个测试文件、1099项相关回归通过（页面包、得分/模拟、运行时计算、入口中立性及本地启动契约）；契约导出检查通过。另一次全仓测试仍在运行，未将其标作通过，远端完整CI按推送SHA另验。MC的3个已跟踪JSON是生成器`--check`实际读取的确定性夹具，按消费者需求同步；没有重新跟踪已清理运行附件。
