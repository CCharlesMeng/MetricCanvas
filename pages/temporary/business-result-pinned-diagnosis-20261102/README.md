# 业务结果指标：独立合计与 IOC 页头

启动 `pnpm dev:playground`，打开 `/pages/business-result-metrics`。

本页为 Dashboard，根级 iocHeader 认领统计期间、区域、客户分类和重点国代开关。区域为可搜索单选组织树，保留原 geo / region-dept / office 层级。各图原有独立筛选保留。

「净商务折扣执行情况」右上角的业务类型树使用内联候选。选择「华为公有云CORE」按 `业务类型编码` 查询；展开并选择「公网REGION」按 `子业务类型编码` 查询；选择「全部业务类型」省略该条件。绑定覆盖图表主值、整体均值和月／季／年变化查询。旁边的「云服务排除项」打开后读取首批 10 条，滚到底继续读取下一批，选择的服务按 `!=` 下推。

自动验收入口为 `pnpm --filter playground test:ioc business-type-levels.browser.ts source-candidate-window.browser.ts`，测试使用合成响应。接入真实 DQE 后需核验新字段在五个查询中的可用性及云服务分页的结果总数。

## 图表标题和筛选工具栏

用 `pnpm dev:dqe` 启动 Playground 和 DQE Sim，打开 `/pages/business-result-metrics?region=R99&region.level=geo`。Region 为「中国」时，「决策意见闭环率」标题和右侧「商务 / 合同」下拉同排，「框架执行情况」仅显示标题。清空区域以取消范围限制后，两张卡的标题各自独占第一行。「决策意见闭环率」第二行左侧显示「中国区 / 海外」，右侧显示「商务 / 合同」。「框架执行情况」第二行仅显示左侧切换。切回「中国」恢复初始行位。

浏览器回归为 `pnpm --filter playground test:ioc composite-card-header.browser.ts`。场景使用业务页面原配置和本地仿真响应，验证标题与筛选控件的位置。

## 合计取数

两表首行固定显示“合计”，不占明细数量。每个范围声明三条独立普通 complete query，所有 output_dims 均为空、time.is_aggregate=true，不使用 limit/offset：

| 范围 | 主指标查询 | 商务/合同闭环查询 | 条件 |
| --- | --- | --- | --- |
| 地区部合计 | region-dept-summary | region-dept-commercial-summary / region-dept-contract-summary | 仅 mtime |
| 代表处合计 | rep-office-summary | rep-office-commercial-summary / rep-office-contract-summary | mtime + region |

主查询使用原四个 DQE 指标名：净商务折扣（原价）、框架执行率、重大高风险合同率、云计算BU禁止条款风险合同率。另两条使用同一原始指标“决策闭环任务总体闭环率(投标-商务-合同)”，分别固定决策业务类型为商务、合同。页面不增加 ratio、grandTotal 或分子分母聚合逻辑。原明细的 pivot 和 joinAggregate 保留，仅展开并补列。

地区部合计不订阅区域选择；代表处合计使用原 levelQueryFields 映射，选择地区部时发送 region_dept_code 与其原始编码。Header 选 office 时沿现有更窄的 office 条件，并未新增“由代表处反查父地区部”能力。

## 必要的协议增量

Schema 6.79：props.pinnedTop.additionalData 声明额外独立单行查询槽；列级 pinnedTop.text 为固定文字，与 field 绑定分支互斥。原单槽声明保持。主槽零行不生成汇总，额外合法空槽只显示对应缺项；任意槽失败/多行/不完整时保留明细并拒绝完整 Excel。此 JSON 需要同步本工作树中的 6.79 运行时，不能只复制到旧引擎并声称兼容。

## 验证与环境

业务查询需要真实 DQE 入口和身份，区域筛选需要可信组织候选。业务类型候选由页面内联声明。Playground 合成回执仅用于交互与查询请求验收，页面 JSON 不保存凭证。

查询组装与组件自动化测试显式使用合成回执，已覆盖多查询合计、区域/时间绑定、空行、失败及 Excel 导出；此前本地合成浏览器验收覆盖两条合计、选择地区部和异常隐藏。它们不代表真实 DQE 授权、指标聚合或部署已验证。当前用户会在内网完成真实取数验证。

既有明细列点击写入层级、目标详情页及客户分类/重点国代的真实业务绑定保留，未以合成测试证明真实服务行为。
