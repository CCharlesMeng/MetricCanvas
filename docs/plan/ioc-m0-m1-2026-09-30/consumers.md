# 五页消费者验收基线

来源：第一批报告，自述源 commit a260c10744add7fe013d5e4591fa1ecc407f8083；本地未读内部仓。下文 R 行号定位原报告，完整上下文见 source-consumers.md；源文件位置是报告提供方声明。字段集写在同一格的每个字段均属于验收分母，不表示可省略。`*_xxx` 等占位不能算已闭合。

分类可并列：**可做**＝已有字段/业务依据，可推进目标对账；**内部补证**＝来源绑定/接口事实未知；**目标能力缺口**＝MetricCanvas 自己实施；**禁用**＝来源明确未启用；**延期**＝用户明确延期。可做不等于目标通过。除 verification 明示的财经三场景外，下面目标验收均 not-run。

## 客户详情 customer-detail

七锚点：总览、空间格局、经营进展、流水情况、客户活动、机会点、客户声音。顶部与基本信息纳入总览；三启用浮层是对应消费者的动作目标，不另算业务入口。

| 分区/消费者 | 启用字段或组件、数据源 | 动作/来源定位 | 分类；验收重点 |
|---|---|---|---|
| 顶部与七锚点 | customerId/customerName/from/mtime/site；标签 public_cloud_na_level_name/is_parent_company_name/is_breakthrough_customer | 日期刷新、返回；锚点只滚动；R207–223，config:74–82 | 可做；锚点0请求、返回由集成应用持有 |
| 总览·客户接触卡 | contact_risk_count/total_contact_count/kc_risk_count/total_kc_count；customer_kpi | split 卡；R225–235，config:250–272 | 可做；四数字与缺失显示分别对账 |
| 总览·客户声音卡 | voice_meeting_count/total_voice_count 配置；独立 QueryCustomerVoiceSummary 的 unresolvedcnt/allcnt | R229–235，component.config:256/285 | 内部补证；最终槽位与统计窗口，不能直接用customer_kpi覆盖 |
| 总览·客户项目卡 | risk_project_count ← high_risk_project_count | config:285–295 | 可做；次数与缺失 |
| 总览·客户合同卡 | risk_contract_count（报告称框架偏差金额） | config:296–306 | 内部补证；字段名像计数但报告称金额，需单位/绑定确认 |
| 总览·客户授信卡 | overdue_amount 配置；exceeded_amount.ptd_amt；secondary 实际 totalCreditBalance | R232–235/427–435，html:82–83 | 内部补证；主槽覆盖及余额真实窗口，不把credit_limit配置当运行绑定 |
| 总览·基本信息 | party_number/region_dept_name_cn_fin/rep_office_name_cn_fin/cloud_class/cloud_dev_dept_name；customer_basic_info | R237–245，html:98–113 | 可做＋内部补证；报告 where party_number=mtime 自相矛盾，需正确输入绑定 |
| 空间·整体空间 | Σ total_space_sum；customer_layout_detail | R247–262/C2；ts:325–333 | 可做；全null→null，0保留，元→万/年 |
| 空间·可参与空间 | participable_space_amt_sum；forecast | ts:345–351 | 可做；客户×月 |
| 空间·上年份额 | huawei_cloud_space_sum/total_space_sum；上年12月独立源 | ts:336–342 | 可做；0分母null、比例刻度显式 |
| 空间·堆叠图 | sub_business_name；huawei/alibaba/tencent/idc/aws/azure/google/others_space_sum | config:406–630；8系列+总计标签 | 可做；八系列不能少；全null不显示总计数 |
| 空间·表格 | subclass_name/space；华为云/阿里云/腾讯云/IDC/AWS/Azure/Google/其他8份额列 | R257–262；share_xxx_percent仍占位 | 内部补证；8列逐一输入→输出映射；合并列、空态 |
| 经营·年累计收入及同比 | rmb_ptd_amt/rmb_py_ptd_amt，annual_revenue；partyNumbers按站点确定 | R264–271/B5/C4 | 可做；混合null求和纠错，全null仍null；不可拿rev_ytd_amt替代 |
| 经营·年度目标与完成仪表 | annual_target_amt_sum；rev_ytd_amt/annual_target_amt_sum | forecast + finance，datasource:478–501 | 可做；已有匿名计算三场景，页面未验 |
| 经营·年度预测及GAP | annual_forecast_revenue/forecast_target_gap ← rev_ytd_amt、stock_forecast_revenue_amt_sum、annual_target_amt_sum | 同上 | 可做；负收入、跨月不匹配、辅助失败需分别覆盖 |
| 经营·销毛额与销毛率仪表 | sgp_ytd_amt/gross_profit_rate | 同上 | 可做；分母0取null，负收入保留 |
| 经营·近12月缩略图 | period_id/rmb_ytd_amt/rmb_py_ytd_amt/rmb_ytd_amt_pop；business_progress_trend | R271/C5；点击放大 | 目标能力缺口；按期groupAggregate，实际查询当年01..页面月，不凭标题补12点 |
| 经营·放大浮层 | 同一趋势快照，柱收入+线同比 | F3；html:227/614–623 | 可做；snapshot打开0请求，复用数值 |
| 流水·总流水及较上月/去年 | revenue_amt_sum/revenue_pop_diff/revenue_pop/revenue_yoy_diff/revenue_yoy | R273–283/C6；customer_revenue_base | 可做；直接减法缺失保护，0/null逐消费者 |
| 流水·公网Region CAGR | cagr_beginning_value_public_region_sum/cagr_ending_value_public_region_sum/cagr_periods_public_region | C6，commercial-market.config:407–411 | 可做；有限结果，异常基期不显示Infinity |
| 流水·双年趋势及业务类型 | mtime/revenue_amt_sum→current_year_revenue/last_year_revenue/growth_rate | C7；系统当前年；业务类型树 | 目标能力缺口；查询窗口与展示参考年分离，重复月择取策略待评审 |
| 流水·云服务明细表 | cloud_service_name/revenue/month_over_month/month_over_month_amount/year_over_year/year_over_year_amount/revenue_ratio；cloud_service | R285–303/C8；原值排序、本地分页10、趋势/明细 | 可做＋目标能力缺口；固定合计、动作按行种类绑定 |
| 流水·云服务固定合计 | cloud_service_summary；Σcur/pre/yoy，ratio=1 | C9；空明细也呈现；两动作选择全部服务 | 目标能力缺口；不进主行集、页大小、序号、排序 |
| 流水·云服务趋势浮层 | mtime/revenue_amt_cny_sum/pre_revenue_amt_cny_sum→双柱+双环比线 | F1/C10；service code或全部 | 目标能力缺口；页面年窗口，最大有效数据年展示，不能统一系统年 |
| 流水·云服务明细浮层 | DTIME/PARTY_NUMBER_CODE/END_CUST_OFFICE/CUSTOMER_NAME_C/CBP_CDH_NUMBER/CBP_CUSTOMER_COMPANY_NAME/PRODUCTCLASSNAME/CURINCOME；Sum.CURINCOME；Count.count | B11/F2；服务名称或全部、页面月起止、cdhCodes；查询分页 | 内部补证＋目标能力缺口；列式同序/同长，三返回集，同口径固定合计；明细空隐藏合计 |
| 活动·全年分类指标 | activity_total_count/senior_visit_count/company_visit_count/tech_exchange_count/senior_summit_count/circle_activity_count/routine_visit_count/poc_test_count/other_activity_count | R305–312；customer_activity_summary | 可做；9列逐一对账，中文活动类型匹配 |
| 活动·最近活动 | activity_theme/activity_date/activity_type/customer_participants/huawei_participants | customer_activity_details，取首行 | 可做；空态“暂无最近活动”，不伪造人员 |
| 活动·最近关系分析会 | meeting_theme/meeting_time/meeting_organizer/meeting_participants | customer_meeting，取首行 | 可做；空态“暂无最近会议” |
| 机会点·查询表 | project_name/project_stage/project_approval/project_level/analysis_meeting_time/total_budget/current_progress/year_forecast；jan_forecast..dec_forecast | R314–333；details/summary/count三源，动态年表头 | 目标能力缺口；20列＋合计/总数；全null年预测0，月字段仍null |
| 机会点·名称导航 | party_number/mtime/opportunity_code | B9/E；报告明细未查询opportunity_code | 内部补证；缺必需标识拒绝导航，不能用undefined形成可用入口 |
| 声音·查询表 | customername/incidentid/type/root_cause_id/level/customerlevel/simpledescribe/detaileddescribe/status/createtime/currenthandlerid/updatetime/sourcename/solvedtime/datacentername/creatorid；totalrecordcnt | R335–341/B10；中国/国际站源切换，服务端分页 | 内部补证；16列数组关联保证，窗口/总数；失败不变空集 |
| 禁用链接集合 | KPI详情、查看客户360、更多活动、分析会详情 | html:31–35/102–104/415–417/465–467 | 禁用；不恢复死代码入口 |
| 客户接触详情浮层 | 不绑定、不查询、不填数据 | F4；用户已延期 | 延期；不算通过；不影响其他长期未接触列表范围 |

