# B2证据账本

## AC ↔ 证据映射

| AT | 状态 | 执行环境 | 证据记录 | 新鲜度 | 说明 |
| --- | --- | --- | --- | --- | --- |
| AT21 | PROVEN | contract | BE-21；targeted.log；executor.log；browser.log | 当前依赖哈希 | 单/多选、required、disabled、静态枚举、全选不限及boolean false；静态谓词和URL/UI已选值保留 |
| AT22 | PROVEN | contract | BE-21、BE-22；executor.log；browser.log | 当前依赖哈希 | clearOnChangeOf整次提交清理与确认门禁；期间变化按可信候选取交集，空交集不执行全部；新旧依赖合图与详情边界 |
| AT23 | PROVEN | contract | BE-22；executor.log；browser.log | 当前依赖哈希 | 显式level/parent、同码层隔离；required切层先草稿再原子提交；当前层空候选阻断；旧斜杠树保持 |
| AT24 | PROVEN | contract | BE-22；executor.log；browser.log；installed.log | 当前依赖哈希 | V2完整期间/维度上下文、实例/代次隔离；缺能力及denied/unconfigured拒绝执行；legacy祖先与selection动态核验；候选网络错误清旧initial |
| AT25 | PROVEN | contract | BE-21、BE-22、BE-23；static.log；restore-report-green.json | 当前依赖哈希 | 三张真实声明验收页、说明及静态已应用条件，普通/详情私有筛选；390宽页头无横向溢出；code=821ac2aac23ef7b04db3f87d56323c951489f5909e350dde4f36b7e67985fb07 |
| AT26 | PROVEN | contract | quality_gate；BE-23；authoring-distribution.log；installed.log | 当前源指纹 | Schema6.33、能力/正反契约、受控维度/日期创建编辑重开、Bundle、独立Skill和六包安装消费者 |

contract是本地合成HTTP契约环境。真实DQE、CloudIOC、Relay、DS模型、门户、CI与部署未运行；本批不提供这些验收结论。B0+B1历史证据保留原指纹，当前源码回归另见本批日志，不改写历史记录。

## 计划外承接

| 文件 | Task | 原因 |
| --- | --- | --- |
| data-execution/src/source-program/session.ts、execute.ts、candidate-validation.ts、candidate-session.ts | T2 | 同一候选门禁覆盖无界面执行、seed/initial复用与一次性创作执行；显式失败来源保护候选网络错误，图表独立闭集保持旧语义 |
| embed/tests/serve.mjs、fixtures及compatibility.mjs | T4 | 结构树与期间上下文用本地HTTP契约直接验收；fixture留在验收服务同包，仓外安装复制闭合 |
| runtime-ui/src/ioc-header/IocHeader.svelte | T4 | 静态导出将tooltip说明展开为正文，避免静态结果保留交互隐藏内容 |
| ui/src/components/select/Select.svelte、widgets/Table.svelte | T3 | 折叠时关闭已有Select浮层；共享候选状态类型新增denied/unconfigured的显式说明 |

## 人工验收记录

无本批必须由人工完成的项目。

## Deferred

Condition/displayInputs仍待审；B3金额、B4复杂时间及可信最新期、B5完整视图恢复、B6可选操作继续留唯一主计划，不默认实施。
