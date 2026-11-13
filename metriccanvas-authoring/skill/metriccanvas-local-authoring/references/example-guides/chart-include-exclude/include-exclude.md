## 图表包含与排除范围

入口 `/pages/chart-include-exclude`；页面 JSON（原入口：`chart-include-exclude.json`）。启动 `pnpm dev:playground`，使用已有维度排除合成 Adapter，无需 DQE 服务。

复用用途：在图表右上角配置两个可多选、可清空的下拉框，分别限定包含范围与排除范围，两项共同作用于同一次对象查询。

参考对象：`office-card` 的 `filterLayout:"toolbar"`、`include-office-picker` 与 `exclude-office-picker` 的右对齐，以及 `office-data` 查询对同一 `代表处` 字段的 `=` / `!=` 筛选绑定；`office-chart` 与 `office-table` 共用查询结果。

移植边界：须映射真实查询对象、字段、结果字段契约和可信候选。北京、天津、广州及金额均为合成示例，不可直接作为业务查询或授权范围；两个筛选器保留独立 id。Schema 与引擎沿用现行能力，不增加协议声明。

可观察预期与环境：默认包含北京、天津、广州并排除北京，图表与明细仅显示天津20、广州30；实际对象请求合成为 `代表处 = [天津, 广州]`。清空包含范围后请求保留 `代表处 != [北京]`；清空排除范围恢复包含集合；两项均清空显示全部三行。包含范围被全部排除时显示空态且不发送无条件请求。`?state=empty` / `?state=error` 可观察合成空态与失败，控件始终保留。浏览器检查桌面与窄屏工具栏及请求条件；未验证真实 DQE、权限、空值、导出或生产集成。