## 经营概览 business-overview

| 消费者 | 字段/源、动作、来源 | 分类与验收 |
|---|---|---|
| 头部7类筛选 | 重点国代/币种/日期/产业/地区/客户级别/业务类型；R649–658 | 可做；三种日期截断分别绑定，不复制SQL |
| 收入卡 | income_express_data rmb_ytd_amt/usd_ytd_amt/yoy_y；点击business-revenue?tab=income | 可做；缺值不导航；金额与同比分开验 |
| 目标完成率卡 | budget_completion_y_ratio | 可做；刻度按消费者 |
| 公有云流水卡 | gyy_revenue 当期/上期/同期；gyy_revenue_value、mom、yoy | 目标能力缺口；calcMom基期0/null返回0 |
| 公网Region流水卡 | public_region_revenue 对应value/mom/yoy | 目标能力缺口；同上，固定6期CAGR不能套客户可变期数 |
| 销毛率卡 | sales_rate_data.ytd_amt/yoy_y | 可做＋内部补证；ANA精确显示 |
| 销管费用卡 | sales_value_data.rmb_ytd_amt/usd_ytd_amt/yoy_y | 可做；币种映射 |
| 逾期AR槽位/卡数量 | overdue_value及yoy为field空串；“5卡”表列7项 | 内部补证；需完整启用模板，未绑定不自动认定禁用或补0 |
| 全球/区域地图 | 收入/完成率/销毛率/同比/月流水/环比，region/repOffice两层；R671–677 | 可做＋内部补证；地图字典/阈值及三源键；下钻/全屏 |
| 经营概览Tab表 | AreaColumns；overview_table_data + salesRate_table_data，C1 | 内部补证＋目标能力缺口；完整逐列绑定，键并集、同指标后项覆盖 |
| 公网Region流水Tab表 | regionColumns；public_region_revenue_table | 内部补证；逐列/默认排序、筛选、Tab保留状态 |
| 下降NA Tab表 | downColumns；customer_revenue_down_table；客户导航用行party_number+页面mtime | 内部补证；逐列及导航必需字段 |
| 增长NA Tab表 | growColumns；customer_revenue_top_table；同上 | 内部补证；逐列及导航必需字段 |
| 收入TOP10NA、NA/SMB死链接 | show=false/模板无绑定，R689/E2/E3 | 禁用；4个已知启用Tab，不能造第5个 |

