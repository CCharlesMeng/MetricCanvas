# 查询结果输入行过滤：本地验收

日期：2026-10-14。协议能力：6.19。用户已授权方案落盘与实施。范围是原始字段条件筛行、提取原始维度集合；不增加指标值集合目标、不引用compute产出。

## 实现与位置

- 干净实施分支：`codex/query-result-where`，基线`ea6e453e`。独立工作区`/Users/moon/.codex/worktrees/query-result-where/DataDashboard`。
- `packages/page/src/query-result-where.ts`是条件语义校验与纯行选择Module；严格类型、all/any、空值规则和受控大小限制集中于此。
- `resultBindings[].where`与6.19门禁、TS/Python校验、协议示例、JSON Schema、Bundle和独立本地创作Skill同步。
- 当前混合主工作区的共享取数包已经接入同一Module，源码和新增测试在`packages/data-execution/`；浏览器/导出通过既有转发复用共享解析。
- 独立检出保留已提交基线上的完整契约和Skill产物。主工作区其他任务未完成的自定义组件、共享包迁移和分发差异不复制进本批独立产物，也不被本批产物覆盖。后续正式交付合并应按届时已确认的产品真源重新生成。
- 交付对齐共享执行模块：输入解析位于packages/data-execution/src/query-result-inputs.ts，单次执行回归为packages/data-execution/tests/query-result-where.test.ts。早期临时兼容补丁不作为最终实现交付。

## 验收结果

| 层次 | 结果与证据 |
|---|---|
| 协议/引擎/分发相关TS回归 | 58个文件、551个测试覆盖；初次6个失败均为当前版本/未来版本写死预期，更新为6.19/6.20后4文件42测试重跑通过，其余54文件首次通过。最后过滤声明守卫变更后相关3文件79测试再次通过 |
| 主工作区共享模块 | 原有相关6文件115测试通过；新增单次执行2测试通过。最终过滤/运行时/单次执行3文件34测试通过；主工作区版本/公开面50测试覆盖，黄金矩阵版本更新后2测试重跑通过 |
| Python完整Harness | 锁定requirements.lock的独立环境，530测试通过，1项按原配置跳过；模型调用数0 |
| 类型 | page、engine、embed测试类型与根tests类型通过；主工作区data-execution和page类型通过 |
| 页面校验 | pnpm validate：16页面通过；新增两份完整合法页面经产品校验、契约向量及独立Skill校验器通过 |
| 分发一致性 | authoring:contracts:check通过；Bundle 0.3.1通过2222项摘要检查；本地Skill隔离、参考覆盖和导出隔离测试通过 |
| 构建 | page/engine发布构建与embed构建通过 |
| 浏览器HTTP | Playwright/Chrome通过1场景；协议形状本地HTTP替身，A逻辑查询1次，B/C分别收到HIGH和LOW集合，A显示HIGH/LOW/CLOSED全部3行 |
| ADR索引 | 0106及主题结论已落盘，索引检查通过。主工作区0104/0105属于其他工作，未覆盖 |

浏览器截图：[完整结果与独立下游集合](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/query-result-where/browser/query-result-where-one-ful-2caf6-independently-filtered-sets/query-result-where.png)。该图确认主表3行、两个下游各1行；不用于声明真实业务数值正确。

## 语义验收覆盖

A不可变与顺序保留、不同下游独立规则、过滤后空集合跳过请求、先过滤去重再检查上限、选中键非法报错、被排除合法null键不提取、原始范围不完整失败、谓词字段无效不能被all/any短路掩盖、刷新取消和旧代次丢弃、导出使用本轮新结果、单次执行保留全部A原始initial。

条件覆盖eq/ne、in/notIn、gt/gte/lt/lte、isNull/isNotNull、组合和严格类型；0/false、money原始精度、合法日期/时间、null在ne/notIn下不匹配、空集合/空组、额外键、未知字段/操作符、计算字段、4层边界、叶子与集合超限及旧版本拒绝。

## 证据边界

本次没有真实DS模型、真实DQE、Relay/Java生产接线、CI、推送或部署证据。浏览器使用本地HTTP替身；Python模型相关主流程使用确定性脚本。共享取数包的生产迁移仍属于其原任务，本批只接入并验证本地规则复用。
