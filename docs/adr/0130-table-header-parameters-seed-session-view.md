---
status: accepted
date: 2026-11-05
note: 用户确认 URL 只供初值、表头会话拥有后续状态并授权实施
---

# 页面参数初始化表头，会话拥有后续选择

Schema 6.85 在 select 叶子列新增 initialParam 与 allBehavior，局部扩充 [ADR-0128](0128-table-header-filter-declared-defaults.md) 的初始意图：既有页面字符串维度参数可以只被表头初始化消费，不自动成为永久查询条件。initialParam 与静态 defaultValues 互斥；无输入且可选时不限，保存参数值可以提供缺省。隐藏页级筛选与表头持续取交集无法表达用户可清空的初值，因此拒绝同一输入重复固定控制同一查询目标。

共享 data-execution 将已解析参数转为既有 TableQueryView，首次读取与选中态原子一致。TableSession 是已提交视图的唯一写入者，显式恢复整体优先，包括空视图；普通刷新、翻页、Tab 和导出使用当前视图，不能补回 URL。列隐藏和完整父子重置沿用既有规则，参数只在新实例重读。执行器与浏览器共用纯规则，共享层不读取地址栏。带 initialParam 即使无值也保留远程所有权、待定门控、参数消费者、失效与快照保护身份；普通 initial/执行回执无视图证明不复用，Node 不输出误导性的普通 initial。

allBehavior 缺省 values，保持原始值集合；显式 unrestricted 要求 enumValues，全选省略该列条件并统一回显不限，结果可含原有 null 或字典外值。初始化、手动提交和恢复共用类型保持、忽略次序的归一化，在组合分页成员检查之前执行。字典仅展示原始值，不自动推断不限。净增两个可选属性，参数、TableQueryView 与 DQE HTTP 不变；首期只扩静态 main 字符串维度参数，保留数值静态默认值，不开放范围/其他槽/byFilter/行内子表。所有权及组合成员限制继续遵循 ADR-0108/0125。

实施入口见[唯一规划](../plan/2026-11-04-table-header-filter-url-initialization.md)，正式语义见[Table 正文](../page-metadata/components/table.md#table-header-params)。合成页面和仿真验收不能替代缺失的业务原件、真实 DQE/Relay 或部署验证。