## 项目主页 project-overview

| 消费者 | 字段/源、动作、来源 | 分类与验收 |
|---|---|---|
| 头部与期间 | 重点国代/月份/产业/区域；A0/C5 | 可做；页面年窗口，显式参数传递 |
| 机会点数及增量 | valid_opportunity_cnt_sum/last_valid_opportunity_cnt_sum；跳机会点列表 | 可做；直接减法缺失→null |
| 总预签金额及增量 | bidding_amount_sum/last_bidding_amount_sum | 可做；原值数值排序 |
| 年销售预测 | product_yearly_fee_sum | 可做；金额原单位 |
| 管道支撑率卡 | effective_opportunity_remaining_amount_current_sum/(target-realized-flow)；Sum三源 | 可做；0分母0，负分母保留，缺匹配按消费者规则 |
| 分层管理四项 | projected_opportunity_cnt_sum/edproject_opportunity_amount_sum/立项率/赢单率 | A2题称3卡实列4项 | 可做＋内部补证；完整模板数量；立项率卡零基期null |
| 复盘两项 | should_review_project_cnt_sum/reviewed_project_cnt_sum | 可做；原计数 |
| 地图两层 | 管道支撑率/机会点数/预签金额/年预测，点击地区→代表处→清单 | A4/C1 | 内部补证；值域、阈值比例刻度 |
| 概览表 | OverviewColumns：排名/代表处/预签金额/管道支撑率/立项率；flow/target/realized | A5/B2–4 | 内部补证；两套区域键值域，不靠字段相似关联；表立项率零基期0 |
| TOP已立项项目表 | AlreadyInitiatedColumns；project_initiation_name/project level/bidding_amount_sum/amount_estimated_sum/winodds；其余源字段见B5 | A5/B5；详情/查看清单 | 内部补证；完整列、routeFilterParams与projectInitiationStatus矛盾 |
| 丢单项目表 | LostOrderProjectColumns；opportunity_name/project level/bidding_amount_sum/lost_order_reason；其余见B5 | A5/B5；详情/清单，CSSC | 可做＋内部补证；完整列；CSSC显式传递；详情取页面月 |

## Token专项 token-specific

