# pages/capabilities/ioc-header/scenarios

页面由 JSON 自动发现。本文件仅记录使用说明，不参与渲染或注册。

## 按年、季度、月查看数据

入口：`/pages/ioc-header-overview-demo`；[页面 JSON](ioc-header-overview-demo.json)。

启动：`pnpm dev:playground`。

切换年、季度、月或近一年，并按区域筛选，页头期间与数据结果同步更新。

内置合成演示数据

切换条件后查看数据变化

1. 切换月、季、年再回月，核对锚点与查询条件。
2. 观察期间和区域各出现一次，统计期间与服务条件同时更新。

试验场为本组示例注入内置合成查询、候选和期间事实，无需启动服务。页面声明及查询绑定保持原样；真实业务需要接入数据网关、授权候选和可信期间事实。本地演示不代表真实 DQE、CloudIOC 或 Relay 验收。跨页仅传值，不恢复来源视图；页头可选操作仍挂起。

关键声明：`iocHeader`, `filters`。

关联：[ioc-header-dense-filter-demo](ioc-header-dense-filter-demo.json)。

关联：[ioc-header-detail-demo](ioc-header-detail-demo.json)。

## 更多筛选与上下级联动

入口：`/pages/ioc-header-dense-filter-demo`；[页面 JSON](ioc-header-dense-filter-demo.json)。

启动：`pnpm dev:playground`。

展开更多条件；改变上级区域时，下级选择随之清空，再按新范围选择。

内置合成演示数据

可展开、收起并联动筛选

1. 展开和收起页头，窄屏核对首行折叠。
2. 切换区域并观察下级清空、候选等待和相关查询门禁。

试验场为本组示例注入内置合成查询、候选和期间事实，无需启动服务。页面声明及查询绑定保持原样；真实业务需要接入数据网关、授权候选和可信期间事实。本地演示不代表真实 DQE、CloudIOC 或 Relay 验收。跨页仅传值，不恢复来源视图；页头可选操作仍挂起。

关键声明：`iocHeader`, `filters`。

关联：[ioc-header-overview-demo](ioc-header-overview-demo.json)。

## 按月查看项目详情

入口：`/pages/ioc-header-detail-demo`；[页面 JSON](ioc-header-detail-demo.json)。

启动：`pnpm dev:playground`。

在项目详情中选择单个月份查看数据，月份调整仅作用于当前详情。

内置合成演示数据

可直接修改详情月份

1. 观察项目参数身份与独立详情单月。
2. 修改单月，核对输入参数不被反写。

试验场为本组示例注入内置合成查询、候选和期间事实，无需启动服务。页面声明及查询绑定保持原样；真实业务需要接入数据网关、授权候选和可信期间事实。本地演示不代表真实 DQE、CloudIOC 或 Relay 验收。跨页仅传值，不恢复来源视图；页头可选操作仍挂起。

关键声明：`iocHeader`, `filters`。

关联：[ioc-header-overview-demo](ioc-header-overview-demo.json)。

## 选择多个不连续月份

入口：`/pages/ioc-header-month-set-demo`；[页面 JSON](ioc-header-month-set-demo.json)。

启动：`pnpm dev:playground`。

同时选择1月和3月，只查看这两个月的数据，不包含中间的2月。

内置合成演示数据

可直接多选月份

1. 选择2026-01与2026-03，核对结果仅含两个月。

试验场为本组示例注入内置合成查询、候选和期间事实，无需启动服务。页面声明及查询绑定保持原样；真实业务需要接入数据网关、授权候选和可信期间事实。本地演示不代表真实 DQE、CloudIOC 或 Relay 验收。跨页仅传值，不恢复来源视图；页头可选操作仍挂起。

关键声明：`iocHeader`, `filters`。

关联：[ioc-header-overview-demo](ioc-header-overview-demo.json)。

## 单选、多选与勾选筛选

入口：`/pages/ioc-header-business-options-demo`；[页面 JSON](ioc-header-business-options-demo.json)。

启动：`pnpm dev:playground`。

体验单选、多选和是/否勾选；停用项不能选，选择“全部”可取消对应限制。

内置合成演示数据

可直接体验不同选择方式

1. 切换封闭枚举、单多选与勾选，核对已应用条件。
2. 停用选项不能选择；全选不限只省略对应动态谓词。

试验场为本组示例注入内置合成查询、候选和期间事实，无需启动服务。页面声明及查询绑定保持原样；真实业务需要接入数据网关、授权候选和可信期间事实。本地演示不代表真实 DQE、CloudIOC 或 Relay 验收。跨页仅传值，不恢复来源视图；页头可选操作仍挂起。

关键声明：`iocHeader`, `filters`。

关联：[ioc-header-overview-demo](ioc-header-overview-demo.json)。

## 按区域层级筛选

