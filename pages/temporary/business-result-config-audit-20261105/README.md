# 业务结果指标情况

页面 JSON：`business-result-metrics-2.json`。预览入口：`/pages/business-result-metrics-2`。

## 独立合计数据源与组织层级

合计是表格置顶行的呈现位置，其数值由独立普通 complete query 提供。地区部与代表处为父子组织，合计按当前展示范围的上级组织粒度查询，不读取、求和或平均本表明细。

| 页头区域 | 地区部表 | 代表处表合计 |
|---|---|---|
| 全球（区域为空） | 地区部明细；合计为全球粒度 `output_dims:[]` | 展示全部代表处；使用独立全球合计 `output_dims:[]` |
| 选择地区部 | 隐藏 | 展示该地区部的代表处；合计查询保留 `output_dims:["地区部"]`，通过 `region_dept_code` 收窄到该地区部 |
| 选择代表处 | 隐藏 | 展示该代表处明细，隐藏合计 |

每种合计有四个置顶槽、五条逻辑查询：`summary` 同时返回四个主指标，`commercial` / `contract` 固定业务类型分别返回闭环率，`yoy` 通过本期和去年同期两条净商务折扣汇总查询计算同比。所有汇总查询时间聚合、不含 limit/offset；当前显示的每个置顶槽最多一行。

- 地区部表使用 `region-dept-*summary*`，只绑定统计期间；闭环率另外绑定原有国内/海外选择。
- 代表处表全球场景使用 `rep-office-*summary*`，不绑定区域。
- 代表处表地区部场景使用 `rep-office-parent-*summary*`，全部查询保留地区部输出维度并显式绑定区域；包含本期、去年同期、商务与合同。它们不依赖 `rep-office-metrics` 或 `region-dept-metrics` 明细源。
- 代表处表以三个条件互斥的组件分别承接全球合计、地区部合计与无合计明细，复用相同明细源。非空 geo 层级沿用原有无合计分支，不把它误当作全球。

## 同比与环比

表格同比均为本期净商务折扣减去年同期净商务折扣，数值以百分点为刻度，`points-1-signed` 只负责显示 `+2.0P`、`−3.0P`、`0.0P`，不改变排序和原始数值。

两张表的合计同比使用独立 complete query，先从 DQE 取得对应全球或地区部粒度的两期汇总，再 `joinAggregate(keys:[], aggregate:unique) → delta`。不会累计或平均明细同比。去年同期缺失保留 null，查询失败按现有置顶槽规则处理。地区部粒度查询中的显式地区部字段有对应 queryField 映射。

同比查询绑定页头 `mtime`，本期使用 `periodComparison.current`，去年同期使用 `previousYear`；两期共用 `net-discount-through` 截止事实并按日边界查询。Sim 截止日期为 `2026-11-04`：选11月比较两年各自11月1—4日；切换到10月则比较两年完整10月。普通主汇总仍按页头所选期间查询；真实接入时需核对其净商务折扣值与同比本期截止口径一致。

明细同比按地区部或代表处键关联两期，查询成功但缺组织行时沿用原补零策略，显式 null 不补零。图表净商务折扣通过本期、上期、去年同期三条完整查询及 `unionKeys → joinAggregate → delta` 产生环比与同比，仍分别绑定原有区域、站点和期间。

## DQE Sim 预览与预期结果

普通环境在仓库根运行 `pnpm dev:dqe` 后访问页面；默认端口被占用时分别启动：

```sh
DQE_SIM_PORT=18391 DQE_SIM_HOST=127.0.0.1 pnpm sim:dqe
DQE_SIM_PORT=18391 pnpm --filter playground dev --host 127.0.0.1 --port 5191 --strictPort
```

当前预览为 `http://127.0.0.1:5191/pages/business-result-metrics-2`。查询走标准同源 HTTP execute 路径；业务事实全部来自 `tools/dqe-sim/fixtures/business-result-metrics.json`，不注入前端回执或写 initial。组织编码复用本地候选字典；截止事实由 Playground 专用适配器提供，不写入页面协议。模拟权重不代表真实业务指标口径。

- 全球状态：3个地区部、5个代表处；两张表净商务折扣合计30.0%，合计同比+0.9P。
- 从页头选择华北地区部：仅显示代表处表，合计32.5%，同比−1.8P；北京25.0% / +2.0P，天津35.0% / −3.0P。
- 选择北京代表处：只有北京明细，不显示合计。清空区域恢复全球。
- 期间、国内/海外沿用原有控件；默认国内时海外组织的商务、合同闭环率缺失属于原有站点绑定的预期。

页头为首 section 首组件 `iocHeader`。合计文字与区域名称左对齐，同比显示P。此次只调整页面的既有查询声明、数据源和显隐组合，Schema 字段净增减0，无新增引擎职责或协议能力，不需要重生成协议知识。真实DQE的维度、聚合、权限和截止事实仍待业务环境验真。

原件、HTTP/浏览器与回归记录保存在本地 `artifacts/business-result-parent-grain-20261105/`。复杂度按 `metriccanvas-ts-ast/1` 实测，模拟查询粒度函数CC保持4，全部修改/新增测试函数和回调CC不超过3。
