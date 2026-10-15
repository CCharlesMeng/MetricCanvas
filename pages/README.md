# 页面验收场景

新功能按[必选验收要求](../docs/agents/feature-acceptance.md)维护完整页面、协议文档和本地创作 Skill。页面试验场首页按用途列出所有页面；下列场景提供明确操作与预期。JSON 是运行输入，测试直接读取同一文件。

## 商务 SDT 报告与单月筛选

- 原页面：[business-sdt-report.json](business-sdt-report.json)，入口 `/pages/business-sdt-report`，保留人工维护的固定2026年10月报告。
- 新页面：[business-sdt-report-monthly.json](business-sdt-report-monthly.json)，入口 [商务SDT报告（单月筛选）](http://localhost:5173/pages/business-sdt-report-monthly)，目录「经营分析」。从当前原页复制，保留全部图表、表格和业务查询口径。
- 在报告顶部「报告月份」提交2026-09，报告主标题和「统计月份」同步变化；15个查询声明均绑定月份；实际呈现的14个查询联动，其中11个取所选月，3个趋势取含所选月的近6个月。2026-09对应2026-04～2026-09，2020-06对应2020-01～2020-06。
- 月份必选，最早2020-06，无上限。日历禁用2020年1—5月和更早年份；手工提交2020-05或非法月份时显示错误，标题、已应用月份与查询保持不变。URL `?report-month=2020-06` 可初始化，越界URL回退合法默认月2026-10。
- 原页另有未被组件消费的 `rep-office-efficiency` 查询声明，新页保留并配置月份绑定，运行时按既有规则不主动执行。
- 报告摘要保留原页内容并明确标记为「2026年10月固定摘要（不随月份筛选更新）」，本次不提供动态数值或排名摘要。
- 协议页面：[time-point-min-page.json](../packages/page/fixtures/contract-valid/time-point-min-page.json)，覆盖 month/date 两种下限。协议见[时间点下限](../docs/page-metadata/filters.md#时间点下限624)。
- 自动验收读取新页面：`packages/embed/tests/browser/business-sdt-monthly.spec.ts` 检查14个呈现查询窗口、文字联动、选择器禁用、越界草稿、URL与空结果。测试使用明确的合成传输回放，只证明交互与绑定，不能证明真实业务数据。
- 运行 `pnpm dev:dqe` 可预览；本地DQE Sim未覆盖此人工更新报告的完整15个查询，直接预览可能显示查询失败。真实DQE、Relay、线上部署不属于本地验收结论。

## 多查询表格

- 页面：[multi-query-table.json](multi-query-table.json)，试验场「验收样例 → 多查询表格验收（仿真）」。
- 启动：在仓库根运行 `pnpm dev:dqe`，打开 [多查询表格](http://localhost:5173/pages/multi-query-table)。该命令同时启动 DQE Sim 与页面试验场；保持统计月份为 2026-09。
- 数据：8 个代表处的合成数据，仅支持本地 DQE Sim；页面无真实业务查询或能力证明。顶部月份改变到其他期间会显式失败。

页面同时提供两张独立组合表，共用普通查询定义。场景一的「序号」由 `ordinalField` 在当前排序/筛选后编号；场景二的「预签金额排名」来自普通查询字段 `bidding_rank`，在完整统计月份行域按预签金额降序计算，再按代表处编码投影。场景二的表格排序、筛选和搜索保留原名次；同额按编码升序打破并列。本组合源不计算固定业务排名，真实接入需上游返回已验真的排名字段。

以下操作先在场景一执行：

| 操作 | 预期结果 |
|---|---|
| 初次打开 | 预签金额降序第一页：上海、北京、广州；总数8，页大小3 |
| 点击召开率表头两次，切到降序 | 第一页上海、深圳、北京；独立图仍为8类，下方独立完整表仍为8行 |
| 下一页 | 杭州、成都、广州；序号4、5、6 |
| 召开率降序时，金额下限输入150000000并提交 | 回到第一页，匹配上海、北京、广州，总数3；金额按元比较 |
| 再加召开率下限85 | 跨源条件 AND 后仅上海，总数1；百分数使用原始刻度85 |
| 清空数值条件，搜索「天津」并提交 | 在完整行域匹配天津，共1行；独立图与完整表保持8行 |
| 清空搜索后导出 | Excel 含全部8条数据；有过滤时只导出全部匹配行；未提交或非法草稿不进入导出 |

然后在场景二执行以下操作，场景一的已提交视图保持独立：

| 操作 | 预期结果 |
|---|---|
| 初次打开 | 上海、北京、广州，预签金额排名1、2、3 |
| 召开率切到降序 | 上海、深圳、北京，预签金额排名1、4、2 |
| 下一页 | 杭州、成都、广州，预签金额排名5、6、3 |
| 召开率下限85 | 回到第一页，仅上海、深圳，预签金额排名1、4；不会重新编号为1、2 |
| 上述条件下导出 | 两条匹配数据的预签金额排名仍为1、4 |
| 清除条件，搜索天津 | 唯一结果的预签金额排名仍为8；场景一序号表在相同搜索下为1 |

协议见[数据源](../docs/page-metadata/data-sources.md#多查询组合源-pagedjoin622)、[表格](../docs/page-metadata/components/table.md#数值范围和组合表622)。自动证据为 `packages/embed/tests/browser/paged-join.spec.ts` 与 `tools/dqe-sim/tests/multi-query-table.test.ts`，直接读取本页面；其他错误、取消与范围边界由共享执行测试覆盖。既有实施证据见[验收报告](../docs/evidence/multi-query-table/result.md)，真实接入仍按报告单独验收。

### 报告主标题时间联动

[report-title-filter-example.json](report-title-filter-example.json)，页面试验场入口 `/pages/report-title-filter-example`，内嵌示例服务入口 `/pages/report-title-filter-example`。纯文本交互页面，无业务数据、无外部查询。

- 初始主标题为“2026-09 经营分析报告”；切换报告月份为2026-10后主标题和说明同步变化，参数提供的名称保持不变。
- 清除时间点后显示“全部期间 经营分析报告”；无效输入/未提交草稿不改变已应用标题。
- 独立修改对照期间检查范围、同月折叠和两个筛选引用同时出现在正文；导出保留捕获时标题，准备期间后续修改不改变本次导出。
- [report-date-filter-example.json](report-date-filter-example.json) 使用同样的 parts 主标题并保留既有月度查询绑定；需本地 DQE Sim，标题变化本身不证明真实数据变化。协议异常由 text-composition 单元测试与契约反例覆盖。

## 查询数值容错

- 页面：[query-numeric-tolerance.json](query-numeric-tolerance.json)，试验场「验收样例」，或直接打开 [数值容错](http://localhost:5173/pages/query-numeric-tolerance)。
- 数据：八行固定合成数据，含正常数值、占位符、null、数字字符串、真实零、负数、布尔和空串；首屏使用 initial，本地动态查询由 DQE Sim 提供相同原始值。
- 操作：启动 `pnpm dev:dqe` 后打开页面；表格应保留八行，数值依次为 10.0、—、—、12.5、0.0、-4.0、—、—，完成率按相同缺失规则计算。折线保留 10、12.5、0、-4 四个有效点及其间缺口。排序后八行仍保留。两张指标卡分别显示缺失占位符和真实的 0%，缺失值进度环不能显示 0%。
- 动态链路：自动行为测试直接读取此页面，通过真实网关和 Sim 执行函数验证无 initial 的动态结果、告警计数、计算、保存与重开；内嵌首屏不请求 DQE。
- 边界：字段缺失、维度类型、行/明细结构仍拒绝；number 与 money 的查询度量缺失即使 nullable=false 也继续显示。inline 仍严格。
- 协议：[结果字段契约](../docs/page-metadata/fields.md#查询数值度量的容错)。静态/行为和本地浏览器证据不代表真实 DQE、Relay、DS 模型或部署验收。

## 商务SDT级联查询保留场景

[business-sdt-cascade-example.json](business-sdt-cascade-example.json)，试验场「验收样例」。它保存原有Top5项目→阶段明细的完整配置，替代人工业务报告作为自动级联与展示格式的回归输入。运行本地DQE Sim后，9/10月HTTP验收检查两条独立链使用各自商务编号，并验证导出与屏幕结果一致；不证明真实业务数据。