入口：`/pages/ioc-header-business-tree-demo`；[页面 JSON](ioc-header-business-tree-demo.json)。

启动：`pnpm dev:playground`。

在同一个树形下拉框内直接选择地区部或代表处，外部没有层级按钮；更换时间后，检查原有选择是否仍可用。

内置合成演示数据

已提供演示区域层级与可选项

1. 打开“区域结构”，在树内选择地区部，或搜索并直接选择“北京代表处”；同码 `same` 分别提交 department_code 或 office_code，不使用前置按钮。
2. 切换候选时间，观察交集、空交集待确认和不可用状态。

试验场为本组示例注入内置合成查询、候选和期间事实，无需启动服务。页面声明及查询绑定保持原样；真实业务需要接入数据网关、授权候选和可信期间事实。本地演示不代表真实 DQE、CloudIOC 或 Relay 验收。跨页仅传值，不恢复来源视图；页头可选操作仍挂起。

关键声明：`iocHeader`, `filters`。

关联：[ioc-header-overview-demo](ioc-header-overview-demo.json)。

## 详情页单独选择业务条件

入口：`/pages/ioc-header-business-detail-demo`；[页面 JSON](ioc-header-business-detail-demo.json)。

启动：`pnpm dev:playground`。

切换详情月份和业务档位，只更新当前详情的数据。

内置合成演示数据

可切换月份与业务档位

1. 在详情切换单月与枚举，核对相关查询条件。

试验场为本组示例注入内置合成查询、候选和期间事实，无需启动服务。页面声明及查询绑定保持原样；真实业务需要接入数据网关、授权候选和可信期间事实。本地演示不代表真实 DQE、CloudIOC 或 Relay 验收。跨页仅传值，不恢复来源视图；页头可选操作仍挂起。

关键声明：`iocHeader`, `filters`。

关联：[ioc-header-overview-demo](ioc-header-overview-demo.json)。

## 切换币种与金额范围

入口：`/pages/ioc-header-currency-demo`；[页面 JSON](ioc-header-currency-demo.json)。

启动：`pnpm dev:playground`。

切换人民币或美元后，重新选择金额范围；显示单位与导出结果保持一致。

内置合成演示数据

可切换币种、单位与金额范围

1. 切换人民币与美元，明确选择金额范围后查询。
2. 比较基本单位条件、显示单位和表格导出使用的静态货币字段。

试验场为本组示例注入内置合成查询、候选和期间事实，无需启动服务。页面声明及查询绑定保持原样；真实业务需要接入数据网关、授权候选和可信期间事实。本地演示不代表真实 DQE、CloudIOC 或 Relay 验收。跨页仅传值，不恢复来源视图；页头可选操作仍挂起。

关键声明：`iocHeader`, `filters`。

关联：[ioc-header-overview-demo](ioc-header-overview-demo.json)。

## 按日、月和周筛选

入口：`/pages/ioc-header-time-modes-demo`；[页面 JSON](ioc-header-time-modes-demo.json)。

启动：`pnpm dev:playground`。

按天、按月或按周选择期间；周范围固定为周一至周日。

内置合成演示数据

可直接切换日期粒度

1. 切换日、月、ISO周，核对URL与查询保持完整模式范围。

试验场为本组示例注入内置合成查询、候选和期间事实，无需启动服务。页面声明及查询绑定保持原样；真实业务需要接入数据网关、授权候选和可信期间事实。本地演示不代表真实 DQE、CloudIOC 或 Relay 验收。跨页仅传值，不恢复来源视图；页头可选操作仍挂起。

关键声明：`iocHeader`, `filters`。

关联：[ioc-header-overview-demo](ioc-header-overview-demo.json)。

## 日期快捷选择

入口：`/pages/ioc-header-time-presets-demo`；[页面 JSON](ioc-header-time-presets-demo.json)。

启动：`pnpm dev:playground`。

用今日、近7天、上个完整月等快捷项填写日期范围。

内置合成演示数据

可直接选择日期快捷项

1. 选择今日、近7天或上个完整月预设，核对统一时钟与日期边界。

试验场为本组示例注入内置合成查询、候选和期间事实，无需启动服务。页面声明及查询绑定保持原样；真实业务需要接入数据网关、授权候选和可信期间事实。本地演示不代表真实 DQE、CloudIOC 或 Relay 验收。跨页仅传值，不恢复来源视图；页头可选操作仍挂起。

关键声明：`iocHeader`, `filters`。

关联：[ioc-header-overview-demo](ioc-header-overview-demo.json)。

## 选择最新数据期或完整期

入口：`/pages/ioc-header-availability-demo`；[页面 JSON](ioc-header-availability-demo.json)。

启动：`pnpm dev:playground`。

以最新数据期或最新完整期选择期间；手动指定日期可覆盖默认值。

