# 业务结果指标：独立合计与 IOC 页头

启动 `pnpm dev:playground`，打开 `/pages/business-result-metrics`。

本页为 Dashboard。IOC 页头首行紧跟主标题展示重点国代开关、统计期间、区域和客户分类。第二行的「净商务折扣筛选项」紧邻业务类型和云服务排除项，整组与首行筛选右端对齐。区域为可搜索单选组织树，支持 geo / region-dept / office 层级。

期间输入框与各下拉框为 160px，同一组控件间距为 16px。下拉候选弹层以触发框宽度为起点，随候选内容加宽，上限为视口可用宽度。窄窗口的首行通过「展开筛选」访问换行控件，净商务折扣筛选行独立显示。布局回归为 `pnpm --filter playground test:ioc ioc-header-layout.browser.ts`。

业务类型树使用内联候选。选择「华为公有云CORE」按 `业务类型编码` 查询，展开并选择「公网REGION」按 `子业务类型编码` 查询，选择「全部业务类型」省略该条件。「云服务排除项」在集成方提供的 Region 与统计期间就绪后预加载首批 20 条，滚到底继续读取下一批。用 `?region=&mtime=month:2026-10` 可验证不限 Region 时关闭下拉也会预加载。候选请求携带统计期间的 `period/start/end`，下拉状态供辅助技术读取。已选服务按 `!=` 下推。

两个筛选同时应用于「净商务折扣执行情况」图表的净商务折扣、整体均值和月／季／年变化查询，以及地区部和代表处两张表的净商务折扣本期值与对应变化查询。两张表按各自的组织粒度关联补列，主表行由框架执行率和合同风险的查询提供。匹配不到折扣数据时，折扣列显示缺值，其他指标沿用原查询条件。

在全球视图中可同时查看地区部和代表处两张表。用页头逐一切换业务类型、云服务排除项，再切换年、季、月检查相应列与图表。自动验收使用合成响应，可运行 `pnpm --filter playground test:ioc business-type-levels.browser.ts` 和 `pnpm test packages/engine/runtime-ui/tests/business-result-query.test.ts`。接入真实 DQE 后需核验两个筛选字段在各组织粒度的指标查询中均可用。

## 云服务排除项只在页内生效

用 `pnpm dev:dqe` 启动 Playground 和 DQE Sim，打开 `/pages/business-result-metrics?region=&mtime=month:2026-10&cloud-service=旧链接服务`。地址保留期间并清理 `cloud-service`，下拉仍按当前业务类型应用联动默认值。新增一项排除后，在开发者工具的合成 DQE 请求中查看云服务排除条件，地址始终不包含该筛选值。刷新后按默认规则重新初始化。

自动验收可运行 `pnpm --filter playground test:ioc business-result-summary-time.browser.ts -g "云服务排除项关闭 URL 同步"`，使用可控合成 DQE 回执。

## 均值线与期间比较线

「净商务折扣（原价）均值」显示为左轴上的水平线，读取后端返回的整体均值。将统计期间切到「月」，可同时查看右轴上的黄色环比折线，每个有效值使用同色实心圆点。切到「季」或「年」时，右轴的同比折线使用相同的黄色。

## 图表标题和筛选工具栏

用 `pnpm dev:dqe` 启动 Playground 和 DQE Sim，打开 `/pages/business-result-metrics?region=R99&region.level=geo`。Region 为「中国」时，「决策意见闭环率」标题和右侧「商务 / 合同」下拉同排，「框架执行情况」仅显示标题。清空区域以取消范围限制后，两张卡的标题各自独占第一行。「决策意见闭环率」第二行左侧显示「中国区 / 海外」，右侧显示「商务 / 合同」。「框架执行情况」第二行仅显示左侧切换。切回「中国」恢复初始行位。

浏览器回归为 `pnpm --filter playground test:ioc composite-card-header.browser.ts`。场景使用业务页面原配置和本地仿真响应，验证标题与筛选控件的位置。

## 合计取数

两表在汇总加载期间先显示首行「合计」，未返回的指标显示加载占位，已返回的值原位填入。主汇总为空或汇总查询失败时收起该行。合计不占明细数量。两表共用后端完整汇总，使用 `output_dims: []` 和 `time.is_aggregate: true`，查询使用当前统计期间、区域、客户分类。勾选「仅看重点国代」时，引擎沿 Region 绑定把已授权名单作为交集条件。汇总继续受服务端授权范围限制。

`business-results-summary` 读取框架执行率及两项合同风险指标。商务和合同闭环率查询各自保留固定的决策业务类型谓词。`business-discount-summary` 单独读取净商务折扣本期值与当前期间对应的同比或环比，并额外应用业务类型和云服务排除项。统计期间、区域、客户分类和重点国代作用于全部合计指标。切换两项专用筛选时，折扣本期及变化值重新取数，其他指标继续使用当前通用条件下的汇总。

用 `pnpm dev:dqe` 启动本地环境。打开 `/pages/business-result-metrics?region=&mtime=month:2026-10`，先切换业务类型及云服务排除项，再切换客户分类及区域。浏览器回归 `pnpm --filter playground test:ioc business-result-summary-time.browser.ts` 检查独立汇总请求、两表行值及固定闭环谓词。用 `-g "shows each pinned total row"` 单独重跑延迟回执场景，检验两张表在 DQE 回执前显示「合计」，回执后原位显示数值。重点国代由运行时测试提供合成授权名单，真实名单和生产 DQE 按集成环境复验。

## 慢速定稿与折扣回填

打开 `/pages/business-result-metrics?region=`。定稿日期等待时默认按「月」显示月环比表头，切换「季」或「年」会立即显示相应同比列。切回「月」时表头先切换，相关月度查询等待定稿日期。已返回的明细先显示，等待中的折扣值用单元格骨架占位，返回后在原行填入。

运行 `pnpm --filter playground test:ioc business-result-slow-period.browser.ts`，通过合成 DQE 分别控制定稿、折扣返回，并验证同一天新浏览器页面复用定稿、跨日与工作区变化重新请求。该场景使用同一份页面配置，查询响应为合成数据。

## 验证与环境

业务查询需要真实 DQE 入口和身份，区域筛选需要可信组织候选。业务类型候选由页面内联声明。Playground 合成回执仅用于交互与查询请求验收，页面 JSON 不保存凭证。

查询组装与组件自动化测试显式使用合成回执，已覆盖多查询合计、区域/时间绑定、空行、失败及 Excel 导出；此前本地合成浏览器验收覆盖两条合计、选择地区部和异常隐藏。它们不代表真实 DQE 授权、指标聚合或部署已验证。当前用户会在内网完成真实取数验证。

既有明细列点击写入层级、目标详情页及客户分类/重点国代的真实业务绑定保留，未以合成测试证明真实服务行为。
