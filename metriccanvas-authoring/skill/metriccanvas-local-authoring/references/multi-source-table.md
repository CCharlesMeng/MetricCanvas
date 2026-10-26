# 同一表格合并多个来源

当用户要求“同一列对应不同来源的不同字段”“两个表的记录放一起整体排序”时，先确认逐行合并是否保留重复记录。已确认保留时使用 `pagedUnion`；若需求是按同一业务键给一行补列，查 `data.pagedJoin`。

1. 列出统一输出列与各来源字段的对应表，记录字段类型、单位、币种、比例刻度和来源内唯一键。缺字段显式选择 null 或业务常量；未知口径列为接入缺口。完成条件是每个来源都有覆盖全部输出列的映射。
2. 读取 `data.pagedUnion` 与 `table.source-navigation`；需要字段类型时再读 `fields.core`。最终结果只维护一份字段契约，成员复用已有普通查询定义，外部字段继续经成员 queryField 归一化。
3. 在合并源的 `ordering.default` 写最终页面字段，询问或沿用用户已确认的整体默认排序。例如决策次数降序：`[{"field":"decisionCount","direction":"desc"}]`；同时显式列出交互可排序字段。Table 的 data.main 指向合并源，rowKey 绑定合并行键，pagination.mode 写 query。
4. 显式配置 rowKey 与 sourceField；成员声明原始稳定唯一键。业务内容重复照常保留。按来源进入不同详情时，在链接列声明 navigateBySource，并传递原始业务键；未配置的来源显示普通文本。
5. 核对搜索、筛选、候选值、默认表头方向、任意页与完整导出。读取[完整示例](page-metadata/examples/paged-union-page.json)按业务替换，不在 Table 列里放查询或猜测相同列名会自动映射。
6. 按主流程冻结尝试并运行独立校验器。真实接入另核实各来源稳定排序、null 位置、字符串比较、总数、搜索编码和候选接口；模拟数据通过与真实取数分别报告。首次深页可能更慢，受扫描/耗时限制；超限提示缩小范围，不截断后宣称完整。

协议细节以 `read-knowledge.mjs show --topic data.pagedUnion --topic table.source-navigation` 的生成知识为准。