内置合成演示数据

已提供演示最新期与完整期

1. 使用内置期间事实，观察完成期初值。
2. 显式URL优先于动态初值；不可用日期或身份变化停止相关执行。

试验场为本组示例注入内置合成查询、候选和期间事实，无需启动服务。页面声明及查询绑定保持原样；真实业务需要接入数据网关、授权候选和可信期间事实。本地演示不代表真实 DQE、CloudIOC 或 Relay 验收。跨页仅传值，不恢复来源视图；页头可选操作仍挂起。

关键声明：`iocHeader`, `filters`。

关联：[ioc-header-overview-demo](ioc-header-overview-demo.json)。

## 从近12个月中多选

入口：`/pages/ioc-header-calendar-window-demo`；[页面 JSON](ioc-header-calendar-window-demo.json)。

启动：`pnpm dev:playground`。

按最新数据期列出近12个月，可选择1月、3月等不连续月份。

内置合成演示数据

已提供演示月份与最新数据期

1. 试验场已提供演示月份候选和期间事实。
2. 选择1月与3月，核对离散集合与十二个月候选窗口。

试验场为本组示例注入内置合成查询、候选和期间事实，无需启动服务。页面声明及查询绑定保持原样；真实业务需要接入数据网关、授权候选和可信期间事实。本地演示不代表真实 DQE、CloudIOC 或 Relay 验收。跨页仅传值，不恢复来源视图；页头可选操作仍挂起。

关键声明：`iocHeader`, `filters`。

关联：[ioc-header-overview-demo](ioc-header-overview-demo.json)。

## 带筛选条件进入清单

入口：`/pages/ioc-header-navigation-source-demo`；[页面 JSON](ioc-header-navigation-source-demo.json)。

启动：`pnpm dev:playground`。

选择期间、币种和区域后进入项目清单，清单自动带入这些条件。

内置合成演示数据

从这里开始跨页体验

1. 选择期间、币种和区域，再点击携带条件进入清单。
2. 目标能力缺失的链接明确拒绝；详情使用内置合成数据回显。

试验场为本组示例注入内置合成查询、候选和期间事实，无需启动服务。页面声明及查询绑定保持原样；真实业务需要接入数据网关、授权候选和可信期间事实。本地演示不代表真实 DQE、CloudIOC 或 Relay 验收。跨页仅传值，不恢复来源视图；页头可选操作仍挂起。

关键声明：`iocHeader`, `filters`。

关联：[ioc-header-navigation-list-demo](ioc-header-navigation-list-demo.json)。

关联：[ioc-header-navigation-detail-demo](ioc-header-navigation-detail-demo.json)。

## 从清单打开项目详情

入口：`/pages/ioc-header-navigation-list-demo`；[页面 JSON](ioc-header-navigation-list-demo.json)。

启动：`pnpm dev:playground`。

在单月清单中点击项目，将项目、月份、币种和区域带入详情。

内置合成演示数据

建议从概览进入

1. 建议从概览来源进入；直接打开需?origin=直接入口。
2. 单月下点击示例项目甲传到详情；季度或缺项目编码行拒绝。

试验场为本组示例注入内置合成查询、候选和期间事实，无需启动服务。页面声明及查询绑定保持原样；真实业务需要接入数据网关、授权候选和可信期间事实。本地演示不代表真实 DQE、CloudIOC 或 Relay 验收。跨页仅传值，不恢复来源视图；页头可选操作仍挂起。

关键声明：`iocHeader`, `filters`。

关联：[ioc-header-navigation-source-demo](ioc-header-navigation-source-demo.json)。

关联：[ioc-header-navigation-detail-demo](ioc-header-navigation-detail-demo.json)。

## 查看并调整传入条件

入口：`/pages/ioc-header-navigation-detail-demo`；[页面 JSON](ioc-header-navigation-detail-demo.json)。

启动：`pnpm dev:playground`。

查看传入的项目和筛选条件；在详情中调整月份、币种或区域，不影响来源页。

内置合成演示数据

建议从清单打开项目

1. 从清单点击项目进入；直接打开需project-id、project-name、origin和合法month参数。
2. 观察项目、月份、币种和区域的合成服务回显；详情修改不回写来源。

试验场为本组示例注入内置合成查询、候选和期间事实，无需启动服务。页面声明及查询绑定保持原样；真实业务需要接入数据网关、授权候选和可信期间事实。本地演示不代表真实 DQE、CloudIOC 或 Relay 验收。跨页仅传值，不恢复来源视图；页头可选操作仍挂起。

关键声明：`iocHeader`, `filters`。

关联：[ioc-header-navigation-source-demo](ioc-header-navigation-source-demo.json)。

关联：[ioc-header-navigation-list-demo](ioc-header-navigation-list-demo.json)。
