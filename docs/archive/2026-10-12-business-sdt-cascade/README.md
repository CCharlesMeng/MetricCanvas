# 商务 SDT 级联查询本地实施结论

本批实现商务SDT报告的两组Top5级联：先取主项目，使用本轮商务编号集合一次取阶段明细，再透视并左关联回原表。两表已迁移至Schema6.14，复用既有网关、缓存、取消和计算链路；正常、空集、错误、竞态和导出数据路径已在本地验证。真实DQE与生产集成未执行。

现行结论在[ADR-0099](../../adr/0099-raw-query-result-bindings-and-bounded-left-joins.md)、[查询绑定协议](../../page-metadata/queries-and-bindings.md)、[计算协议](../../page-metadata/compute.md)与[验收证据](../../evidence/2026-10-12-business-sdt-cascade/result.md)。代码入口为packages/page/src/validate-query-results.ts、packages/engine/runtime/src/query-result-inputs.ts和orchestrator.ts。讨论、结构、实施及验证规格分别保留于[讨论记录](discussion.md)、[完整结构](data-sources.proposed.json)、[实施细则](implementation.md)和[验收矩阵](acceptance.md)。

未采用隐藏筛选器回写，因为空集合可能变成无条件查询，派生输入也会混入用户状态；未建设另一套执行器，因为现有执行通道已提供缓存、去重和代次取消。浏览器发现原fit:container会把窄屏十列压成逐字换行，因此仅两张表改用现有fit:content横向滚动。过程件在此冻结，后续真实数据验真按证据结论中的协调清单进行。
