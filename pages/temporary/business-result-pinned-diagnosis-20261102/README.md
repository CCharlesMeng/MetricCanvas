# 业务结果指标：独立合计与 IOC 页头

入口：http://localhost:5174/pages/business-result-metrics

本页为 Dashboard，根级 iocHeader 认领统计期间、区域、客户分类和重点国代开关。区域为可搜索单选组织树，保留原 geo / region-dept / office 层级。各图原有独立筛选保留。

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

页面不注册模拟网关，全部 14 个数据源使用 query/dqe，无 inline 数据、initial 或内嵌数据行。Playground 默认运行时须注入真实 DQE 入口、身份与组织候选；缺少可信组织候选时会停在等待筛选状态。页面 JSON 不保存凭证。

查询组装与组件自动化测试显式使用合成回执，已覆盖多查询合计、区域/时间绑定、空行、失败及 Excel 导出；此前本地合成浏览器验收覆盖两条合计、选择地区部和异常隐藏。它们不代表真实 DQE 授权、指标聚合或部署已验证。当前用户会在内网完成真实取数验证。

既有明细列点击写入层级、目标详情页及客户分类/重点国代的真实业务绑定保留，未以合成测试证明真实服务行为。
