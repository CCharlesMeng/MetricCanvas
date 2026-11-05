---
status: accepted
date: 2026-10-30
note: 用户确认主查询选页、本页业务键补查历史期及组合后计算，批准实施方案
---

# 期间比较复用组合查询分页并在投影后执行逐行计算

同比环比的查询分页以当期主查询确定本页业务对象、顺序和总数，再按本页键、同一业务范围及派生期间补查历史指标。选页用的当期度量阈值不传给历史指标；查询成功但无匹配与已返回null分别处理，失败不补零。三期无须按数组顺序对齐，可信统计截止事实用于统一期间，后端事务快照另属集成证据。

复用ADR-0108/0125的pagedJoin按需选页补列及SourceProgram职责；将6.77的periodComparison开放给无records的显式查询分页组合。当期domainMember拥有选页能力，历史成员只补列；内部结果与普通成员快照隔离，固定resultBindings保持原语义。SourceProgram为预检、成员读取、候选和导出提供同轮冻结的期间事实及权限上下文，组件不生成或调度查询。

6.78局部扩展组合数据源的Interface：同层compute仅允许行数不变的delta/ratio，按顺序消费投影和前序产出；source.projection字段可用onMissing:"null"|"zero"声明缺记录策略。投影检查输入，统一计算阶段产生最终字段并保留主查询totalCount；不能覆盖投影、行键和序号。保持ADR-0095的完整跨源算子要求，不将分页窗口开放为完整统计输入，也不引入通用表达式或独立计算资产。

主查询原始列执行后端全局操作，计算列只展示；历史独有对象由主查询行域决定。需要三期并集或计算列全局操作时显式使用原完整集合路径，或后端提供可按计算结果选页的查询。完整导出冻结条件、逐页选页补查并统一计算，保留10000行/60秒和失败不给部分文件；此规则不改写ADR-0107对普通resultBindings的当前窗口导出。

未采用新数据源类型或组件级查询器：会重复分页、关联、取消和导出职责。普通query+resultBindings可构造本页键补查，但还需另接组合视图、范围和全表导出；本场景优先扩展已经拥有这些职责的pagedJoin。实施与验收见[实施设计](https://github.com/CCharlesMeng/MetricCanvas/blob/09a7815c965bce921c2ef50202fa727ba9a8e705/docs/evidence/period-comparison-query-page/design.md)和[本地验收](https://github.com/CCharlesMeng/MetricCanvas/blob/09a7815c965bce921c2ef50202fa727ba9a8e705/docs/evidence/period-comparison-query-page/acceptance.md)。