| 消费者 | 字段/源、动作、来源 | 分类与验收 |
|---|---|---|
| 日筛选与昨日/7天/30天Tab | dtime/initTime，HOUR/DAY；R1033–1043 | 可做＋目标能力缺口；日期控件只影响昨日，窗口与模式同时切换 |
| 客户数、7天日均千万客户数卡 | customer_count/pre_customer_count/seven_customer_count/pre_seven_customer_count | 可做；两卡比率缺失保留 |
| Token消耗总量卡 | total_tokens_sum与prev/7days/30days_ago_sum | 可做；先Σ后比率，有限模式选字段 |
| Token总流水卡 | revenue_amt_sum与prev/7days/30days_ago_sum | 可做；先Σ后比率，不把null算NaN |
| 客户分布饼及表 | name/value/percentage ← customerDistributionData | A3 | 可做；其他末位规则、零分母 |
| 消耗分布饼及表 | name/value/percentage ← tokenDistributionData | A3 | 目标能力缺口；TOP5＋其他，稳定排序、空名 |
| 总量使用趋势 | x_time/total_tokens_sum，hour用h_tag、day用dtime | A4 | 内部补证；h_tag形状；模型有效，局部时间控件无消费，不能声称已生效 |
| 近30天流水趋势 | tokenTrendData；补日和pop | F2/C相关 | 目标能力缺口；缺日null，重复日后项策略，不改默认reject |
| 开通表7列 | customerIndex/customer_name/account_name/token_turnover/model_name/token_used_amount/thumbTrend | A5 | 内部补证＋目标能力缺口；客户数总数、完整组、复合键和指定合并列 |
| 开通表查询交互 | 模型/排序/页码；searchKey；时间范围仅存状态无消费 | A5/D4–7 | 目标能力缺口；全量搜索在不改DQE约束下blocked，不以局部搜索替代 |
| 行趋势浮层 | account_name/model_name（合计全部模型）、x_time/total_tokens_sum；24小时/7日/14日 | A6/F1 | 内部补证＋目标能力缺口；完整配置、局部筛选与主页面隔离 |
| 表内趋势格 | trend_data JSON：x_time/hour/date矛盾 | A5/UNKNOWN | 内部补证；解析属于响应适配，不在widget JSON.parse |

## 机会点清单 opportunity-list

| 消费者 | 字段/源、动作、来源 | 分类与验收 |
|---|---|---|
| 入口/头部筛选 | type/headerFilter；产业/重点国代/行业/地区/客户级别/超期/预签区间/阶段 | A0/A3/A4 | 可做；集成应用解析入口参数，不保留SQL拼接 |
| 主表列配置 | R1238–1270：28命名列＋jan..dec=40，报告称36且标题指备用子组件 | 内部补证；完整逐列原文见source-consumers，不用40自动认定主模板数量 |
| 原值与格式 | bidding_amount/amount_estimated/winodds/forecast_jan..dec；ati_status/is_unupdated_opportunity | A2/C1 | 可做＋内部补证；null×100=0是来源表达式事实，ANA43/1精确输出未验 |
| 列头/日期筛选与排序 | create_time/update_time；状态/级别；金额与预测排序 | C2/C3/D | 目标能力缺口；逐项核对现有DQE可表达范围，不能移植IN字符串 |
| 查询分页及序号 | offset/limit/总数，序号offset+1+i | B1/C1 | 可做；窗口不二次slice |
| 全量搜索 | opportunity_name/party_company_name | A1/C4 | 目标能力缺口（范围约束blocked）；不能用查询第一页本地搜索通过AC-09 |
| 机会点名称导航 | opportunity_code + 行mtime → project-detail | E | 可做；页面202604/行202603取202603，缺标识拒绝 |
| 客户列导航 | clickable:false，存在死代码 | A2 | 禁用；补主模板证据前不恢复 |

## 覆盖计数及 AC 去向

客户详情：7锚点、5个KPI配置卡、8空间系列/份额、经营4指标+2仪表、3启用详情、活动9字段、声音16列、机会点20列为当前报告可数对象；槽位覆盖/未知绑定均单列。经营概览5/7卡、项目分层3/4项、机会点36/40且模板冲突仍是内部补证，禁止给统一“已覆盖百分比”。源数据字段不等于启用列，B5等完整输入不能代替模板。

AC-01/19→兼容；AC-02–08→经营/流水/概览/Token计算与时间；AC-09–15→表状态/三返回集/详情/Token分组；AC-16→上述启用导航；AC-17→所有格式消费者；AC-18→M4 SDD/浏览器；AC-20/21→M6创作和分发。AC-09完整行集搜索与查询分页全量搜索必须分开判定。所有AC的覆盖细项与本轮运行状态见 verification，不以映射代替通过。
