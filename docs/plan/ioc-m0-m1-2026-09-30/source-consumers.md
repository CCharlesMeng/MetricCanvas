# 来源报告五页逐消费者原文索引

以下为原报告R191–1380逐行节选，保留错误陈述，不是现行契约。原报告哈希见baseline.json。必须同时阅读consumers.md和第一批evidence README纠错；SOURCE-READ/EXECUTED仍为提供方声明。

```text
R191: ## 4. 客户详情（customer-detail）
R192: ## 客户详情（customer-detail）
R193: 
R194: > 证据基线：`a260c10744add7fe013d5e4591fa1ecc407f8083`
R195: > 组件：`CustomerDetailPageComponent`（operation-map/customer-detail/customer-detail-page.component.ts，852 行）
R196: > 模板：customer-detail-page.component.html（704 行）
R197: > 数据源：customer-detail.datasource.ts（1651 行）；组件声明：customer-detail-page.component.config.ts（1707 行）
R198: > 服务：customer-detail.service.ts（路由参数状态）
R199: > 入口参数（全部来自路由 queryParams，service.ts:59-86）：`customerId`、`customerName`、`mtime`、`site`、`from`、`public_cloud_na_level_name`、`is_parent_company_name`、`is_breakthrough_customer`。
R200: 
R201: ---
R202: 
R203: ### A. 页面与内容树
R204: 
R205: > 页面容器：`dv-canvas-lowcode`（数据渲染引擎），页面自有行集 = **无**；所有数据由各数据源 fitFunction 产出并经 `onGlobalVarChanged` 分发给子组件。容器仅承载 `<operation-map-header>` + 锚点 Tab + 各区块模板。
R206: 
R207: #### A0. 顶部
R208: | 节点 | 类型 | 绑定 | 源码 |
R209: |---|---|---|---|
R210: | operation-map-header | 头部件 | headerOpt（title=客户名称、breadcrumbsUrl=`/operation-map/{from}`、dateValue=mtime、showDatePicker=true） | ts:211-216；html:3-9 |
R211: | 标签行 | span.tag-item × N | tagInfos = [public_cloud_na_level_name, 父客户?, 已突破/未突破?].filter(Boolean) | ts:218-222；config.ts:36-63 |
R212: | 锚点 Tab（7 个） | ti-tabs | anchorTabs | config.ts:74-82；html:10-16 |
R213: 
R214: **锚点清单**（id / 标题 / 对应区块）：
R215: 1. `overview-anchor` 总览 → KPI 区
R216: 2. `customer-layout-anchor` 空间格局 → 空间格局区
R217: 3. `business-progress-anchor` 经营进展 → 经营进展区
R218: 4. `revenue-flow-anchor` 流水情况 → 流水情况区
R219: 5. `activity-meeting-anchor` 客户活动 → 活动/会议区
R220: 6. `opportunity-section-anchor` 机会点 → 机会点区
R221: 7. `customer-voice-anchor` 客户声音 → 客户声音区
R222: 
R223: 锚点行为：`goAnchor(isActive, tab)` 仅当 isActive 时 `document.getElementById(id).scrollIntoView({behavior:'smooth'})`（ts:834-842）。
R224: 
R225: #### A1. 指标卡区（5 卡）
R226: | 卡 | layout | primary 字段 | secondary 字段 | 单位 | 备注 |
R227: |---|---|---|---|---|---|
R228: | contact 客户接触 | split | 左 primary: contact_risk_count（联系人超长期未接触，人）；左 secondary: total_contact_count（总联系人，人）；右 primary: kc_risk_count（KC超长期未接触，人）；右 secondary: total_kc_count（总KC数量，人） | config.ts:250-272 |
R229: | voice 客户声音 | single | voice_meeting_count（未闭环工单数，次） | total_voice_count（总数，次） | config.ts:273-284 |
R230: | project 客户项目 | single | risk_project_count（超期项目数，个） | 无 | config.ts:285-295 |
R231: | contract 客户合同 | single | risk_contract_count（框架偏差金额） | 无 | config.ts:296-306 |
R232: | credit 客户授信 | single | overdue_amount（逾期总金额，单位动态 亿/万/元） | credit_limit（授信额度，万）——**注意**：HTML 中 secondary 对 credit 卡不走 dv-indicator，而是 `{{ totalCreditBalance | blank }}`（html:82-83），totalCreditBalance 来自额外 REST `/rest/cbc/cdidimensitydiservice/v1/customer/balances`（ts:282-303） | config.ts:307-319 |
R233: 
R234: - KPI 卡"详情"链接（onKpiCardDetailClick / onKpiCardDetailClickFromCard）**在模板中被注释**（html:31-35）→ **禁用**。
R235: - KPI 数据源 `customer_kpi`：graphql CUSTOMER_MAP_CUSTOMER_DETAILS，where `party_number=customerId and mtime=mtime`（datasource.ts:159-215）；fitFunction 将 10 个字段包装为列式数组（每字段 [值]）。`customer_voice_indicator_total`（QueryCustomerVoiceSummary，queryStartTime=201701，queryEndTime=mtime，mode=month）→ 字段 `unresolvedcnt`；`customer_voice_indicator`（同接口，start=end=mtime）→ 字段 `allcnt`（component.config.ts:256, 285）。`exceeded_amount`（AP_DM_CCC_IOC_IND_AR_REG_CUST，REPORT_ITEM_CODE_INPUT=["STD_AR_91320"]，BEGIN=END=mtime）→ 字段 `ptd_amt`（datasource.ts:275-331）。
R236: 
R237: #### A2. 基本信息区
R238: | 显示项 | 绑定字段 | 来源数据源 |
R239: |---|---|---|
R240: | 客户编码 | party_number | customer_basic_info（CUSTOMER_MAP_CUSTOMER_DETAILS，where party_number=mtime） |
R241: | 地区部/代表处 | region_dept_name_cn_fin / rep_office_name_cn_fin | 同上 |
R242: | 行业 | cloud_class | 同上 |
R243: | 拓展部 | cloud_dev_dept_name | 同上 |
R244: 
R245: html:98-113；datasource.ts:333-355。备注："查看客户360"链接被注释（html:102-104）→ 禁用。
R246: 
R247: #### A3. 空间格局区
R248: 指标行（3 项）：
R249: - 当年整体空间：`customerLayoutInfo.totalSpace` = Σ layoutSpaces（各业务子类 total_space_sum）→ `DataFilter TEN_THOUSAND+POINT_TWO+THOUSAND_SIGN` + 模板后缀"万"（ts:325-333；html:123）
R250: - 当年可参与空间：`participable_space_amt_sum`（PROJECT_MAP_CUSTOMER_REVENUE_FORECAST_M）→ 同上格式 + 万（ts:345-351）
R251: - 上一年份额：`lastYearLastMonthPercent` = DIVIDE(huawei_cloud_space_sum, total_space_sum)（customer_layout_last_year_huawei fitFunction，mtime=上年12月）→ ×100 → PERCENT_WITH_TWO_POINT（ts:336-342；datasource.ts:388-417）
R252: 
R253: 图表 `layout_stack_chart`（dv-echarts）：堆叠柱（华为云/阿里云/腾讯云/IDC/AWS/Azure/Google/其他 8 系列，色板 PIE_CHART_COLORS），x=业务子类，y=万/年；adapter 附加"总计"标签系列（对每点求和、TEN_THOUSAND_CONST 换算显示），全部 null 时该点显示 ''（component.config.ts:406-630）。数据：`customer_layout_detail` fitFunction 映射 10 列（datasource.ts:419-468）。
R254: 
R255: 表格 `layoutDetailSrcData`（ti-table，无分页）：
R256: | 列 | 字段 | 格式 |
R257: |---|---|---|
R258: | 业务子类（rowSpan，固定左） | subclass_name | blank |
R259: | 空间(万/年)（rowSpan） | space | TEN_THOUSAND+POINT_TWO+THOUSAND_SIGN（null→'--'） |
R260: | 份额 8 列（colSpan 表头：华为云/阿里云/腾讯云/IDC/AWS/Azure/Google/其他） | share_xxx_percent | 每列 = DIVIDE(share_xxx[i], space[i])×100 → PERCENT_WITH_TWO_POINT（null→'--'） |
R261: 
R262: ts:306-367；config.ts:137-159；html:115-209。空数据显示"暂无数据"（html:196-202）。
R263: 
R264: #### A4. 经营进展区
R265: 指标块（4 块）：
R266: 1. **年累计收入**：primary = `rmb_ptd_amt`（Σ 各 row.rmb_ptd_amt，全 null 则 null），secondary 同比 = `rmb_ptd_amt_yoy` = DIVIDE(SUBTRACT(rmb_ptd_amt, rmb_py_ptd_amt), rmb_py_ptd_amt)×100。数据源 business_progress_annual_revenue（REST IOC_CDI_Customer360_DM_CCCRG_IOC_PL_CUST，CUST_CODE=partyNumbers，START=当年01月，END=mtime，REPORT_ITEM_CODE=["CCC_PL_91000","GEO_PL_91000"]）（datasource.ts:536-616）。partyNumbers 组装见 onGlobalVarChanged（ts:254-257）：oversea/europe 站用 [customerId]，否则用 party_number_cdh_code 查询返回的父子 party_number 去重集合。
R267: 2. **年度目标**：primary = `annual_target_amt_sum`（PROJECT_MAP_CUSTOMER_REVENUE_FORECAST_M，mtime=页面月）。附仪表 `target_complete_gauge`：值 = `target_completion_rate` = DIVIDE(rev_ytd_amt, annual_target)×100（datasource.ts:491-492）。
R268: 3. **年度预测**：primary = `annual_forecast_revenue` = rev_ytd_amt + stock_forecast_revenue_amt_sum（本年剩余月份存量预测_当月）；secondary GAP = `forecast_target_gap` = annual_forecast_revenue − annual_target_amt_sum。来源 business_progress_finance（REST CLOUDBI_AP_DM_CCCRG_IOC_PL_R2BD2BG_CUST_SORT，PERIOD_ID=mtime）（datasource.ts:470-534）。
R269: 4. **销毛额**：primary = `sgp_ytd_amt`；仪表 `sales_margin_gauge` 值 = `gross_profit_rate` = DIVIDE(sgp_ytd_amt, rev_ytd_amt)×100（datasource.ts:495-496）。
R270: 
R271: 趋势缩略图 `progress_trend_chart`：折线，x=`period_id`（yyyyMM 由 adapter 转 yyyy/MM），y=`rmb_ytd_amt`；数据源 business_progress_trend 按 period_id 分组聚合（rmb_ytd_amt / rmb_py_ytd_amt 求和）并计算 `rmb_ytd_amt_pop` 同比（datasource.ts:618-700）。点击缩略图 → `openThumbModal()` 打开大图浮层 `month_total_revenue_trend`（html:227, 614-623）——**复用同一数据源**（component.config.ts:957-1109，柱=收入、线=同比，adapter 将 period_id 转 yyyy/MM）。指标单位模板：`Math.abs(value)>=1e8?'亿':(>=1e4?'万':'元')`（component.config.ts:640 等）。年累计收入同比格式：ARROW_IN_FRONT_PERCENT_WITH_TWO_POINT + prefixSymbol '↑'（component.config.ts:678-686）。
R272: 
R273: #### A5. 流水情况区
R274: 指标行（4 项，来源 `customer_revenue_base` fitFunction，datasource.ts:702-752，where parent_party_number=customerId and mtime and currency）：
R275: - 总流水 `revenue_amt_sum` → 单位"万"（TEN_THOUSAND+POINT_TWO+THOUSAND_SIGN）
R276: - 较上月及环比：`revenue_pop_diff` = SUBTRACT(revenue_amt_sum, pre_revenue_amt_sum)；`revenue_pop` = DIVIDE(diff, pre)×100（null 保持 null）
R277: - 较去年及同比：`revenue_yoy_diff` = SUBTRACT(revenue_amt_sum, revenue_amt_yoy_sum)；`revenue_yoy` = DIVIDE(diff, yoy)×100
R278: - 公网Region复合增长率 `cagr_value` = getCAGR(cagr_beginning_value_public_region_sum, cagr_ending_value_public_region_sum, cagr_periods_public_region) = (Math.pow(ending/beginning, 1/periods)-1)×100（commercial-market.config.ts:407-411）
R279: 
R280: `revenue_trend_chart`（页面收入趋势，双柱+增长率线）：数据源 `customer_revenue_trend` fitFunction（datasource.ts:754-820）：
R281: - 按 `new Date().getFullYear()`（**系统当前年**）筛选当年/上年数据并各自按 mtime 排序；12 个月标签固定 ['1月'..'12月']；逐月取当年/上年数据（find 月份相等）；`current_year_revenue`/`last_year_revenue` = 该月 revenue_amt_sum（无则 null）；`growth_rate` = lastYearRevenue>0 且 currentRevenue!==null 时 (cur-last)/last×100，否则 null。
R282: - 查询窗口：mtime between revenueStartTime(上年01) and revenueEndTime(当年12)，附加 businessType SQL。
R283: - 业务类型树选择 `ti-treeselect`（businessTypeOptions，getBusinessTypeOptions）→ `onBusinessTypeChange` 生成 businessType SQL（config.ts 配套 `getBusinessTypeString`：level1→`and business_type_code='id'`；level2→`and business_type_code='pId' and sub_business_type_code='id'`）。
R284: 
R285: 云服务流水表格（`cloudServiceSrcData`，**前端分页+前端排序**，合计行置顶）：
R286: | 列 | 字段 | dataType | 显示格式 |
R287: |---|---|---|---|
R288: | 云服务（固定左） | cloud_service_name（null→'--'） | - | blank |
R289: | 流水 | revenue | money | formatMoney：COCKPIT_UNIT_NOSIGN_THOUSAND_SIGN（null→'--'） |
R290: | 环比 | month_over_month | trendRate | formatTrendRate：ARROW_IN_FRONT_PERCENT_WITH_TWO_POINT |
R291: | 环比增长量 | month_over_month_amount | moneyDiff | formatDiffMoney：COCKPIT_UNIT_NOSIGN_THOUSAND_SIGN + DATA_ADD |
R292: | 同比 | year_over_year | trendRate | 同上 trendRate |
R293: | 同比增长量 | year_over_year_amount | moneyDiff | 同上 moneyDiff |
R294: | 占比 | revenue_ratio | percent | formatPercent：值×100 → PERCENT_WITH_TWO_POINT |
R295: | 操作 | - | - | 趋势 / 明细 链接（合计行也显示，但点击时 cloud_service_name==='合计' → selectedCloudServiceCode=''、activeModelCloudServiceName=''） |
R296: 
R297: 数据源 `cloud_service`（CUSTOMER_MAP_SERVICE_REVENUE_DETAILS，where party_number & mtime；datasource.ts:822-900）：
R298: - revenue_ratio 由前端计算：DIVIDE(row.revenue_amt_cny_sum, Σ revenue_amt_cny_sum)（分母为总流水，非 100 分位）
R299: - 环比/同比**由查询侧函数计算**：`revenue_pop_cny` = case when (coalesce(pre_revenue_amt_cny_sum,0)=0 or revenue_amt_cny_sum is null) then null else 100*(revenue_amt_cny_sum-pre)/pre end；`revenue_pop_diff_cny` = revenue_amt_cny_sum − pre_revenue_amt_cny_sum；同比同理（revenue_yoy_cny / revenue_yoy_diff_cny）
R300: - 排序默认：cloudServiceDefaultSortKey='revenue'，asc=false（ts:148-149）。`frontendSortData`（ts:602-612）：null/undefined 的排到末尾（a null → return 1 即排后；b null → return -1）。**注意 null 判定不含 NaN/Infinity**（与 CommonUtil.frontendSortTableData 不同，后者含 NaN/Infinity）。
R301: - 分页：pageSize 固定 10（cloudServicePagination，ts:95）；排序变化时回到第 1 页（ts:724）；分页事件仅记录 currentPage/pageSize（ts:715-718）。触发排序/分页后 `processCloudServiceData` 重算（ts:727-729）。
R302: - 合计行 `cloud_service_summary`（datasource.ts:902-973）：Σ revenue_amt_cny_sum / pre / yoy；totalPop = DIVIDE(Σcur−Σpre, Σpre)×100；totalYoy 同理；revenue_ratio=1.0。空数据时合计行仍生成（revenue=0, ratio=1.0, 环比/同比 null）。
R303: - 主表展示：明细无数据时仅合计行存在 → 表格显示合计行；完全无数据时表格"暂无数据"（html:390-396，但合计行 data 非空时不触发）。
R304: 
R305: #### A6. 客户活动 / 客户关系分析会
R306: 客户活动指标表（`activityMetricsSrcData`，单行）：列 = 全年总次数(activity_total_count)、高层拜访(senior_visit_count)、公司考察(company_visit_count)、技术交流(tech_exchange_count)、高层峰会(senior_summit_count)、圈层活动(circle_activity_count)、例行拜访(routine_visit_count)、POC测试(poc_test_count)、其他活动(other_activity_count)。数据源 `customer_activity_summary` fitFunction（datasource.ts:1049-1094）：按 activity_type 分类汇总 current_year_activity_total_sum；`POC` 类型映射到 poc_test_count（活动类型字典见 constant/filtering-items-set.ts ActivityTypeItems：圈层活动=9、其他活动=5、例行拜访=1、技术交流=7、公司考察=6、高层峰会=8、高层拜访=2、商务宴请=3、华为参观=4；**注意 activity_type 直接以中文名匹配**）。
R307: 
R308: 最近活动（`app-recent-activity-detail`）：activity_theme/activity_date/activity_type/customer_participants/huawei_participants。数据源 `customer_activity_details`（CUSTOMER_MAP_CUSTOMER_ACTIVITY_DETAILS，where party_number & is_latest_activity=1）取 [0]（datasource.ts:1096-1132）。
R309: 
R310: 客户关系分析会：`app-recent-meeting-detail`：meeting_theme/meeting_time/meeting_organizer/meeting_participants。数据源 `customer_meeting`（CUSTOMER_MAP_CUSTOMER_RELATIONSHIP_MEETING_DETAILS，where is_latest_meeting=1，orderDesc is_latest_meeting）取 [0]（datasource.ts:1134-1174）。
R311: 
R312: 备注："更多活动"链接（onMoreActivityClick → activity-list）与"分析会详情"链接（onMeetingDetailClick → meeting-detail）**模板中均被注释**（html:415-417, 465-467）→ 禁用。空数据显示"暂无最近活动"/"暂无最近会议"。
R313: 
R314: #### A7. 机会点区（表格 + 分页 + 合计行）
R315: 列定义 `getOpportunityColumns(currentYear)`（config.ts:198-221）——**表头随年份动态**："{currentYear}年销售预测" 由 `initByTime` 传入页面 mtime 年份生成（ts:655, 657）。
R316: 
R317: | 列 | 字段 | 格式 |
R318: |---|---|---|
R319: | 机会点名称（固定左） | project_name | - |
R320: | 机会点阶段 | project_stage | - |
R321: | 立项情况 | project_approval | getAtiStatusLabel(ati_status)（project-detail.config.ts:165-179：Not_Initiated/无需立项→无需立项；Waiting_Ati/达标待立项→达标待立项；In_Project_Initiation/立项中→立项中；Initiated/已立项→已立项；其他→''） |
R322: | 项目级别 | project_level | - |
R323: | 项目分析会时间 | analysis_meeting_time | - |
R324: | 总预签金额 | total_budget（bidding_amount） | money |
R325: | 当前进展 | current_progress | - |
R326: | {currentYear}年销售预测 | year_forecast = Σ forecast_jan..dec（**前端求和**，datasource.ts:1189-1193，`(row.forecast_xx || 0)` 参与，null→0） | money |
R327: | 1月..12月销售预测 | jan_forecast..dec_forecast | money |
R328: 
R329: - 数据源 `customer_opportunity_details`（PROJECT_MAP_OPPORTUNITY_DETAILS_M，where party_number & mtime，limit=opportunityLimit(10)，offset=opportunityOffset，服务端分页）（datasource.ts:1176-1257）。
R330: - 合计行 `customer_opportunity_summary`（datasource.ts:1259-1345）：Σ bidding_amount_sum；year_forecast_sum = Σ forecast_xx_sum（前端，||0）；其余月同；合计行字段 project_name='合计'，其余文本 '—'，is_summary=true。**插入当页数据首行**（ts:434-437）。
R331: - 总数 `customer_opportunity_details_count`（cnt，同 where）（datasource.ts:1347-1361）。
R332: - 分页事件：onOpportunityTableStateUpdate 更新 currentPage/pageSize → opportunityLimit/OpportunityOffset（ts:732-742）。
R333: - 每行 `party_number`、`mtime` 保留（datasource.ts:1216-1217），供跳转使用（见 E 节）。
R334: 
R335: #### A8. 客户声音区（表格 + 服务端分页）
R336: 列（16 列，config.ts:223-240）：用户名（华为云账号）customername、编号 incidentid、类型 type、问题归属方 root_cause_id、定级 level、客户权益等级 customerlevel、标题 simpledescribe、描述 detaileddescribe、状态 status、发生时间 createtime、当前责任人 currenthandlerid、更新时间 updatetime、反馈来源类型 sourcename、处理总时长 solvedtime、局点 datacentername、客户ID creatorid。
R337: 
R338: - 数据源：中国站 `customer_voice`（QueryCustomerVoiceDetail）、国际站 `customer_voice_intl`（CDI_IOC_Customer360_Voice_Detail_Intl）；**列式数组**（每字段一个数组），前端按 index 重组为行（ts:448-484）。选择规则：`site==='china'` 用 customer_voice，否则 customer_voice_intl（ts:446）。
R339: - 分页参数：PAGESIZE=voicePageSize(10)、OFFSET=voiceOffset、orderBy=createtime、orderType=DESC（datasource.ts:56-92）。
R340: - 总数：`totalrecordcnt` 列式数组 [0]（ts:486-487）。
R341: - 窗口：voiceQueryStartTime=当年当月01、voiceQueryEndTime=当年当月最后一天（ts:662-666）。**注意**：currentMonthEndDay 被错误赋值为 voiceQueryStartTime（ts:667），授信卡 getCreditInfo 使用 start=end=当月01。
R342: 
R343: #### A9. 浮层（详见"浮层清单"）
R344: - 云服务趋势浮层 `trend_modal_chart`
R345: - 云服务明细浮层 `incomeDetailSrcData` 表格
R346: - 月累计收入趋势放大浮层 `month_total_revenue_trend`
R347: 
R348: ---
R349: 
R350: ### B. 查询返回之后的输入契约
R351: 
R352: #### B1. CUSTOMER_MAP_CUSTOMER_DETAILS（客户信息/基本信息/KPI）
R353: - 消费者：基本信息区、KPI 卡、标签
R354: - 返回结构：graphql `resultType: mapArray`（对象数组，单行）
R355: - 字段（datasource.ts:140-155, 198-211, 340-351）：data_site_type(字符串 中国站/国际站/欧洲站)、is_parent_company_name(1/0/'父客户')、party_number、party_company_name、public_cloud_na_level_name、public_cloud_na_level、is_breakthrough_customer(1/0/'是'/'否')、mtime、contact_person_long_no_contact、contact_person_total、kc_long_no_contact、kc_total、service_conference_this_month、service_conference_year_total、high_risk_project_count、risk_contract_count、overdue_amount、customer_credit_limit、region_dept_name_cn_fin、rep_office_name_cn_fin、cloud_class、cloud_dev_dept_name
R356: - 行粒度：客户×月（mtime）；唯一键：party_number+mtime
R357: - 排序：无保证（查询侧未排序）
R358: - 可空性：KPI 字段空时 fitFunction 填 '--'（datasource.ts:181-190）
R359: - 单位：金额类原始单位为元（展示时按 亿/万/元 动态换算）；overdue_amount 原始单位元
R360: 
R361: #### B2. CUSTOMER_MAP_MARKET_SHARE_DETAIL（空间格局）
R362: - 消费者：空间格局指标、堆叠图、格局表格
R363: - 返回：mapArray；字段：sub_business_name、total_space_sum、huawei_cloud_space_sum、alibaba_cloud_space_sum、tencent_cloud_space_sum、idc_space_sum、aws_space_sum、azure_space_sum、google_space_sum、others_space_sum、party_number、mtime
R364: - 两个独立查询：`customer_layout_detail`（mtime=页面月）、`customer_layout_last_year_huawei`（mtime=上年12月 layoutLastYearLastMonth）
R365: - 单位：空间金额元（展示万/年）；份额 = 比例（0.5 = 50%，前端×100 后 PERCENT_WITH_TWO_POINT）
R366: 
R367: #### B3. PROJECT_MAP_CUSTOMER_REVENUE_FORECAST_M（目标/预测/可参与空间）
R368: - 消费者：空间格局可参与空间、经营进展年度目标、年度预测 GAP、本年剩余存量预测
R369: - 字段：participable_space_amt_sum、annual_target_amt_sum、stock_forecast_revenue_amt_sum、mtime（datasource.ts:373-384）
R370: - 唯一键：party_number+mtime；单行
R371: 
R372: #### B4. CLOUDBI_AP_DM_CCCRG_IOC_PL_R2BD2BG_CUST_SORT（财经损益-客户）
R373: - 消费者：年度预测、GAP、销毛额、销毛率、目标完成率
R374: - REST 入参：END_PARENT_PARTY_NUMBER_INPUT=customerId、PERIOD_ID_INPUT=mtime、CURRENCY_CODE=currency('RMB')
R375: - 字段：rev_ytd_amt（年累计收入）、rev_yoy_y（收入年同比）、sgp_ytd_amt（销毛额年累计）
R376: - 派生：annual_forecast_revenue、forecast_target_gap、target_completion_rate（×100）、gross_profit_rate（×100）（datasource.ts:478-501）
R377: - 空结果 → [{}]（datasource.ts:498-500）→ 派生字段 undefined → dv-indicator 显示空
R378: 
R379: #### B5. IOC_CDI_Customer360_DM_CCCRG_IOC_PL_CUST（年累计收入/近12月趋势）
R380: - 消费者：年累计收入指标卡 + 同比 + 趋势缩略图 + 放大浮层
R381: - REST 入参：CUST_CODE=partyNumbers（JSON 数组字符串）、START_PERIOD_ID=当年01月、END_PERIOD_ID=mtime、REPORT_ITEM_CODE=["CCC_PL_91000","GEO_PL_91000"]
R382: - 字段：rmb_py_ptd_amt（去年同期月累计-人民币）、rmb_ptd_amt（月累计收入-人民币）、rmb_py_ytd_amt（去年同期月累计-人民币，趋势用）、rmb_ytd_amt（月累计收入-人民币，趋势用）、period_id（yyyyMM，orderAsc）、cust_cn_name
R383: - 派生（年累计卡 fitFunction）：Σ rmb_ptd_amt（**全 null 判空：every(isNull) → null，否则求和**，datasource.ts:552-553）；rmb_ptd_amt_yoy = DIVIDE(SUBTRACT(cur,py),py)×100
R384: - 派生（趋势 fitFunction）：按 period_id 分组 → 组内非 null 值求和（全 null → null）→ rmb_ytd_amt_pop 同比×100；按 period_id 排序输出
R385: - 行粒度：客户×月×report_item；排序：period_id orderAsc（true, priority 1）
R386: 
R387: #### B6. IOC_OPERATION_MAP_CUSTOMER_REVENUE_DETAILS（流水卡/页面趋势）
R388: - 消费者：流水 4 指标 + 页面收入趋势图
R389: - 查询条件（卡）：parent_party_number=customerId and mtime=mtime and currency='RMB'；字段 revenue_amt_sum、pre_revenue_amt_sum、revenue_amt_yoy_sum、cagr_ending_value_public_region_sum、cagr_beginning_value_public_region_sum、cagr_periods_public_region（字符串期数）
R390: - 查询条件（趋势）：parent_party_number=customerId and mtime between 上年01 and 当年12 and currency and businessTypeSQL；字段 revenue_amt_sum、mtime（orderAsc）
R391: - 派生（卡）：revenue_pop_diff、revenue_pop(×100)、revenue_yoy_diff、revenue_yoy(×100)、cagr_value（期数 Number(periods)）
R392: - 派生（趋势）：见 A5 —— **双年对齐以系统当前年为准（`new Date().getFullYear()`）**；月份 find 无排序保证时依赖查询 orderAsc(mtime)
R393: - 单位：元（展示万）
R394: 
R395: #### B7. CUSTOMER_MAP_SERVICE_REVENUE_DETAILS（云服务流水 明细+合计+趋势）
R396: - 消费者：云服务流水表格（明细+合计）、趋势浮层
R397: - 明细查询 where：party_number=customerId and mtime=mtime；字段 cloud_service_type_name、cloud_service_type_code、revenue_amt_cny_sum、pre_revenue_amt_cny_sum、revenue_amt_yoy_cny_sum、revenue_pop_cny(查询侧函数)、revenue_pop_diff_cny(查询侧)、revenue_yoy_cny(查询侧)、revenue_yoy_diff_cny(查询侧)、party_number、mtime
R398: - 合计查询：同 where，仅 6 字段（不含比率函数），比率前端算
R399: - 趋势查询 where：party_number=customerId and mtime between trendStartTime(上年01) and trendEndTime(当年12) + ` and cloud_service_type_code='xxx'`（行非合计时）；字段 revenue_amt_cny_sum、pre_revenue_amt_cny_sum、mtime（orderAsc）
R400: - 金额单位：人民币元（cny）
R401: 
R402: #### B8. CUSTOMER_MAP_CUSTOMER_ACTIVITY_SUMMARY / _DETAILS / CUSTOMER_MAP_CUSTOMER_RELATIONSHIP_MEETING_DETAILS
R403: - 消费者：活动指标表、最近活动、最近会议
R404: - 字段见 A6；活动明细 where 附加 is_latest_activity=1；会议 where 附加 is_latest_meeting=1（orderDesc is_latest_meeting）
R405: - 活动类型字典：中文名匹配（见 A6 备注）
R406: 
R407: #### B9. PROJECT_MAP_OPPORTUNITY_DETAILS_M（机会点明细+汇总+总数）
R408: - 消费者：机会点表格、合计行、总数
R409: - 查询：where party_number=customerId and mtime=mtime；limit=10、offset 服务端分页
R410: - 字段：opportunity_name、opportunity_step_name、ati_status、project_initiation_level、latest_analysis_meeting_time、bidding_amount、project_progress、forecast_jan..dec、party_number、mtime；汇总查询用 bidding_amount_sum、forecast_xx_sum；总数查询用 cnt
R411: - 派生：year_forecast=Σ月预测（||0）
R412: - 唯一键：opportunity_code 不在本查询字段中（明细表无 opportunity_code！跳转 project-detail 时 opportunity_code 传 undefined——见 E 节）
R413: 
R414: #### B10. QueryCustomerVoiceDetail / CDI_IOC_Customer360_Voice_Detail_Intl（客户声音）
R415: - 消费者：客户声音表格
R416: - 返回：**列式数组**（incidentid[]、customername[]、type[]、root_cause_id[]、level[]、customerlevel[]、simpledescribe[]、detaileddescribe[]、status[]、createtime[]、currenthandlerid[]、updatetime[]、sourcename[]、solvedtime[]、datacentername[]、creatorid[]、totalrecordcnt[]）
R417: - 入参：PARTY_NUMBER、queryStartTime、queryEndTime、PAGESIZE、OFFSET、orderBy=createtime、orderType=DESC
R418: - **列式数组错配风险**：若接口数组乱序/长度不一致，前端按 index 拼接会错配（UNKNOWN，需接口契约）
R419: 
R420: #### B11. CDI_IOC_Customer360_Income_Detail / _Sum / _Count（云服务明细浮层）
R421: - 消费者：明细浮层表格（明细+合计）+ 总数
R422: - API 入参（datasource.ts:1399-1460, 1479-1548, 1581-1650）：PARTY=1、DTIME=1、CURINCOME=1、CBP_CDH=1、CBP_NAME=1、CUSTNAME=1、END_CUST_OFFICE=1、cloudServiceFC=10、TIMEMODE=M、ORDERBY=CURINCOME、ORDERTYPE=DESC、CDH_V=cdhCodes（`|` 拼接）、SERVICE_NAME=selectedCloudServiceName、STARTTIME/ENDTIME=当月 01..月末、PAGESIZE、OFFSET
R423: - 返回：列式数组 DTIME[]、PARTY_NUMBER_CODE[]、END_CUST_OFFICE[]、CUSTOMER_NAME_C[]、CBP_CDH_NUMBER[]、CBP_CUSTOMER_COMPANY_NAME[]、PRODUCTCLASSNAME[]、CURINCOME[]；Sum 返回 CURINCOME 合计（列式）；Count 返回 count
R424: - 排序：查询侧 ORDERBY=CURINCOME DESC（**服务端按流水倒序**）
R425: - 单位：CURINCOME 元；展示 COCKPIT_UNIT_NOSIGN_THOUSAND_SIGN
R426: 
R427: #### B12. 授信余额 REST
R428: - `/rest/cbc/cdidimensitydiservice/v1/customer/balances`；入参 partyNumber、startTime=currentMonthStartDay、endTime=currentMonthEndDay（=当月01）、site='1'
R429: - 返回：balance.totalCreditBalance；null → totalCreditBalance=null（显示空），否则 COCKPIT_WITHOUT_UNIT + 单位（≥1e8 亿 / ≥1e4 万 / 元）（ts:282-303）
R430: 
R431: #### B13. CDI_IOC_Customer360_Latest_CDH_CODE（CDH 编码）
R432: - 消费者：partyNumbers 组装（仅中国站等非 oversea/europe 站）
R433: - 入参：PARTY_NUMBER=customerId、PARENT_CUSTOMER=1；返回 CDH_CODE[]、party_number[]（去重后）；cdhCodes = CDH_CODE.join('|')（ts:268）
R434: 
R435: ---
R436: 
R437: ### C. 查询后计算与转换
R438: 
R439: #### C1. 空间格局份额占比
R440: 1. 页面/消费者：customer-detail / 空间格局表格 8 份额列 + 上一年份额指标
R441: 2. 源码：customer-detail-page.component.ts:318-342（dealMoneyPercentValue、lastYearLastMonthPercent）
R442: 3. 输入：share_xxx[i]、space[i]；lastYearLastMonthPercent（已由 datasource fitFunction DIVIDE 计算，datasource.ts:369, 400）
R443: 4. 处理：percent = DIVIDE(value, totalValue)；isNull → '--'；否则 ×100 → PERCENT_WITH_TWO_POINT
R444: 5. 输出：'xx.xx%' 或 '--'
R445: 6. 边界：total=0 → DIVIDE 返回 null（suffix===0 判定，calculate.ts:40）→ '--'；value=0 → '0.00%'
R446: 7. 验证：verification/verify-calculate.mjs（SOURCE-EXECUTED）
R447: 
R448: #### C2. 空间求和与展示
R449: 1. 页面/消费者：空间格局 / 当年整体空间指标
R450: 2. 源码：ts:326-332
R451: 3. 输入：layoutSpaces[]（各子类空间）
R452: 4. 处理：仅当数组含非 null/非 0 值时 reduce 求和（`filter(v => v || v===0).length`）→ TEN_THOUSAND+POINT_TWO+THOUSAND_SIGN
R453: 5. 输出：如 '1,234.56'（模板后缀"万"）；空数组 → null
R454: 6. 边界：全 null → totalSpace=null；含 0 → 参与求和
R455: 7. 验证：verification/verify-calculate.mjs
R456: 
R457: #### C3. 经营进展派生（财经）
R458: 1. 页面/消费者：经营进展 4 指标 + 2 仪表
R459: 2. 源码：datasource.ts:478-501
R460: 3. 输入：rev_ytd_amt、sgp_ytd_amt、annual_target_amt_sum、stock_forecast_revenue_amt_sum
R461: 4. 处理顺序：annual_forecast_revenue = rev_ytd + stock_forecast；forecast_target_gap = annual_forecast − annual_target；target_completion_rate = DIVIDE(rev_ytd, annual_target)×100；gross_profit_rate = DIVIDE(sgp_ytd, rev_ytd)×100
R462: 5. 输出：上述 4 值
R463: 6. 边界：DIVIDE 分母 0 → null；×100 仅当非 null
R464: 7. 验证：verification/verify-calculate.mjs
R465: 
R466: #### C4. 年累计收入求和与同比（双源数组）
R467: 1. 页面/消费者：经营进展 / 年累计收入卡 + 同比
R468: 2. 源码：datasource.ts:540-561
R469: 3. 输入：rows[{rmb_ptd_amt, rmb_py_ptd_amt}]
R470: 4. 处理：**先逐字段判全 null**（every isNull → null）再 reduce 求和；yoy = DIVIDE(SUBTRACT(cur,py),py)×100
R471: 5. 边界：单行 null 与其它行有值 → 该 null 行按 0 参与求和（**非跳过**！reduce 直接 +v，v=null 时结果为 NaN 的隐患——见 unknowns：`rmb_ptd_amt_array.reduce((s,v)=>s+v,0)` 遇 null 会得到 NaN，但仅当 every(isNull) 为 false 时执行；混合 null 场景输出 NaN → dv-indicator 显示异常，**待核实接口是否保证全有值**）
R472: 6. 验证：verification/verify-calculate.mjs
R473: 
R474: #### C5. 近12月趋势分组聚合
R475: 1. 页面/消费者：经营进展 / 缩略图 + 放大浮层
R476: 2. 源码：datasource.ts:622-650
R477: 3. 输入：rows[{period_id, rmb_ytd_amt, rmb_py_ytd_amt}]
R478: 4. 处理：groupBy period_id → 组内非 null 求和（全 null → null）→ 按 period_id 升序 → 每点 pop = DIVIDE(SUBTRACT(cur,py),py)×100
R479: 5. 输出：12 行（实际窗口当年01..mtime）
R480: 6. 边界：period_id 缺失/乱序 → 输出按字符串升序（'yyyyMM' 字典序=时间序）；缺月不补（区别于 Token 页 completeDailyData）
R481: 7. 验证：verification/verify-calculate.mjs
R482: 
R483: #### C6. 流水卡派生（环比/同比/CAGR）
R484: 1. 页面/消费者：流水情况 4 指标
R485: 2. 源码：datasource.ts:706-733 + commercial-market.config.ts:407-411
R486: 3. 输入：revenue_amt_sum、pre_revenue_amt_sum、revenue_amt_yoy_sum、cagr_* 
R487: 4. 处理：diff=SUBTRACT(cur,pre)（任一 null → null）；pop=DIVIDE(diff,pre)×100；yoy 同理；cagr=(pow(end/begin,1/Number(periods))−1)×100
R488: 5. 边界：pre=0 → pop=null；beginning=0 → cagr=Infinity（**getCAGR 无保护**）→ 显示异常（UNKNOWN 是否可能）
R489: 6. 验证：verification/verify-calculate.mjs
R490: 
R491: #### C7. 页面收入趋势（系统当前年双年对齐）
R492: 1. 页面/消费者：流水情况 / revenue_trend_chart
R493: 2. 源码：datasource.ts:754-800
R494: 3. 输入：rows[{mtime(yyyyMM), revenue_amt_sum}]（查询窗口 = 页面月所在年 ± 1）
R495: 4. 处理：currentYear=new Date().getFullYear()；当年/上年各按 mtime 排序（parseInt 比较）；固定 12 月标签；find 月份相等行；growth_rate 仅当 lastYearRevenue>0 且 current 非 null
R496: 5. 输出：12 点 {x_time:'1月'.., current_year_revenue, last_year_revenue, growth_rate}
R497: 6. 边界：页面所选年份 ≠ 系统当前年 → 双年窗口与页面无关（**这是"本年"定义消费者 #1**）；某月无行 → null；某月两行（重复键）→ find 取第一条
R498: 7. 验证：verification/verify-calculate.mjs（含页面年份≠系统年用例）
R499: 
R500: #### C8. 云服务流水明细派生与前端分页/排序
R501: 1. 页面/消费者：云服务流水表格
R502: 2. 源码：ts:511-548（processCloudServiceData）、ts:602-624（frontendSortData、handleCloudServiceData）、datasource.ts:822-973
R503: 3. 输入：cloud_service 明细数组 + cloud_service_summary 合计数组
R504: 4. 处理顺序：map 投影（cloud_service_name null→'--'，mtime null→'--'）→ frontendSortData(当前排序键，null/undefined 行排末尾) → 前端分页 slice（pageSize=10）→ formatMoney/formatTrendRate/formatDiffMoney/formatPercent 生成 `_show` → 合计行（格式化后）插入首行
R505: 5. 输出：≤11 行（合计+当页明细）
R506: 6. 边界：明细空 → 仅合计行；合计行 mtime=null→'--'；**合计行排序不参与**（先排后分页再插入合计）
R507: 7. 验证：verification/verify-calculate.mjs
R508: 
R509: #### C9. 云服务合计（先求和后算比率）
R510: 1. 页面/消费者：云服务表格合计行
R511: 2. 源码：datasource.ts:924-954
R512: 3. 输入：Σ revenue_amt_cny_sum / Σ pre / Σ yoy
R513: 4. 处理：totalPopAmount=SUBTRACT(Σcur,Σpre)；totalPop=DIVIDE(totalPopAmount,Σpre)×100；totalYoy 同理；ratio=1.0
R514: 5. 边界：Σpre=0 → null；空数据 → 固定合计行（revenue=0、ratio=1.0、比率 null）
R515: 6. 验证：verification/verify-calculate.mjs
R516: 
R517: #### C10. 云服务趋势浮层派生（双击线）
R518: 1. 页面/消费者：趋势浮层 trend_modal_chart
R519: 2. 源码：datasource.ts:975-1047
R520: 3. 输入：rows[{mtime, revenue_amt_cny_sum, pre_revenue_amt_cny_sum}]（窗口=页面月所在年±1，附加行云服务 code 过滤）
R521: 4. 处理：**trendData.sort(parseInt(mtime)) 后取最后一行年份作为 currentYear**（`trendData[trendData.length-1].mtime.substring(0,4)`）——**"从返回数据最后一行年份推导"的消费者 #3**；当年/上年按月 find；pop = DIVIDE(SUBTRACT(cur,pre),pre)×100
R522: 5. 输出：12 点 {x_time, current_year_revenue, last_year_revenue, pop_current, pop_last}
R523: 6. 边界：**排序保证**：查询侧 mtime orderAsc（true,priority1）→ 最后一行 = 最大月份；但前端又显式 sort 一次。若查询侧排序失效，最后一行≠最大年份 → **趋势双年错位风险**（SOURCE-READ：双保险存在，但若 mtime 含当年12月+次年1月混入，窗口仍受 trendStart/End 限制）
R524: 7. 验证：verification/verify-calculate.mjs
R525: 
R526: #### C11. 云服务明细浮层重组
R527: 1. 页面/消费者：明细浮层表格
R528: 2. 源码：ts:551-600、datasource.ts:1369-1651
R529: 3. 输入：列式数组 8 字段 + Sum 的 CURINCOME + Count 的 count
R530: 4. 处理：按 index 重组行（空值 '--'）→ CURINCOME_show=formatMoney → 合计行（'合计' + 其余 '—'）插入首行（有明细时）
R531: 5. 输出：合计+明细行
R532: 6. 边界：明细空 → 无合计行；count 缺失 → 0
R533: 7. 验证：verification/verify-calculate.mjs
R534: 
R535: #### C12. 机会点合计与年预测求和
R536: 1. 页面/消费者：机会点表格合计行 + 年销售预测列
R537: 2. 源码：datasource.ts:1189-1218（年预测）、1264-1317（合计行）
R538: 3. 处理：yearForecast=Σ(forecast_xx||0)；yearForecastSum=Σ(forecast_xx_sum||0)；合计行 is_summary=true 插首行
R539: 4. 边界：月预测 null → 0 参与求和（**不等于跳过**）；bidding_amount_sum null → formatMoney '--'
R540: 5. 验证：verification/verify-calculate.mjs
R541: 
R542: #### C13. 比率/金额格式化（本地验证覆盖）
R543: | 函数 | 表达式 | null→ |
R544: |---|---|---|
R545: | formatMoney | COCKPIT_UNIT_NOSIGN_THOUSAND_SIGN | '--' |
R546: | formatDiffMoney | +DATA_ADD | '--' |
R547: | formatTrendRate | ARROW_IN_FRONT_PERCENT_WITH_TWO_POINT | '--' |
R548: | formatPercent | ×100 → PERCENT_WITH_TWO_POINT | '--' |
R549: 
R550: ---
R551: 
R552: ### D. 交互与状态转移
R553: 
R554: | # | 触发控件 | 参数来源 | 原状态 → 新状态 | 受影响数据集/组件 | 可见结果 |
R555: |---|---|---|---|---|---|
R556: | D1 | 顶部日期选择（header dateValue） | HeaderOptionService | mtime 更新 → initByTime | 全部（客户/空间/经营/流水/活动/机会点/声音重新查询；云服务表格 localVars.mtime） | 全部数据按新月刷新 |
R557: | D2 | 锚点 Tab 激活 | tab.active | goAnchor scrollIntoView | 无数据影响 | 平滑滚动到锚点区块 |
R558: | D3 | 云服务表头排序（ti-head-sort） | sortKey/asc | cloudServiceSortKey/OrderAsc 更新 + currentPage=1 → processCloudServiceData | 云服务表格（前端排序+前端分页） | 按键排序，null 行置末尾，回第 1 页 |
R559: | D4 | 云服务分页 | currentPage/pageSize | cloudServicePagination 更新 → processCloudServiceData | 云服务表格 | 翻页显示 |
R560: | D5 | 云服务行"趋势" | row | selectedCloudService=row、trendModalVisible=true、detailModalVisible=false、selectedCloudServiceCode=' and cloud_service_type_code=...'（合计行→''）、trendStart/End=上年01..当年12 → showTrendModal | cloud_service_trend 数据源独立加载 | 趋势浮层（双柱+双环比线） |
R561: | D6 | 云服务行"明细" | row | detailModalVisible=true、trendModalVisible=false、selectedCloudServiceName（合计行→''）、incomeDetailStart/End=当月01..月末、incomeDetailPagination=1/0 → showDetailModal | income_detail/_sum/_count 独立加载 | 明细浮层表格（合计+明细，服务端 CURINCOME DESC） |
R562: | D7 | 浮层关闭（× 或遮罩） | - | closeModal：两浮层 false、selectedCloudService=null、hideAllModals | - | 浮层关闭 |
R563: | D8 | 明细浮层分页 | currentPage/pageSize | incomeDetailPageSize/Offset 更新 | income_detail 重新查询 | 翻页 |
R564: | D9 | 机会点表格分页 | currentPage/pageSize | opportunityLimit/Offset 更新 | customer_opportunity_details 服务端分页 + count | 翻页 |
R565: | D10 | 客户声音分页 | currentPage/pageSize | voicePageSize/voiceOffset 更新 | customer_voice(_intl) 重新查询 | 翻页 |
R566: | D11 | 业务类型树（treeselect） | selectedBusinessType | businessType SQL 更新 | customer_revenue_trend 重新查询 | 趋势图按业务类型过滤 |
R567: | D12 | 经营进展缩略图点击 | - | openThumbModal：showEchartsTrendDialogBox=true | 复用 business_progress_trend 数据（**无新请求**） | 放大浮层 |
R568: | D13 | 放大浮层关闭 | - | showEchartsTrendDialogBox=false | - | 关闭 |
R569: 
R570: **关键语义**：
R571: - 云服务表格排序/分页均为**当前返回窗口内的前端处理**（数据一次性全量返回，无服务端分页；分页 slice 在排序后）。机会点、客户声音、明细浮层为**查询侧分页**（limit/offset）。
R572: - 全页日期改变（D1）不显式重置各表格页码（云服务表格页码保留；机会点/声音页码保留但 offset 沿用 → 服务端查询用旧 offset + 新月数据——**待核实**：initByTime 未重置 paginationState；实际效果取决于 TiTable 是否因数据变化回 1 页，**UNKNOWN**）。
R573: - 请求失败：dv-canvas 数据源失败时 globalVars 不更新 → 表格保留旧数据（无显式错误态）；HTTP 错误由 ErrorMessageInterceptor 提示（未细读）。
R574: 
R575: ---
R576: 
R577: ### E. 导航契约
R578: 
R579: | 来源 | 触发 | 目标路由 | 参数 | 参数来源 | 缺值行为 |
R580: |---|---|---|---|---|---|
R581: | E1 | KPI 卡详情（**禁用**，模板注释） | - | - | - | - |
R582: | E2 | 客户活动"更多活动"（**禁用**） | - | - | - | - |
R583: | E3 | 会议"分析会详情"（**禁用**） | - | - | - | - |
R584: | E4 | 客户声音"更多"（**禁用**，html:821-825 有 onMoreCustomerVoiceClick 但模板未绑定） | - | - | - | - |
R585: | E5 | 基本信息"查看客户360"（**禁用**） | - | - | - | - |
R586: 
R587: 跳转函数仍存在但未绑定：onMoreActivityClick(→activity-list)、onMeetingDetailClick(→meeting-detail)、onMoreCustomerVoiceClick(→customer-voice-list)、onCustomer350Click(→customer-350)——**路由未注册**（meeting-detail/customer-voice-list/customer-350 不在 operation-map-routing.module.ts）→ 即便解除注释也会 404（UNKNOWN 是否历史遗留）。
R588: 
R589: **外部入口（jumpCustomerDetail，config.ts:334-347）**：从 customer-list / business-overview 等跳入本页：
R590: - 参数：from=`{来源页}{location.search 解码}`、customerId=row.party_number、customerName=row.party_company_name、mtime、site=row.data_site_type、public_cloud_na_level_name、is_parent_company_name、is_breakthrough_customer
R591: - 返回状态：面包屑 breadcrumbsUrl=`/operation-map/{from}`（ts:212）
R592: 
R593: ---
R594: 
R595: ### 浮层清单（本页）
R596: 
R597: #### F1. 云服务趋势浮层（trend_modal_chart）
R598: - 存在/启用：✅ 启用
R599: - 打开：行"趋势"链接（html:366）→ onCloudServiceTrendClick（ts:765-778）
R600: - 参数：行标识 cloud_service_type_code（合计行→无过滤）、云服务名（标题显示 activeModelCloudServiceName）、币种固定 RMB（数据源固定 cny 字段）、日期窗口 = 页面月所在年 上年01..当年12（**从页面日期推导窗口的消费者 #2**）
R601: - 加载方式：**独立加载** `cloud_service_trend` 数据源（where 附加 ` and cloud_service_type_code='...'`）
R602: - 图表绑定：4 系列（当年流水柱 / 上一年流水柱 / 当年环比线 / 上一年环比线），双 y 轴（左万元、右环比%），12 月 x 轴（component.config.ts:1558-1707）
R603: - 数据槽：current_year_revenue、last_year_revenue、pop_current、pop_last
R604: - 关闭：×（closeModal）或遮罩（html:703）
R605: - 旧请求晚响应：关闭后 modalVisible=false，数据源返回不重新打开（无订阅重开逻辑）
R606: 
R607: #### F2. 云服务明细浮层（incomeDetailSrcData）
R608: - 存在/启用：✅ 启用
R609: - 打开：行"明细"链接（html:367）→ onCloudServiceDetailClick（ts:781-800）
R610: - 参数：云服务名 selectedCloudServiceName（合计行→''）、当月窗口 incomeDetailStartTime/EndTime = 页面月 01..月末、cdhCodes、分页 10/0
R611: - 加载方式：**独立加载** income_detail + income_detail_summary + income_detail_count（API）
R612: - 表格绑定：8 列（modalDetailColumns，config.ts:321-332）+ 合计行首行（is_summary）+ 分页
R613: - 排序：服务端 ORDERBY=CURINCOME DESC；合计行 = Sum 接口 CURINCOME
R614: - 关闭：closeModal
R615: 
R616: #### F3. 月累计收入趋势放大浮层（month_total_revenue_trend）
R617: - 存在/启用：✅ 启用
R618: - 打开：经营进展缩略图点击（html:227）→ openThumbModal（ts:845-847）
R619: - 加载方式：**复用页面已有结果**（business_progress_trend 数据，无新请求）
R620: - 图表绑定：柱=收入（万，label 换算）、线=同比（%），双 y 轴；adapter 把 period_id 'yyyyMM' → 'yyyy/MM'
R621: - 关闭：×（ts:850-852）+ 遮罩
R622: 
R623: #### F4. 客户接触详情
R624: - **用户明确延期**（任务说明 §四.7）：不实现详情、不猜测替代跳转目标、不发起详情请求、不填虚构记录。入口不得表现为可用跳转。KPI 卡"客户接触"的详情链接已在模板注释（html:31-35）→ 旧站亦未启用该跳转。**本页长期未接触列表入口未被取消**（见后续批次 long-term-contactless）。
R625: 
R626: ---
R627: 
R628: ### 待核实/UNKNOWN（本页）
R629: 
R630: 1. **B10 列式数组错配**：客户声音 16 列式数组按 index 拼接，接口未给顺序/长度保证（需接口契约）。
R631: 2. **C4 混合 null 求和**：rmb_ptd_amt 部分行为 null 时 reduce 得 NaN（代码路径存在，接口是否保证全有值未知）。
R632: 3. **D1 日期变更后的表格页码**：initByTime 未重置 paginationState；机会点/声音表格服务端分页 offset 是否随数据刷新回 1 页未证实。
R633: 4. **C6 getCAGR beginning=0** → Infinity（页面显示异常风险；上游是否保证 beginning>0 未知）。
R634: 5. **E5 跳转目标路由未注册**（meeting-detail / customer-voice-list / customer-350 / long-term-contactless 等）：long-term-contactless 无独立路由（operation-map-routing.module.ts 无该项），但 KPI 卡路由表 ts:686-692 指向 `/operation-map/long-term-contactless`、`/operation-map/customer-voice-list` 等——这些路由当前未注册 → **链接被注释可能正因为路由不存在**（INFERRED）。
R635: ## 5. 经营概览（business-overview）
R636: ## 经营概览（business-overview）
R637: 
R638: > 证据基线：`a260c10744add7fe013d5e4591fa1ecc407f8083`
R639: > 组件：`BusinessOverviewComponent`（operation-map/business-overview/business-overview.component.ts，2148 行）
R640: > 模板：business-overview.component.html（316 行）；数据源：business-overview.datasource.ts（1583 行）；列：business-overview.config.ts（241 行）
R641: > 入口参数：无必填路由参数；头部筛选器驱动（repOfficeCheck/currency/dateValue/lv2ProdRdTeam/region/naType/businessType）
R642: 
R643: ---
R644: 
R645: ### A. 页面与内容树
R646: 
R647: > 容器 `dv-canvas-lowcode` 无自有行集，消费子组件数据。布局：顶部 5 张指标卡行 + 地图 + 右侧 Tab 表格区。
R648: 
R649: #### A0. 头部筛选器
R650: | 筛选器 | headerOpt 字段 | 影响的 localVars | 影响的查询 |
R651: |---|---|---|---|
R652: | 重点国代 repOfficeCheck | '1' → is_key_poffice=` and is_key_poffice = 1`；财经侧 area_rep_fin 与 keyRepOfficeList 求交集（空 → ['aa'] 哨兵） | is_key_poffice、area_rep_fin | gyy_revenue、public_region_revenue、表格、地图 |
R653: | 币种 currency | RMB/USD | currency（'RMB'）、currencyMap（CNY/USD）；**财经侧 currency_fin 固定 'RMB'，currency 用于图内格式化切换** | 全部（收入/流水字段按币种映射 rmb_/usd_） |
R654: | 日期 dateValue | - | mtime / fastFinTime / finTime 三口径（见 C2） | 全部 |
R655: | 产业 lv2ProdRdTeam | cloud_class_code SQL；财经 cloud_class_level_fin='TOTAL' + cloud_class_code_fin 逗号串 | 同上 | 全部 |
R656: | 地区 region | area_code SQL；regionType=mapCode[regionCode] | area_level_fin / area_region_fin / area_rep_fin / area_geo_fin | 全部 |
R657: | 客户级别 naType | na_type_code SQL；财经 income_na_fin='bb'、salesRate_na_fin='2'、salesValue_na_fin=2（否则 '' / '1' / 1） | 同上 | 收入/销毛率/销管费用 REST |
R658: | 业务类型 businessType | business_type_code / sub_business_type_code SQL；财经三档（TOTAL/LV1_BIZ/LV2_BIZ） | business_type_level_fin 等 | 流水/概览表 |
R659: 
R660: #### A1. 指标卡行（5 卡，无自有行集，消费 dv-indicator）
R661: | 卡 | primary | 数据源/字段 | 单位模板 | 同比/环比 secondary |
R662: |---|---|---|---|---|
R663: | 收入（年累计） | income_value（RMB）/ income_value_usd（USD） | income_express_data.AP_DM_CCCG_IOC_REV_QR_ABF_SUM.rmb_ytd_amt / usd_ytd_amt | 亿/万/元 | income_value_yoy：`yoy_y` COCKPIT_ZERO_RATE+ARROW_IN_FRONT |
R664: | 目标完成率 | income_target_rate | 同表 `budget_completion_y_ratio` | % | - |
R665: | 公有云流水 | gyy_revenue_value(_usd) | gyy_revenue.IOC_OPERATION_MAP_POFFICE_BUSINESS_TYPE_REVENUE_DETAILS.rmb_ytd_amt（当期） | 亿/万/元 | gyy_revenue_value_mom：`gyy_revenue_rate`（calcMom 当期/上期）；gyy_revenue_value_yoy：`gyy_revenue_yoy`（calcMom 累计/去年同期累计） |
R666: | 公网Region流水 | gyy_region_value(_usd) | public_region_revenue.IOC_OPERATION_MAP_POFFICE_REVENUE_DETAILS.rmb_ytd_amt（当期） | 亿/万/元 | gyy_region_value_mom / _yoy |
R667: | 盈利-销毛率 | sales_rate_value | sales_rate_data.CLOUDBI_DM_CCCRG_IOC_PL_SUM_COMMON.ytd_amt | % | sales_rate_value_yoy：`yoy_y` |
R668: | 销管费用 | sales_value(_usd) | sales_value_data.AP_DM_CCCRG_IOC_EXP_REGION.rmb_ytd_amt | 亿/万/元 | sales_value_yoy：`yoy_y` |
R669: | 逾期AR | overdue_value（**字段为空字符串，未绑定数据源**） | -（component.ts:1220-1226 field:""） | 亿/万/元 | overdue_value_yoy（field:"" 未绑定） |
R670: 
R671: #### A2. 地图
R672: - 全球视图 `business_overview_world_map`：`business_overview_region_map` 数据源（region 维度，7 个地区部），label=收入、气泡 size=rank 6|4|1、tooltip 显示本年收入/收入完成率/本年销毛率/同比/{mtime 月}月流水/环比（returnRegionMapToolTip，ts:1907-1968）
R673: - 区域视图 `business_overview_region_map`：`business_overview_repOffice_map` 数据源（代表处维度），siteType={{regionType}}
R674: - 地图点击：echartMapClick（ts:1970-2016）：regionType==='' 且 type==='region' → setHeaderOptRegion(regionItems 匹配 region_code)；regionType==='region_dept_code_fin' 且 type==='repoffice' → 下钻代表处；代表处视图点击 scatter → 不下钻（return）；中国区特殊 'R99'
R675: - 地图全屏 `fullScreenedClick` → refreshMap（showMap 重渲染 + refreshChart）
R676: - 地图刷新：refreshMap 有 2500ms 延迟 + 双 setTimeout（ts:1865-1877）
R677: 
R678: #### A3. Tab 表格区（5 个切换项）
R679: | # | title | 列配置 | 数据源 | 分页/排序 |
R680: |---|---|---|---|---|
R681: | 1 | 经营概览 | AreaColumns | overview_table_data（收入 GEO_PL_91000）+ salesRate_table_data（销毛率 GEO_PL_10997）前端 merge | srcData 内 TiTable 分页（pageSize 10/50/100）；排序前端 |
R682: | 2 | 收入TOP10NA | top10NAColumns | **无数据源绑定**（组件 pageConfig 未声明对应字段）→ 空表 | - |
R683: | 3 | 公网region流水 | regionColumns | public_region_revenue_table | 排序前端 |
R684: | 4 | 公网region流水下降NA | downColumns | customer_revenue_down_table（region_revenue_growth<0） | 排序前端 |
R685: | 5 | 公网region流水增长NA | growColumns | customer_revenue_top_table（region_revenue_growth>0） | 排序前端 |
R686: 
R687: **Tab 2 "收入TOP10NA" 为空**（pageConfig rootContainer 无其数据字段，businessOverviewTabs[1].show=false，html 不渲染 header）——**禁用 Tab**（SOURCE-READ：tab.show=false 且无数据源）。
R688: 
R689: ---
R690: 
R691: ### B. 查询返回之后的输入契约
R692: 
R693: #### B1. gyy_revenue（公有云流水卡）IOC_OPERATION_MAP_POFFICE_BUSINESS_TYPE_REVENUE_DETAILS
R694: - 字段：mtime、revenue_amt_sum（当期）、pre_revenue_amt_sum（上期）、accum_revenue_sum（当年累计）、last_year_accum_revenue_sum（去年同期累计）
R695: - where：mtime=mtime + is_key_poffice + currency + cloud_class_code + business_type_code + na_type_code + area_code
R696: - 派生（fitFunction，datasource.ts:47-60）：rmb_ytd_amt = currency==='RMB' ? revenue_amt_sum : null；usd_ytd_amt 反之；rmb_ytd_amt_y=accum（RMB）；gyy_revenue_rate=calcMom(当期,上期)；gyy_revenue_yoy=calcMom(累计,去年累计)
R697: - calcMom（datasource.ts:3-11）：**preMonth 真值且 ≠0 → (cur-pre)/pre×100；否则 mom=0** —— **0 不被吞掉，但"上期为 null/0 时结果强制 0"**（注意：pre=null 时走 else → 0；pre=0 时 preMonth!==0 为假 → 0）。**这不是 null 保留，而是 0 替换**（区分：客户详情 C8 的查询侧函数是 null 保留，此处是 0）。
R698: 
R699: #### B2. public_region_revenue（公网Region流水卡）IOC_OPERATION_MAP_POFFICE_REVENUE_DETAILS
R700: - 字段：mtime、revenue_amt_public_cloud_region_sum、pre_revenue_amt_public_cloud_region_sum、accum_revenue_public_cloud_region_sum、last_year_accum_revenue_public_cloud_region_sum
R701: - where 同 B1（无 business_type_code）
R702: - 派生同 B1（rmb_/usd_ 映射 + public_region_revenue_rate/_yoy）
R703: 
R704: #### B3. public_region_revenue_table（公网region表格）
R705: - 字段：rep_office_name_cn_fin、rep_office_code_fin、accum_revenue_public_cloud_region_sum（orderDesc 默认）、last_year_accum_revenue_public_cloud_region_sum、revenue_amt_public_cloud_region_sum、pre_revenue_amt_public_cloud_region_sum、cagr_ending_value_public_region_sum、cagr_beginning_value_public_region_sum
R706: - 派生：near_6_cagr = (pow(end/begin, 1/6)-1)×100（**begin 需 >0，否则 null**）；region_revenue_yoy/_mom = calcMom
R707: 
R708: #### B4. customer_revenue_top_table / customer_revenue_down_table（增长/下降 TOP10）
R709: - 字段：parent_party_company_name、revenue_amt_public_cloud_region_sum、pre_revenue_amt_public_cloud_region_sum、region_revenue_growth（查询侧函数 = cur−pre，top 表 orderDesc、down 表 orderAsc）、cagr_beginning_value_public_region_sum、cagr_ending_value_public_region_sum
R710: - where 追加 `and is_na_company_name='1'`，limit=10
R711: - 派生：cagr=calcCagr(begin,end)（begin>0 否则 null）；**过滤**：top 表 region_revenue_growth>0、down 表 <0
R712: - 空结果：≤0 条 → 表空
R713: 
R714: #### B5. 财经收入 income_express_data / overview_table_data / business_overview_region_map（AP_DM_CCCG_IOC_REV_QR_ABF_SUM）
R715: - 字段：report_item_code、ytd_amt、yoy_y、budget_completion_y_ratio、repoffice_code、repoffice_cn_name、region_cn_name、region_code
R716: - REST 入参：PERIOD_ID_INPUT=fastFinTime（收入/快报时间）、REPORT_ITEM_CODE_INPUT=["GEO_PL_91000"]、RND_LEVEL/LV1_PROD_RND_TEAM/PROD_BIZ_LEVEL/LV1/LV2_PROD_BIZ/REGION_LEVEL/REGION_CODE/REPOFFICE_CODE/GEO_PC_CODE/DC_REGION_CLOUD_TYPE_CODE（income_na_fin）/LAST_UPDATE_DATE_INPUT（fastLastUpdateTime）
R717: - overview_table_data：REGION_LEVEL=area_level_map_fin（REPOFFICE）；地图 region：REGION_LEVEL='REGION' + REGION_CODE=["R43","R22","R21","R99","R01","R42","R30"] 固定 7 区
R718: - income_express fitFunction：rmb_ytd_amt=currency==='RMB'?ytd_amt:null；usd_ytd_amt 反之
R719: 
R720: #### B6. 财经销毛率 sales_rate_data / salesRate_table_data / *_map_salesRate（CLOUDBI_DM_CCCRG_IOC_PL_SUM_COMMON）
R721: - 字段：report_item_code、ytd_amt、yoy_y、repoffice_code、repoffice_cn_name、region_cn_name、region_code
R722: - REST 入参：PERIOD_ID=finTime（财经月报时间）、REPORT_ITEM_CODE_INPUT=["GEO_PL_10997"]、REGION/REPOFFICE/GEO_PC、CL_REPOFFICE_SHOW='Y'、CL_REGION_SHOW='Y'、LV1_PROD_RND_TEAM/LV1_PROD_BIZ/LV2_PROD_BIZ、**pageIndex=salesRate_na_fin（'1' 全量 / '2' NA）**、LAST_UPDATE_DATE_INPUT=lastUpdateTime
R723: - **pageIndex 实为"是否只看NA"开关**（1=全部、2=NA 客户级别筛选）——名称误导，语义待上游接口字典确认（UNKNOWN，见 unknowns.md）
R724: 
R725: #### B7. 财经销管费用 sales_value_data（AP_DM_CCCRG_IOC_EXP_REGION）
R726: - 字段：report_item_code、ytd_amt、yoy_y
R727: - REST：PERIOD_ID=finTime、REPORT_ITEM_CODE_INPUT=["CCC_EXP_10001"]、REGION/REPOFFICE/GEO_PC、pageIndex=salesValue_na_fin（1/2）、L0_DEPT_CODE_INPUT=salesValue_bus_fin（'' / 'cc'）、LAST_UPDATE_DATE
R728: - fitFunction：rmb_/usd_ 映射
R729: 
R730: #### B8. 财经更新时钟（init，ts:1476-1530）
R731: - `financeFastTime`：IOC_COCKPIT_FINANCE_UPDATETIME，START=6 个月前，END=now，API_ID_INPUT=["AP_DM_CCCG_IOC_REV_QR_ABF_SUM"] → fastFinInitTime（api_update_time→yyyyMMdd）、fastLastUpdateTime（last_update_date）；headerOpt.max=fastFinInitTime
R732: - `financeTime`：API_ID_INPUT=["AP_DM_CCC_IOC_PL_EXP_AR_ABF_R2"] → finInitTime（period_id）、lastUpdateTime
R733: - 日期三口径（C2）：mtime=流水时间（revenueInitTime=flow_revenue_amt 的 period_no）、fastFinTime=收入时间、finTime=财经时间
R734: 
R735: ---
R736: 
R737: ### C. 查询后计算与转换
R738: 
R739: #### C1. 概览表合并（跨源关联）
R740: 1. 页面/消费者：经营概览 Tab1
R741: 2. 源码：ts:1762-1812
R742: 3. 输入：income_table_data[]（report_item_code=GEO_PL_91000）+ salesRate_table_data[]（GEO_PL_10997）
R743: 4. 处理：合并两数组 → `_.groupBy(newArr, 'repoffice_code')` → 每代表处取 [0] 为基础 → 按 report_item_code 重组 map → mergedItem = { repoffice_code, repoffice_cn_name, income_ytd_amt: map['GEO_PL_91000']?.ytd_amt || null, income_yoy_y, income_budget_completion_y_ratio, gross_profit_margin_ytd_amt: map['GEO_PL_10997']?.ytd_amt || null } → frontendSortTableData(SORT_FIELD_OVERVIEW='income_budget_completion_y_ratio', SORT_OVERVIEW=false 降序) → 加 rank
R744: 5. 输出：每代表处 1 行（5 列）
R745: 6. 边界：**某代表处只有收入无销毛率（或反之）→ 缺失指标为 null**（`|| null` 在 ?. 链上，缺行→undefined→null）；**重复 repoffice_code 行 → groupBy 合并但 [0] 丢失其余**（重复键处理）；report_item_code 只是选择指标，不是关联条件（同组内按 code 取值）
R746: 7. 验证：verification/verify-calculate.mjs
R747: 
R748: #### C2. 日期三口径（getMaxTime，ts:1557-1575）
R749: 1. 页面/消费者：全页
R750: 2. 处理：无 dateValue → mtime=revenueInitTime 前 6 位（yyyyMM）、fastFinTime=fastFinInitTime 前 6 位、finTime=finInitTime；有 dateValue → 各时间与所选日期比较，**取较早者**（maxTimeStr<date → 用 maxTime 否则 dateValue）
R751: 3. 边界：选择未来日期 → 各口径用各自的 maxTime；选择过去日期 → 用所选日期
R752: 4. 验证：verification/verify-calculate.mjs
R753: 
R754: #### C3. 地图数据合并（region / repOffice 两层）
R755: 1. 页面/消费者：地图
R756: 2. 源码：datasource.ts:915-977（region）、1092-1144（repOffice）
R757: 3. 输入：AP_DM_CCCG_IOC_REV_QR_ABF_SUM[]（GEO_PL_91000）+ *_map_salesRate[]（GEO_PL_10997）+ gyy_revenue_*_map[]（report_item_code='gyy'）
R758: 4. 处理：合并 → groupBy（region_code / repoffice_code）→ 按 report_item_code 取三指标 → mergedItem：income_ytd_amt（GEO_PL_91000.ytd_amt）、income_budget_completion_y_ratio（||''）、salesRate_ytd_amt（GEO_PL_10997.ytd_amt）、salesRate_yoy_y（||''）、revenue_ptd（gyy.revenue_amt_sum）、revenue_mom（gyy.gyy_revenue_mom）
R759: 5. 输出：region 7 行 / repOffice N 行
R760: 6. 边界：region_cn_name 经 regionMap 映射（欧洲地区部→欧洲 等 7 个）；gyy_revenue_region_map fitFunction 把 region_dept_code_fin 赋给 region_code、region_dept_name_cn_fin 赋给 region_cn_name、report_item_code='gyy'（datasource.ts:1486-1497）
R761: 7. 验证：verification/verify-calculate.mjs
R762: 
R763: #### C4. 表格通用格式化 getTemplate/getSubTemplate（ts:1884-1900）
R764: - filter/usdFilter 按 currency 选择；COCKPIT_ZERO_RATE 用于比率列（0.5→'50%'？——**COCKPIT_ZERO_RATE 语义需 DataFilter 字典确认**，UNKNOWN）；subField 用于"同比/环比"小字行
R765: 
R766: #### C5. CAGR 定义
R767: - regionColumns 表 `near_6_cagr`：期数固定 6（pow(end/begin,1/6)−1）×100，begin>0 否则 null（datasource.ts:158-164）
R768: - top/down 表 `cagr`：calcCagr 同样 6 期（datasource.ts:13-21）
R769: - 单位：%（0.5 = 0.5%，显示时 COCKPIT_ZERO_RATE 处理）
R770: - **对比**：customer-detail C6 的 cagr_value 期数来自 cagr_periods_public_region（可能≠6）——**消费者不同，期数来源不同**
R771: 
R772: ---
R773: 
R774: ### D. 交互与状态转移
R775: 
R776: | # | 触发 | 参数来源 | 原→新状态 | 受影响 | 可见结果 |
R777: |---|---|---|---|---|---|
R778: | D1 | 头部筛选（任一） | headerOptSelect | upstateVars → 全部 localVars + refreshMap | 全部数据源 | 全页刷新；地图重渲染（2500ms） |
R779: | D2 | 地图 scatter 点击 | param.data.region_code/repoffice_code | echartMapClick → setHeaderOptRegion → headerOpt.region=[activeRegion] + setHederOptions + version++ | 头部筛选同步 | 地图下钻区域/代表处 |
R780: | D3 | 地图 map 区域点击 | param.name | 同上（中国区→R99 特殊） | 同上 | 下钻 |
R781: | D4 | 全屏切换 | - | fullScreened 翻转 → refreshMap | 表格 flex 100% | 地图隐藏、表格全宽 |
R782: | D5 | Tab 切换 | tab.active | onActiveChange → selectedTab | 表格区 | 切换表格 |
R783: | D6 | 表格排序 | dataState.sort | onStateUpdate → SORT_* localVars → frontendSortTableData + rank 重编 | 对应表格 | 前端排序（全量数据） |
R784: | D7 | 收入卡点击 | globalVars.income_value_value/_usd | gotoPageDown('income_value')（**guard：两个值都非 0/null 才跳**） | 导航 business-revenue?tab=income | 跳转 |
R785: | D8 | "代表处/客户" 表格点击 | row | jumpCustomerDetail（**parent_party_company_name 重命名为 party_company_name**，mtime=headerOpt.dateValue） | 导航 customer-detail | 跳转客户详情 |
R786: | D9 | 指标提示 ? | hostElement | showMetricTip（AplusIndicatorService，指标代码 ZB0000376 等） | 弹出指标口径浮层 | 指标说明 |
R787: 
R788: **搜索/分页说明**：Tab 表格使用 ti-table 内置 displayedData（srcData.data 全量）→ 分页在组件内（pageSize 选项 10/50/100）；搜索未启用（无 searchbox）。**排序 = 全量结果上的前端处理**（onStateUpdate 直接对 srcData.data sort）。
R789: 
R790: ---
R791: 
R792: ### E. 导航契约
R793: 
R794: | 来源 | 触发 | 目标 | 参数 | 参数来源 | 缺值行为 |
R795: |---|---|---|---|---|---|
R796: | E1 | 收入卡（income_value/income_value_usd）点击 | /operation-map/business-revenue?tab=income | tab=income | 固定 | 两值均无 → return 不跳（ts:2102-2108） |
R797: | E2 | NA 收入卡（**未在模板中出现** gotoPageDown 'na_revenue'） | /operation-map/management-na-page?tab=turnover | tab=turnover | 固定 | -（模板无对应绑定，**禁用**） |
R798: | E3 | SMB 收入（gotoPageDown 'smb_revenue'） | /operation-map/commercial-market?market=1 | market=1 | 固定 | -（模板无对应绑定，**禁用**） |
R799: | E4 | 增长/下降表客户名点击 | /operation-map/customer-detail | from=business-overview、customerId=row.party_number、customerName=row.parent_party_company_name、mtime=headerOpt.dateValue、site 等 | 点击行 + 页面日期 | party_number 缺失 → 详情页无数据（跳转仍发生） |
R800: 
R801: **特别注意 E4**：business-overview 跳客户详情时 row 使用 `parent_party_company_name` 作为 customerName、mtime 用**页面日期**（ts:2138-2146）——与机会点清单跳客户详情的差异（后者用页面 mtime）一致，但**customerId 取自行的 party_number**。
R802: 
R803: ---
R804: 
R805: ### 浮层清单（本页）
R806: 
R807: - 本页无独立业务浮层（趋势/明细均在客户详情页；本页 tip 浮层为 AplusIndicatorService 指标口径说明）。
R808: - "表格全屏或展开行为"：全屏 = 地图隐藏 + 表格 flex 撑满（D4），非弹层。
R809: 
R810: ---
R811: 
R812: ### UNKNOWN（本页）
R813: 
R814: 1. COCKPIT_ZERO_RATE / COCKPIT_ZERO_RATE_NO_PERCENT 的精确输出（0 输入、null 输入、0.5 输入）需 @cloud/ana DataFilter 闭源字典（verification 中用 Node 直测不可行 → NOT-RUN，标注）。
R815: 2. 财经接口 `pageIndex` 参数语义（'1'/'2'）确认为 NA 档位开关（INFERRED，接口文档待取）。
R816: 3. Tab2 收入TOP10NA 的列 `客户名称` field=''、`年累计收入` field='' 等实际字段绑定缺失（源码列定义仅 title+filter，未绑定 field）——因 Tab 禁用，无消费者。
R817: 4. 逾期AR 指标卡未绑定数据源字段（field:""）→ 页面实际不显示数值（SOURCE-READ）。
R818: ## 6. 项目主页（project-overview）
R819: ## 项目主页（project-overview）
R820: 
R821: > 证据基线：`a260c10744add7fe013d5e4591fa1ecc407f8083`
R822: > 组件：`ProjectHomePageComponent`（project-map/project-home-page/project-home-page.component.ts，714 行）
R823: > 模板：project-home-page.component.html（381 行）；数据源：project-home-page.datasource.ts（988 行）；列/地图：config.ts（698 行）
R824: > 入口参数：无必填路由参数；头部筛选器驱动
R825: 
R826: ---
R827: 
R828: ### A. 页面与内容树
R829: 
R830: > 容器无自有行集。结构：三块指标模块（机会点概况 / 项目分层分级管理 / 复盘总结）+ 地图（区域/代表处两级）+ 右侧三 Tab 表格区。
R831: 
R832: #### A0. 头部筛选器（headerOpt）
R833: showRepofficeCheck / showDatePicker / showLv2ProdRdTeamSelect / showRegionSelect。initParams（ts:601-670）：
R834: - region 空 → target_category='region'（重点国代时 'rep_office'）、regionCode=全部非 global
R835: - region=region_dept_code_fin → target_category='rep_office'、regionLevel='OFFICE'、regionCode=所选（global→全部）
R836: - region=geo_pc_code → regionLevel='GEO_PC'、geoPcCode
R837: - region=rep_office_code_fin → regionLevel='OFFICE'、repCode
R838: - 重点国代 is_key_poffice=1 → repCode=keyRepOfficeList
R839: - 产业 lv2ProdRdTeam → cloud_class_code SQL + prodDimLevel/Code（LV1_RND 数组）
R840: 
R841: #### A1. 机会点概况指标卡（4）
R842: | 卡 | dv-indicator | 字段/数据源 | 单位 | 较上月 |
R843: |---|---|---|---|---|
R844: | 机会点数 | opportunity_cnt_total | valid_opportunity_cnt_sum（queryOpportunityPointIndicator） | 个 | opp_points_vs_last_month = valid − last_valid（fitFunction，datasource.ts:12-20） |
R845: | 总预签金额 | bidding_amount_sum | bidding_amount_sum | 亿/万/元 | total_pre_signed_amt_current_mom = bidding − last_bidding |
R846: | 年度销售预测 | product_yearly_fee_sum | product_yearly_fee_sum | 亿/万/元 | - |
R847: | 管道支撑率 | annual_pipeline_support_rate | annual_pipeline_support_rate（queryOverviewSummaryDataSum fitFunction，datasource.ts:626-653） | % | - |
R848: 
R849: 管道支撑率（汇总）公式：`[0,null,undefined].includes(target − realized − flow) ? 0 : effective_opportunity_remaining_amount_current_sum / (target − realized − flow) × 100`，其中：
R850: - target = Σ target_revenue_amt_cny（queryRevenueTargetSum，target_year=opportunity_outline 年）
R851: - realized = Σ ytd_amt（queryRealizedRevenueSum，**注意该 fitFunction 直接把 res 变为聚合对象 {key: sum}**，datasource.ts:680-694）
R852: - flow = Σ stock_forecast_revenue_amt_sum（queryFlowForecastSum）
R853: - **分母为 0/null/undefined → 0**（不是 null）
R854: 
R855: 机会点数卡点击 → gotoPageDown('opportunity-page', 'opportunity_cnt_total_value')（guard：globalVars[key] null → return）
R856: 
R857: #### A2. 项目分层分级管理指标卡（3）
R858: | 卡 | dv-indicator | 字段 | 单位 | 说明 |
R859: |---|---|---|---|---|
R860: | 已立项 | projected_opportunity_cnt_sum | projected_opportunity_cnt_sum | 个 | 点击 → project-page |
R861: | 预签金额 | edproject_opportunity_amount_sum | edproject_opportunity_amount_sum | 亿/万/元 | 已立项预签金额 |
R862: | 立项率 | project_initiation_rate | 见下 | % | COCKPIT_ZERO_RATE_NO_PERCENT |
R863: | 赢单率 | win_rate | 见下 | % | POINT_ONE |
R864: 
R865: 立项率（queryOpportunityOverviewMetrics fitFunction，datasource.ts:59-76）：`[0,null,undefined].includes(should_projected_opportunity_cnt_sum) ? null : operating/should × 100`——**注意此消费者 null 保留（不同于概览表）**。
R866: 赢单率：`[0,null,undefined].includes(resulted_project_cnt_sum) ? null : won/resulted × 100`。
R867: 机会点概况卡片数据源 queryOpportunityPointIndicator 无立项率字段。
R868: 
R869: #### A3. 复盘总结指标卡（2）
R870: 应复盘 should_review_project_cnt_sum（个）、已复盘 reviewed_project_cnt_sum（个）——queryOpportunityOverviewMetrics 原始字段，无计算。
R871: 
R872: #### A4. 地图（两级）
R873: - 全球 `customer_overview_world_map`：customer_overview_region_map 数据源（region 维度）；label=管道支撑率（COCKPIT_ZERO_RATE）；symbolSizeVal="1|51|80"；legendArr="0|1%~50%|51%~80%|80%以上"；tooltip：机会点数（'个' 后缀字符串）/预签金额（OPERATION_BILLION）/年度销售预测/管道支撑率（COCKPIT_RATE）（config.ts:616-656）
R874: - 区域 `customer_overview_region_map`：customer_overview_repOffice_map 数据源（代表处维度）
R875: - 地图点击 echartMapClick（ts:145-213）：
R876:   - scatter：全球→region → setHeaderOptRegion；区域→repOffice → 下钻；**rep_office_code_fin 且 regionCode===activeCode → 跳转 opportunity-list?type=valid_opportunity_cnt**；否则下钻
R877:   - map：同 scatter 逻辑（中国区→R99）
R878: - 区域名映射：regionMap（欧洲地区部→欧洲 等 7 个，datasource.ts:785-793）
R879: 
R880: #### A5. 表格区（3 Tab）
R881: | Tab | 列 | 数据源 | 说明 |
R882: |---|---|---|---|
R883: | 概览 | OverviewColumns（代表处/预签金额/管道支撑率/立项率 + 内置"排名"列） | overviewSummaryData（setOverviewSummaryData 处理） | 前端排序 compareFn |
R884: | TOP已立项项目 | AlreadyInitiatedColumns（项目名称+级别/预签金额/年度销售预测/赢率） | queryTopNApprovedProjects | 服务端排序（bidding_amount_sum orderDesc），行点击 → jumpOpportunityDetail(row, true) |
R885: | 丢单项目 | LostOrderProjectColumns（机会点名称+立项级别/预签金额/丢单原因） | queryPacketLossProjects | 行点击 → jumpOpportunityDetail(row, false)；表格排序状态 → packetLossProjectsSortKey/Asc 回写查询侧 orderDesc/orderAsc（datasource.ts:280-289） |
R886: 
R887: **概览表（setOverviewSummaryData，ts:451-518）**：
R888: - dAggregated：flowForecastData 按 `${region_dept_code_fin}_${rep_office_code_fin}` 聚合 stock_forecast_revenue_amt_sum
R889: - fAggregated：revenueTargetData 按同 key 聚合 target_revenue_amt_cny
R890: - eAggregated：realizedRevenueRestData 按 `${region_code}_${repoffice_code}` 聚合 ytd_amt
R891: - 每行：stockForecast/dTarget/ytd 缺 key → 0；denominator = target − stock − ytd；`[0,null,undefined].includes(denominator) ? 0 : effective_opportunity_remaining_amount_current_sum / denominator`
R892: - **注意**：该处 ratio 未 ×100（support_coverage 小数），support_coverage_label = ×100 后 COCKPIT_ZERO_RATE；project_initiation_rate（表）= `[0,null,undefined].includes(should) ? 0 : operating/should`（**表内是 0，指标卡是 null**）→ label ×100 COCKPIT_ZERO_RATE
R893: - bidding_amount_sum_splicing = processNumberData(bidding_amount_sum,'个')（亿/万 换算）；bidding_amount_sum_label = OPERATION_BILLION
R894: 
R895: **TOP已立项（queryTopNApprovedProjects fitFunction，datasource.ts:151-162）**：
R896: - bidding_amount_sum_label/amount_estimated_sum_label = OPERATION_BILLION
R897: - winodds_lable = DataFilter(winodds×100).POINT_ONE + '%'
R898: - level_name = projectLevelItems.find(value===project_level)?.label（common/operation-map-header/config.ts）
R899: - 服务端排序：bidding_amount_sum orderDesc(priority1) + project_initiation_name orderDesc(priority2)；where project_initiation_status='Issued'；limit=10 offset=0
R900: 
R901: **丢单（queryPacketLossProjects，datasource.ts:250-340）**：
R902: - bidding_amount_sum = OPERATION_BILLION 覆盖原值（**格式化覆盖数值**）
R903: - where is_lost_order=1；排序受 localVars.packetLossProjects 控制（orderDesc/orderAsc 条件模板）
R904: 
R905: ---
R906: 
R907: ### B. 查询返回之后的输入契约
R908: 
R909: #### B1. PROJECT_MAP_OPPORTUNITY_INDEX_SUMMARY（指标/地图/概览表）
R910: - 消费者：全部指标卡 + 地图 + 概览表
R911: - 字段：valid_opportunity_cnt_sum、last_valid_opportunity_cnt_sum、bidding_amount_sum、last_bidding_amount_sum、product_yearly_fee_sum、projected_opportunity_cnt_sum、edproject_opportunity_amount_sum、operating_projected_opportunity_cnt_sum、should_projected_opportunity_cnt_sum、actual_project_analysmeeting_cnt_sum、plan_project_analysmeeting_cnt_sum、won_project_cnt_sum、resulted_project_cnt_sum、should_review_project_cnt_sum、reviewed_project_cnt_sum、effective_opportunity_remaining_amount_current_sum、region_dept_code_fin、rep_office_code_fin、region_dept_name_cn_fin、rep_office_name_cn_fin
R912: - where：mtime=opportunity_outline_end + is_key_poffice + cloud_class_code + area_sql
R913: - 行粒度：地区部/代表处（×月）
R914: 
R915: #### B2. PROJECT_MAP_CUSTOMER_REVENUE_FORECAST_M（flow 预测）
R916: - 字段：region_dept_code_fin、rep_office_code_fin、stock_forecast_revenue_amt_sum
R917: - where：mtime + area_sql（无 is_key/cloud_class 过滤——注意与查询 FlowForecastSum 差异：Sum 有 is_key/cloud_class）
R918: 
R919: #### B3. PROJECT_MAP_REVENUE_BUSINESS_TARGET（target 目标）
R920: - 字段：region_dept_code_fin、rep_office_code_fin、target_revenue_amt_cny、target_revenue_amt_usd
R921: - where：target_year=target_year + target_category（special='rep_office' 固定，见 localVars.target_category_special）+ cloud_class_code + is_key_rep_office + area_sql
R922: - Sum：target_revenue_amt_cny_sum、target_revenue_amt_usd_sum（where 用 target_category 而非 special，**target_category=null → '' → 无过滤**）
R923: 
R924: #### B4. AP_DM_CCC_IOC_PL_EXP_AR_ABF_R2（realized 已实现收入）
R925: - 字段：region_code、repoffice_code、ytd_amt、geo_pc_code
R926: - REST：PERIOD_ID=opportunity_outline_end、CURRENCY_CODE_INPUT='RMB'、REGION_LEVEL（REPOFFICE/OFFICE/GEO_PC 动态）、REPORT_ITEM_CODE_INPUT=["GEO_PL_91000","CCC_PL_91000"]（明细）/["GEO_PL_91000"]（Sum）、REGION_CODE/REPOFFICE_CODE/GEO_PC_CODE/PROD_DIM_LEVEL/PROD_DIM_CODE
R927: - **关联键差异**：明细查询 ytd_amt 按 `${region_code}_${repoffice_code}` 聚合；而 flow/target 按 `${region_dept_code_fin}_${rep_office_code_fin}`——**两套 key 语义需一致**（region_code vs region_dept_code_fin 应为同值，SOURCE-READ 未验证，UNKNOWN）
R928: 
R929: #### B5. PROJECT_MAP_OPPORTUNITY_DETAILS_M（TOP/丢单表格）
R930: - 字段（TOP）：project_initiation_name、project_initiation_level、project_level、bidding_amount_sum、party_company_name、region_dept_name_cn_fin、rep_office_name_cn_fin、opportunity_step、amount_estimated_sum、winodds、order_date_estimated、latest_analysis_meeting_conclusion、sponsor_name、sub_industry_level1_name、public_cloud_na_level_name、opportunity_code、pd_name、project_risks
R931: - 字段（丢单）：opportunity_name、should_project_level_name、project_initiation_level、project_initiation_status、bidding_amount_sum、party_company_name、geo_pc_cn_name、rep_office_name_cn_fin、lost_order_reason、latest_analysis_meeting_time、latest_analysis_meeting_conclusion、sponsor_name、ati_status、sub_industry_level1_name、public_cloud_na_level_name、opportunity_code、project_initiation_name、pd_name
R932: - 单位：金额元；winodds 比例（0-1，×100 显示）
R933: 
R934: ---
R935: 
R936: ### C. 查询后计算与转换
R937: 
R938: #### C1. 管道支撑率（两处消费者，公式不同）
R939: | 位置 | 分母处理 | 分子 | 输出 |
R940: |---|---|---|---|
R941: | 指标卡 annual_pipeline_support_rate | `[0,null,undefined].includes(target−realized−flow) ? 0 : …×100` | Σ effective_opportunity_remaining（按数据行求和） | ×100 后 COCKPIT_ZERO_RATE_NO_PERCENT |
R942: | 概览表行 support_coverage | 同上 ? 0 : …（**不 ×100**） | 行 effective | label ×100 COCKPIT_ZERO_RATE |
R943: | 地图 annual_pip_supp_rate_pct | 同上 ? 0 : … | 行 effective | ×100 后 COCKPIT_RATE |
R944: 
R945: - 缺 target / 缺 flow / 缺 realized 匹配行 → 对应 key 的聚合值为 0（`?.[key] || 0`）→ 分母 = target 0 − 0 − 0 = 0 → 结果 0（**不是 null**）
R946: - **重复键**：reduce 累加不判重（同一 key 多行相加）
R947: - 验证：verification/verify-calculate.mjs
R948: 
R949: #### C2. 立项率（两处消费者，null vs 0）
R950: - 指标卡：`[0,null,undefined].includes(should) ? null : operating/should × 100`
R951: - 概览表：同上但 ? 0（**不 ×100**，label ×100）
R952: - 验证：verification/verify-calculate.mjs
R953: 
R954: #### C3. 赢单率
R955: - `[0,null,undefined].includes(resulted) ? null : won/resulted × 100`；显示 POINT_ONE（1 位小数 %）
R956: 
R957: #### C4. 机会点增量（较上月）
R958: - opp_points_vs_last_month = valid − last_valid（**直接减法**；任一 null → NaN → 显示异常，UNKNOWN 上游保证）
R959: - total_pre_signed_amt_current_mom = bidding − last_bidding（同上）
R960: 
R961: #### C5. 时间窗口（processTime，ts:672-688）
R962: - opportunity_outline_end = 所选（或 max）月份 yyyyMM；_begin = 当年 01 月；_last_begin = 上年 01；_last_end = 上年 12；target_year = yyyy
R963: - 与机会点清单 processTime 相同实现（共享语义）
R964: 
R965: ---
R966: 
R967: ### D. 交互与状态转移
R968: 
R969: | # | 触发 | 参数来源 | 原→新状态 | 受影响 | 可见结果 |
R970: |---|---|---|---|---|---|
R971: | D1 | 头部筛选 | headerOptSelect | initParams → localVars + regionChanged 判断（permissionId 比较）→ refreshChart | 全部 | 数据刷新；region 变化才刷地图 |
R972: | D2 | 地图点击（各级） | param | echartMapClick → setHeaderOptRegion / 跳转 | 头部筛选或导航 | 下钻/跳转 |
R973: | D3 | 机会点数卡点击 | globalVars 值 | gotoPageDown('opportunity-page') | 导航 | opportunity-page |
R974: | D4 | 已立项卡点击 | 同上 | gotoPageDown('project-page') | 导航 | project-page |
R975: | D5 | Tab 切换 | item | onActiveChange → activeTab + initOverviewTable | 表格区 | 切表 |
R976: | D6 | 全屏 | - | fullScreened 翻转 → refreshChart | 地图/表格 | 地图隐藏、表格全宽 |
R977: | D7 | TOP 表行点击 | row | jumpOpportunityDetail(row, true) | 导航 project-detail | 详情页（ati_status 强置 'Initiated'） |
R978: | D8 | 丢单表行点击 | row | jumpOpportunityDetail(row, false) | 导航 project-detail | 详情页（ati_status 保留行值） |
R979: | D9 | TOP 表"查看项目清单" | - | gotoPageDown('sales-project-list') | 导航 | sales-project-list?title=已立项销售项目清单&routeFilterParams=`and project_initiation_status = 'Issued'` |
R980: | D10 | 丢单表"查看项目清单" | - | gotoPageDown('opportunity-list') | 导航 | opportunity-list（type 由 activeTab 决定：pre-approval → projectInitiationStatus=Initiated；lost-order → **HeaderOptionService.getHeaderOptions().opportunityStage=[{label:'CSSC',value:'CSSC'}]**） |
R981: | D11 | 概览表排序 | dataState.sort | ti-head-sort compareFn（compareFn 主键数值差，相等按 rep_office_name_cn_fin 降序 localeCompare） | 概览表 | 前端排序 |
R982: 
R983: **D10 专项核实（任务 §五.E）**：`gotoPageDown('opportunity-list')` 丢单场景：`this.headerOptionService.getHeaderOptions().opportunityStage = [{label: 'CSSC', value: 'CSSC'}]`（ts:580）——**直接写 headerOptionService 当前 options 的 opportunityStage 属性**，然后 navigate 到 opportunity-list（**无 queryParams 传递 opportunityStage**）。机会点清单侧通过 `headerOptSelect.opportunityStage` 读取（opportunity-list.component.ts:379-382 → `StringUtil.buildInString(opportunityStageSelectedList, 'opportunity_step')`）→ **CSSC 值经 HeaderOptionService 共享状态传递**。CSSC 含义：机会点阶段（opportunity_step）字典值（UNKNOWN 完整字典，见 dictionaries.json 缺口）。**发现差异**：任务描述称"项目主页进入机会点清单通过 HeaderOptionService.opportunityStage 传递阶段"——当前源码确认该机制存在，且仅"丢单项目"Tab 使用；"TOP已立项"Tab 跳转传 queryParams.projectInitiationStatus=Initiated 而非 opportunityStage。
R984: 
R985: ---
R986: 
R987: ### E. 导航契约
R988: 
R989: | 来源 | 触发 | 目标 | 参数 | 参数来源 | 缺值 |
R990: |---|---|---|---|---|---|
R991: | E1 | 机会点数卡 | opportunity-page | 无 | - | 卡值 null → 不跳 |
R992: | E2 | 已立项卡 | project-page | 无 | - | 同上 |
R993: | E3 | TOP 行 | project-detail | from='project-overview'+search、page_title=project_initiation_name（ati_status==='Initiated'）或 opportunity_name、opportunity_code=row.opportunity_code、mtime=opportunity_outline_end、ati_status_label、project_initiation_level、public_cloud_na_level_name、sub_industry_level1_name | 点击行 + 页面时间 | 见 jumpOpportunityDetail（project-detail.config.ts:181-196） |
R994: | E4 | 丢单行 | project-detail | 同上但 page_title=opportunity_name（ati_status≠Initiated） | 同上 | 同上 |
R995: | E5 | 查看项目清单（TOP） | sales-project-list | title、routeFilterParams | 固定 | - |
R996: | E6 | 查看项目清单（丢单） | opportunity-list | 无 queryParams（经 HeaderOptionService.opportunityStage 传 CSSC） | 共享服务 | opportunityStage 未读到时无阶段过滤 |
R997: 
R998: **mtime 差异**：E3/E4 的 mtime = `this.localVars.opportunity_outline_end`（页面月 yyyyMM）。**机会点清单跳 project-detail 用行 mtime；项目主页跳 project-detail 用页面月**——不同消费者。
R999: 
R1000: ---
R1001: 
R1002: ### 浮层清单（本页）
R1003: 
R1004: - 本页无独立浮层（地图 tooltip 为内联 HTML 渲染；"查看项目清单"为新窗口打开）。
R1005: - 趋势缩略图：无（区别于商业市场/管理流水）。
R1006: 
R1007: ---
R1008: 
R1009: ### UNKNOWN（本页）
R1010: 
R1011: 1. region_code（realized）与 region_dept_code_fin（flow/target）的取值一致性（B4 关联键，UNKNOWN 接口契约）。
R1012: 2. HeaderOptionService.opportunityStage 的完整字典（CSSC 等值集合）——需 HeaderOptionService 实现（services/HeaderOptionService.ts 未在本批细读，见 unknowns.md）。
R1013: 3. 直接减法（C4）null 参与 → NaN 显示（上游是否保证字段非空）。
R1014: ## 7. Token 专项（token-specific）
R1015: ## Token 专项（token-specific）
R1016: 
R1017: > 证据基线：`a260c10744add7fe013d5e4591fa1ecc407f8083`
R1018: > 组件：`TokenSpecificPageComponent`（product-map/token-specific-page/token-specific-page.component.ts，743 行）
R1019: > 模板：token-specific-page.component.html（197 行）；数据源：token-specific-page.datasource.ts（546 行）；配置：token-specific-page.config.ts（457 行）；组件声明：token-specific-page.component.config.ts（750 行）
R1020: > 入口参数：无必填；头部筛选器（dayDateValue 日选择 / region / token 数据范围）
R1021: 
R1022: ---
R1023: 
R1024: ### A. 页面与内容树
R1025: 
R1026: > 容器无自有行集。结构：指标卡行 + 两张饼图（客户分布 / Tokens消耗分布）+ Token 总量使用情况趋势图（含模型/日期筛选）+ 客户模型开通情况表格（本地分组+趋势缩略图+浮层）。
R1027: 
R1028: #### A0. 头部（HEADER_OPT）
R1029: title='Tokens运营分析'、dateFormat='yyyyMMdd'、showDayDatePicker=true（**日粒度选择**）、showRegionSelect=true、showTokenDataRange=true。
R1030: 
R1031: #### A1. 日期范围 Tab（DATE_RANGE_TABS，config.ts:55-72）
R1032: | id | title | range | 影响 |
R1033: |---|---|---|---|
R1034: | current_day | 昨日 | 0 | topStart/End = dtime±0；groupType=HOUR |
R1035: | seven_day | 近7天 | 6 | topStart/End = initTime±6；groupType=DAY |
R1036: | thirty_day | 近30天 | 29 | topStart/End = initTime±29；groupType=DAY |
R1037: 
R1038: - 默认 active=current_day（昨日）。
R1039: - 切换处理 handleDateRangeChange（ts:702-720）→ handleTodyDateChange / handleRecentlyRangeDateChange。
R1040: - **日期控件（dayDateValue）只影响"昨日"Tab**（ts:302-305："日期控件的变化只影响今日tab"——注释与 id 名称 current_day 均指"昨日"窗口）。
R1041: 
R1042: #### A2. 指标卡行（4，METRIC_CARDS）
R1043: | 卡 | dv-indicator（主） | 字段 | dv-indicator（较前值 pop） | 计算 |
R1044: |---|---|---|---|---|
R1045: | 客户数量 | customer_count | customerMetricsData.customer_count | customer_count_pop | DIVIDE(SUBTRACT(customer_count, pre_customer_count), pre)×100（null 保持） |
R1046: | 近7天日均1000万客户数 | avg_customer_7days | seven_customer_count | avg_customer_7days_pop | 同上（seven vs pre_seven） |
R1047: | Tokens消耗总量 | token_consumption_total | tokenMetricsData.total_tokens_sum | token_consumption_total_pop | Σ total_tokens_sum；pre = Σ total_tokens_prev/7days/30days_ago_sum（按 activeDateRangeType 字段映射）；pop=DIVIDE(Σcur−Σpre, Σpre)×100 |
R1048: | Tokens总流水 | service_revenue_total | serviceRevenueTotalData.revenue_amt_sum | service_revenue_total_pop | 同上（revenue_amt_prev/7days/30days_ago_sum） |
R1049: 
R1050: 字段映射（datasource.ts:5-15）：
R1051: - tokenMetricsFieldsMap：current_day→`total_tokens_prev_sum`、seven_day→`total_tokens_7days_ago_sum`、thirty_day→`total_tokens_30days_ago_sum`
R1052: - serviceRevenueFieldsMap：current_day→`revenue_amt_prev_sum`、seven_day→`revenue_amt_7days_ago_sum`、thirty_day→`revenue_amt_30days_ago_sum`
R1053: 
R1054: **汇总后计算比率**：先 Σ 全部行再 DIVIDE（datasource.ts:107-118, 145-158）——非逐行计算。
R1055: 
R1056: #### A3. 饼图区（2）
R1057: - 客户分布 `customer_distribution_pie` + 表格：customerDistributionData（API PRODUCT_MAP_CUSTOMER_MODEL_PIE）→ handleCustomerDistributionPieData（config.ts:355-378）：按 customer_count 求占比 DIVIDE(ite, totalSum)，'其他' 排最后（仅当其余 5 条且其他>0）；模型名空→'--'；计数 null→'--'；percent null→'--'
R1058: - Tokens消耗分布 `token_consumption_pie` + 表格：tokenDistributionData（PRODUCT_MAP_TOKENS_DAILY）→ processModelTokenData（config.ts:257-323）：五级排序（值空+名空最末 → 值空次末 → 值降序 → 名空靠后 → 原序）；≤5 全出；>5 TOP5+其他；占比 DIVIDE(value,totalSum)；展示 target_count 单位'亿'（BILLION+POINT_TWO+THOUSAND_SIGN）、'家'；percent×100 PERCENT_WITH_TWO_POINT（component ts:379-407）
R1059: - 饼图表格列：name/value/percentage（getPieChartTableColumns）
R1060: 
R1061: #### A4. Token 总量使用情况趋势图（tokenTotalUsageData）
R1062: - 筛选器：模型（usageTrendFilter.model → ` and model_name = '...'`，空→''）+ 时间范围（24小时/近7天/近14天）
R1063: - 查询：`where 1=1 + tokenTotalUsageModelParam + tokenTotalUsageTimeRangeParam + areaString`；x_time 伪字段：hour→`h_tag`、day→`dtime`（useWhen 按 tokenTotalUsageGroupType），orderAsc
R1064: - 空集 → [{x_time:'--', total_tokens_sum:null}]
R1065: - 时间范围筛选 onUsageTrendFilterChange（ts:416-421）只更新 model 参数；**TIME_RANGE 参数未实际使用**（usageTrendFilter.timeRange 无消费方，查询用 topStart/End 由 Tab 驱动）——**筛选器"时间范围"与日期 Tab 双轨，仅 Tab 生效**（SOURCE-READ，见交互 D3）
R1066: 
R1067: #### A5. 客户模型开通情况表格（本地分组/分页）
R1068: - 数据源 customerModelActivationStatusData（API PRODUCT_MAP_CUSTOMER_MODEL_TABLE_DETAIL）+ customerTableTotal（API PRODUCT_MAP_CUSTOMER_MODEL_TABLE_DETAIL_TOTAL → count）
R1069: - 入参：startTime/endTime（客户表时间范围）、modelName、sortDirection（asc/desc）、pageSize、offset、trendType（hour/day）、orderType（customer_total_tokens 默认）、searchKey、regionDeptCode/repOfficeCode/geoCode
R1070: - 表格列（TABLE_COLUMNS，config.ts:143-151）：序号(customerIndex, rowSpan)、客户名称(customer_name, rowSpan)、账号(account_name, rowSpan)、Token专项流水(token_turnover, rowSpan)、模型(model_name)、Token消耗量(百万tokens)(token_used_amount, sortKey=customer_total_tokens)、Token用量波形图(thumbTrend)
R1071: - **本地处理链**：loadTableData（ts:487-493）→ groupTableQueryByCustomer 按 `${customer_name}_${account_name}` 分组 → processTableQueryData（ts:521-586）：
R1072:   - 组内分离合计行（model_name==='合计'）与非合计行；**非合计行按 total_tokens 倒序（null 排最后）**；合计行恒末位
R1073:   - rowSpan=组行数（首行）、rowHide=非首行（合并单元格）
R1074:   - customerIndex 从 (currentPage−1)×pageSize+1 递增（**服务端返回的是当前窗口，本地仅重排/标号**）
R1075:   - trend_data 解析 parseTrendHourData：JSON.parse().sort(x_time 升序)（config 注释称 hour 为 24 点）
R1076:   - token_turnover_show = COCKPIT_UNIT_NOSIGN_THOUSAND_SIGN（合计行同）；token_used_amount_show = MILLION+POINT_ONE+THOUSAND_SIGN
R1077: - **分页语义**：服务端分页（offset/pageSize 传 API）+ 本地对窗口内分组重排。**totalNumber=customerCount（API 总数）**。
R1078: - 表格筛选：onTableFilterChange（模型 → customerTableModelName；时间范围 → 无字段消费，仅置 tableFilter）；搜索 onSearchChange → customerTableSearchKey（API 侧 searchKey，非本地搜索）
R1079: - 排序：handleTableStateUpdate（ts:463-481）：pagination → customerTablePageSize/Offset；sort → customerTableOrderType=asc===null?默认键:sortKey、SortDirection=asc?'asc':'desc'、回第 1 页（**查询侧排序**）
R1080: 
R1081: #### A6. 开通表趋势浮层（trendModalTokenTotalUsageData）
R1082: - 打开 openTrendModal（ts:722-737）：行 account_name + areaString + （非合计行）model_name → ` and account_name='...' [and model_name='...'] areaString` → tableTrendModalQueryParams；再 onTableModelSelectChange(默认 24小时)
R1083: - 弹框日期切换 onTableModelSelectChange（ts:451-456）：值>1（近7/14天）→ groupType=DAY、基准 initTime；值==1（24小时）→ HOUR、基准 dtime；`trendModalTimeRangeParam = and dtime between start and end`
R1084: - 查询：where 1=1 + tableTrendModalQueryParams + trendModalTimeRangeParam；x_time 伪字段 h_tag/dtime
R1085: - 关闭 hideDetailDialog：showDetailDialog=false、selectedCustomerInfo=null、重置弹框日期选项
R1086: 
R1087: #### A7. 近30天流水趋势图（tokenTrendData）
R1088: - 位置：HTML 中 id='tokenTrendChart'（A6 之前区域）；数据源 tokenTrendData（datasource.ts:178-225）
R1089: - 查询：dtime between turnoverTrendStartTime(=initTime−29) and turnoverTrendEndTime(=initTime)；字段 dtime(orderAsc)/revenue_amt_sum/revenue_amt_prev_sum
R1090: - 处理：**completeDailyData 补日**（config.ts:392-458：生成 start..end 每日，缺日填充 {dtime, revenue_amt_sum:null, revenue_amt_prev_sum:null, revenue_amt_sum_pop:null}，**重复日 Map 覆盖保留最后一条**）→ 每点 pop=DIVIDE(SUBTRACT(cur,prev),prev)×100；x_time=dtime；空集→[{x_time:'--',...}]
R1091: 
R1092: ---
R1093: 
R1094: ### B. 查询返回之后的输入契约
R1095: 
R1096: #### B1. PRODUCT_MAP_CUSTOMER_INDICATOR（API）
R1097: - 字段：customer_count、pre_customer_count、seven_customer_count、pre_seven_customer_count
R1098: - 入参：customerStartTime/customerEndTime（topStart/End）、sevenCustomerStartTime/End（dtime±6）、rangeType（activeDateRangeType）、regionDeptCode/repOfficeCode/geoCode
R1099: - 派生：customer_num_pop、seven_customer_num_pop（DIVIDE(SUBTRACT,pre)×100，null 保持）
R1100: 
R1101: #### B2. PRODUCT_MAP_TOKENS_DAILY（graphql）
R1102: - 消费者：token 指标卡、token 分布饼图、总量趋势、模型列表、浮层
R1103: - 字段：dtime(yyyyMMdd)、total_tokens_sum、total_tokens_prev_sum、total_tokens_7days_ago_sum、total_tokens_30days_ago_sum、model_name、h_tag（HOUR 伪字段源）、x_time（伪字段）
R1104: - 查询：dtime between topStart and topEnd + areaString（或 1=1+model/timeRange/areaString）
R1105: - 行粒度：模型×日×小时（h_tag）；**h_tag 语义**（如 '00'-'23' 或小时标识）依赖接口字典（UNKNOWN）
R1106: 
R1107: #### B3. PRODUCT_MAP_TOKENS_REVENUE_DAILY（graphql）
R1108: - 消费者：Tokens 总流水卡、近30天趋势
R1109: - 字段：dtime、revenue_amt_sum、revenue_amt_prev_sum、revenue_amt_7days_ago_sum、revenue_amt_30days_ago_sum
R1110: 
R1111: #### B4. PRODUCT_MAP_CUSTOMER_MODEL_PIE（API）
R1112: - 字段：model_name、customer_count
R1113: - 消费者：客户分布饼图
R1114: 
R1115: #### B5. PRODUCT_MAP_CUSTOMER_MODEL_TABLE_DETAIL / _TOTAL（API）
R1116: - 字段（TableQueryResult，config.ts:29-40）：customer_name、account_name、revenue_amt、model_name（明细/'合计'）、total_tokens、is_total_row(0/1)、trend_data(JSON 字符串)、customer_total_tokens
R1117: - trend_data JSON：hour 模式 [{hour:'00',tokens:100},...]（注释称 24 点）；day 模式 [{date:'20260501',tokens:100},...]——**注意 parseTrendHourData 读取字段 x_time/tokens（ts:622-631），而接口注释字段为 hour/date/tokens——字段名不一致（x_time vs hour/date）**（UNKNOWN：以接口实际为准，代码按 x_time 解析，解析失败返回 []）
R1118: - 唯一键：customer_name+account_name+model_name（分组键）；排序：服务端 sortDirection/orderType
R1119: 
R1120: ---
R1121: 
R1122: ### C. 查询后计算与转换
R1123: 
R1124: #### C1. 客户数环比（null 保留）
R1125: 1. 源码：datasource.ts:23-53；`customer_num_pop = DIVIDE(SUBTRACT(cur,pre),pre)`，`? ×100 : 原值`（**null/0 分支**：target falsy → 保持 target（null 或 0））
R1126: 2. 验证：verification/verify-calculate.mjs
R1127: 
R1128: #### C2. Token 指标汇总后比率
R1129: 1. 源码：datasource.ts:100-121（token）、140-159（revenue）
R1130: 2. 处理：Σcur、Σpre（**行内任一 null → 加法得 NaN** 风险：`sumData.total_tokens_sum += row['total_tokens_sum']` 无判空！）；target=DIVIDE(SUBTRACT(Σcur,Σpre),Σpre)；`? ×100 : target`
R1131: 3. 边界：混合 null → NaN → pop 显示异常（UNKNOWN 接口保证）
R1132: 
R1133: #### C3. 补日 completeDailyData
R1134: 1. 源码：config.ts:392-458
R1135: 2. 输入：data[]、startTime、endTime（yyyyMMdd）
R1136: 3. 处理：生成全日期序列 → Map(dateValue→item)（**重复日覆盖**）→ 逐日取，缺日 → emptyValueGenerator 或默认 {dtime, revenue_amt_sum:null, revenue_amt_prev_sum:null, revenue_amt_sum_pop:null}
R1137: 4. 边界：非 8 位日期 → 原样返回；跨月/跨年由 Date 对象自动处理
R1138: 5. 验证：verification/verify-calculate.mjs（含缺月/重复/跨年用例）
R1139: 
R1140: #### C4. 饼图 TOP5+其他
R1141: 1. 源码：config.ts:257-323
R1142: 2. 处理：五级排序 → totalSum=Σ（**item[field] 直接加，null→NaN 风险**）→ ≤5 全出 / >5 TOP5+其他；percent=DIVIDE(value,totalSum)
R1143: 3. 验证：verification/verify-calculate.mjs
R1144: 
R1145: #### C5. 客户分布饼图 '其他' 置底
R1146: 1. 源码：config.ts:355-378；仅当其他索引存在且其余=5 且其他>0 才置底
R1147: 
R1148: #### C6. 表格分组/合并单元格
R1149: 1. 源码：ts:501-586
R1150: 2. 处理：分组（customer_name_account_name）→ 合计行置末 → 非合计按 total_tokens 降序（null 末）→ rowSpan/rowHide
R1151: 3. 验证：verification/verify-calculate.mjs
R1152: 
R1153: #### C7. getDateRange 日期窗口（含跨月/跨年）
R1154: 1. 源码：config.ts:212-232
R1155: 2. 例：getDateRange('20260302',5) → {startDate:'20260227', endDate:'20260302'}；getDateRange('20260102',5) → {startDate:'20251228', endDate:'20260102'}
R1156: 3. 验证：verification/verify-calculate.mjs
R1157: 
R1158: #### C8. formatDateToChinese / getSplitDateString
R1159: - formatDateToChinese('20260512')→'2026年5月12日'（非 8 位→''）；getSplitDateString：≤4 原样、≤6 'yyyy/MM'、8 位 'yyyy/MM/dd'（含 '/' 跳过）
R1160: 
R1161: ---
R1162: 
R1163: ### D. 交互与状态转移
R1164: 
R1165: | # | 触发 | 参数来源 | 原→新状态 | 受影响 | 可见结果 |
R1166: |---|---|---|---|---|---|
R1167: | D1 | 日期 Tab 切换（昨日/近7/近30） | activeTab | handleDateRangeChange → groupType HOUR/DAY、topStart/End、sevenCustomer、turnoverTrend 不变（仅 init 时定） | 指标卡/饼图/总量趋势/表格时间 | 数据按窗口刷新 |
R1168: | D2 | 日选择器 dayDateValue | headerOpt | 仅 current_day Tab 生效 → handleTodyDateChange | 同上（日窗口） | 刷新 |
R1169: | D3 | 总量趋势 模型/时间范围筛选 | usageTrendFilter | onUsageTrendFilterChange：model → SQL；**timeRange 无消费** | tokenTotalUsageData | 仅模型筛选生效 |
R1170: | D4 | 表格模型/日期筛选 | tableFilter | onTableFilterChange → customerTableModelName（时间范围无消费）；**页码回 1** | customerModelActivationStatusData + Total | 服务端查询 |
R1171: | D5 | 表格搜索 | keyword | onSearchChange → customerTableSearchKey；页码回 1 | 同上（API searchKey） | 服务端搜索（customer_name/account_name，API 侧） |
R1172: | D6 | 表格分页 | dataState.pagination | handleTableStateUpdate → customerTablePageSize/Offset | 同上 | 服务端分页 |
R1173: | D7 | 表格排序 | dataState.sort | → customerTableOrderType/SortDirection、页码回 1 | 同上 | 服务端排序 |
R1174: | D8 | 行波形图点击 | row | openTrendModal：tableTrendModalQueryParams（account_name+model_name+area）→ 默认 24小时弹框 | trendModalTokenTotalUsageData | 趋势浮层 |
R1175: | D9 | 浮层日期切换（24小时/7天/14天） | selectedTableModelSelectValue | onTableModelSelectChange → groupType/trendModalTimeRangeParam | 同上 | 浮层重查 |
R1176: | D10 | 浮层关闭 | - | hideDetailDialog：showDetailDialog=false、selectedCustomerInfo=null、重置选项 | - | 关闭 |
R1177: 
R1178: **筛选后页码/选中状态**：D4/D5/D7 均重置 currentPage=1（onTableFilterChange/onSearchChange/handleTableStateUpdate sort）；D6 分页保留当前页；**无选中态**（无 checkbox）。
R1179: 
R1180: **请求失败/空结果/晚响应**：无显式错误处理；空集有占位（趋势 [{x_time:'--'}]）；晚响应无重开逻辑（浮层关闭后查询返回不改变 showDetailDialog）。
R1181: 
R1182: ---
R1183: 
R1184: ### E. 导航契约
R1185: 
R1186: - 本页无可点击导航（指标卡无跳转、表格行无跳转）。唯一出口为浮层。
R1187: 
R1188: ---
R1189: 
R1190: ### 浮层清单（本页）
R1191: 
R1192: #### F1. 开通表趋势浮层（trendModalTokenTotalUsageData）
R1193: - 存在/启用：✅
R1194: - 打开：表格"Token用量波形图"列点击（thumbTrend 单元格）
R1195: - 参数：` and account_name='{row.account_name}' [and model_name='{row.model_name}'] {areaString}`（合计行不加 model_name）+ 弹框日期范围（默认 24 小时：dtime between dtime±0；7/14 天：initTime 为基准）
R1196: - 数据槽：x_time（h_tag/dtime）+ total_tokens_sum
R1197: - 图表绑定：dv-echarts（component.config.ts 内 trend_modal_chart 配置，未在本批逐行列出——见 token-specific-page.component.config.ts:600-750）
R1198: - 关闭生命周期：hideDetailDialog；打开时若已有旧数据则被新查询覆盖（无缓存复用）
R1199: - **区分**：复用页面已有结果？——**否，独立加载**（新数据源 + 行参数）
R1200: 
R1201: #### F2. 近30天流水趋势（tokenTrendChart）
R1202: - 页面内嵌图表（非浮层），数据 tokenTrendData（补日后每点 pop）
R1203: 
R1204: ---
R1205: 
R1206: ### UNKNOWN（本页）
R1207: 
R1208: 1. h_tag 与 HOUR 的字典语义（'00'-'23'？）；dtime 与 DAY 粒度映射——需接口字典（config.ts:36-38 注释 24 点 vs 实际解析 x_time）。
R1209: 2. trend_data 内字段名（hour/date vs x_time）不一致（C 节 B5 备注）。
R1210: 3. Σ 求和遇 null → NaN（C2/B1 各消费者，接口是否保证字段非空）。
R1211: 4. 表格 API 的 searchKey 匹配字段（customer_name/account_name like？）与 sortDirection/orderType 的合法值集合。
R1212: 5. customerTableTotal API 返回结构（count 字段名）未在代码中验证（datasource 无 fitFunction，直接取 customer_count 数组 [0]，ts:210 —— **customerCount 来自 rootContainer_containerObject_customerTableTotal_customer_count**，即接口字段为 customer_count 而非 count）。
R1213: ## 8. 机会点清单（opportunity-list）
R1214: ## 机会点清单（opportunity-list）
R1215: 
R1216: > 证据基线：`a260c10744add7fe013d5e4591fa1ecc407f8083`
R1217: > 组件：`OpportunityListComponent`（operation-map/opportunity-list/opportunity-list.component.ts，594 行）
R1218: > 模板：opportunity-list.component.html（113 行）+ opportunity-table/opportunity-table.component.html（84 行）
R1219: > 数据源：data-source-config.ts（277 行）；列：opportunity-list.config.ts（284 行）
R1220: > 入口参数：`type`（filterType）、`headerFilter`（key-value 逗号分隔）
R1221: 
R1222: ---
R1223: 
R1224: ### A. 页面与内容树
R1225: 
R1226: > 容器 `dv-canvas-lowcode` 无自有行集；**表格区使用主组件模板内嵌 ti-table（opportunity-list.component.html:27-108），非 opportunity-table 子组件**（`<iocmap-opportunity-table>` 未在主模板引用；opportunity-table 为备用/未启用实现，见 UNKNOWN 备注）。结构：搜索框 + 头部筛选器 + 表格（列头筛选/排序/分页）。
R1227: 
R1228: #### A0. 头部筛选器（headerOpt）
R1229: title='机会点清单'、breadcrumbsUrl（动态：非详情页来源时 = 上一页 URL；详情页返回时用 sessionStorage FROM_PAGE_KEY 记忆）、showLv2ProdRdTeamSelect/showRepofficeCheck/showIndustrySelect/showRegionSelect/showNaTypeSelect/showOverdueStatusSelect/showPresignedAmountSelect/showOpportunityStageSelect。
R1230: 
R1231: #### A1. 搜索框（commonSearchBox）
R1232: - 组件内 TiSearchbox；onSearch（ts:431-439）：`str = value.toLowerCase().replace(/'/g,"''")`（**单引号转义双写**）→ `and (LOWER(opportunity_name) like '%str%' or LOWER(party_company_name) like '%str%')` → 页码回 1
R1233: - onSearchClear → 清空 searchParam → 页码回 1
R1234: - **搜索写回查询侧**（searchParam 拼入 where），非本地状态
R1235: 
R1236: #### A2. 表格（opportunity-table 子组件）
R1237: 列定义 getOpportunityTableColumns（opportunity-list.config.ts:56-259）——完整 36 列：
R1238: 
R1239: | # | 列标题 | 展示字段 | 排序键 | 筛选 | 链接 |
R1240: |---|---|---|---|---|---|
R1241: | 1 | 机会点编码 | opportunity_code | - | - | - |
R1242: | 2 | 机会点名称 | opportunity_name | - | - | **clickable → project-detail** |
R1243: | 3 | 客户名称 | party_company_name | - | - | clickable=false（**注释说明：含子客户，详情页暂不支持子客户**）——但 jumpDetail 代码仍支持 party_company_name 跳转（ts:586-591）→ **模板绑定待核实**（见 UNKNOWN） |
R1244: | 4 | 客户级别 | public_cloud_na_level_name | - | - | - |
R1245: | 5 | 产业类型 | cloud_class | - | - | - |
R1246: | 6 | 总预签金额 | bidding_amount_label | bidding_amount | - | - |
R1247: | 7 | 本年度预计收入 | amount_estimated_label | amount_estimated | - | - |
R1248: | 8 | 赢率 | winodds | winodds | - | - |
R1249: | 9 | 机会点阶段 | opportunity_step | - | - | - |
R1250: | 10 | 机会点类型 | opportunity_type_name | - | - | - |
R1251: | 11 | 地区部 | region_dept_name_cn_fin | - | - | - |
R1252: | 12 | 代表处 | rep_office_name_cn_fin | - | - | - |
R1253: | 13 | 云行业 | sub_industry_level1_name | - | - | - |
R1254: | 14 | 云子行业 | sub_industry_level2_name | - | - | - |
R1255: | 15 | 机会点创建时间 | create_time | - | **date 筛选** | - |
R1256: | 16 | 进展更新时间 | update_time | - | **date 筛选** | - |
R1257: | 17 | 未刷新机会点 | is_unupdated_opportunity_label | - | headFilter（是/否） | - |
R1258: | 18 | 预签时间 | order_date_estimated | - | - | - |
R1259: | 19 | 超期状态 | overdue_status | - | - | - |
R1260: | 20 | 机会点责任人 | opportunity_owner | - | - | - |
R1261: | 21 | 立项状态 | ati_status_label | - | headFilter（ProjectStatus） | - |
R1262: | 22 | 应立项级别 | should_project_level_name | - | headFilter（projectLevelItems） | - |
R1263: | 23 | 项目进展 | project_progress | - | - | - |
R1264: | 24 | 项目风险 | project_risks | - | - | - |
R1265: | 25 | 困难求助 | project_help_required | - | - | - |
R1266: | 26 | 最近一次分析会时间 | latest_analysis_meeting_time | - | - | - |
R1267: | 27 | 销售模式 | sales_mode | - | - | - |
R1268: | 28 | 伙伴名称 | partner_real_customer_name | - | - | - |
R1269: | 29-40 | 1月..12月客观预测 | forecast_xx_label | forecast_xx | - | - |
R1270: 
R1271: **行内派生（setTableData，ts:400-428）**：
R1272: - index = starSort + i（starSort=offset+1，行序号从窗口起点开始）
R1273: - ati_status_label = ProjectStatus.find(value===ati_status)?.label（constant/filtering-items-set.ts：Not_Initiated→无需立项、Waiting_Ati→达标待立项、In_Project_Initiation→立项中、Initiated→已立项；**未知值 → undefined → 显示空**）
R1274: - is_unupdated_opportunity_label = 1?'是':'否'（非 1 → '否'）
R1275: - bidding_amount_label / amount_estimated_label / forecast_xx_label = OPERATION_BILLION
R1276: - **winodds = DataFilter(winodds×100).POINT_ONE + '%'** —— **winodds null → null×100=NaN** → DataFilter(NaN) 输出？需 DataFilter 字典（UNKNOWN；**来源表达式：无 null 保护**）
R1277: 
R1278: #### A3. filterType（路由参数 type）
R1279: FILTER_TYPE_SQL_MAP（ts:38-45）：
R1280: - valid_opportunity_cnt → ` and is_valid = 1`
R1281: - qualified_unprojected_opportunity_cnt → ` and is_operating_to_be_issued = 1 and is_operating_issued != 1`
R1282: - project_initiated → ` and project_initiation_status = 'Issued'`
R1283: - 其他值 → special_sql=null（无过滤）
R1284: 
R1285: #### A4. headerFilter（路由参数）
R1286: applyHeaderFilter（ts:223-261）：`headerFilter=ati_status-Issued|Pending,project_initiation_status-CSSC` 格式；逗号分多组、竖线分多值；按列 filterField 匹配 headFilter.options → selected → updateFieldFilterList → fieldFilterParams SQL（buildInString IN 条件）。**找不到列/无 headFilter → 忽略**。
R1287: 
R1288: ---
R1289: 
R1290: ### B. 查询返回之后的输入契约
R1291: 
R1292: #### B1. PROJECT_MAP_OPPORTUNITY_DETAILS_M（主查询）
R1293: - 消费者：表格 + 总数
R1294: - 字段（data-source-config.ts:15-244）：mtime、opportunity_code、opportunity_name（orderDesc 默认）、party_company_name（orderDesc）、party_number、project_initiation_name、bg_type_code、public_cloud_na_level_name、bg_type、is_unupdated_opportunity、order_date_estimated、cloud_class、overdue_status、overdue_status_code、participable（排序条件模板）、bidding_amount、amount_estimated、winodds、ati_status、opportunity_step、opportunity_type_name、region_dept_name_cn_fin、rep_office_name_cn_fin、sub_industry_level1_name、sub_industry_level2_name、create_time、update_time、opportunity_owner、project_initiation_status、should_project_level_name、project_initiation_level、project_progress、project_risks、project_help_required、latest_analysis_meeting_time、sales_mode、partner_real_customer_name、forecast_jan..dec（排序条件模板）、is_state_funded、gov_project_id、gov_project_name、base_attributes
R1295: - where：`queryParams + searchParam + fieldFilterParams + special_sql`（全部查询侧拼接）
R1296: - limit/offset：服务端分页（localVars.limit=10 默认、offset）
R1297: - 排序：服务端（各字段 orderDesc/orderAsc 条件模板按 localVars.is_asc/sorting_field 触发）
R1298: - 行粒度：机会点×月（mtime）；**唯一键 opportunity_code+mtime**；**排序保证**：默认 opportunity_name/party_company_name orderDesc（仅当条件模板满足时对 bidding_amount 等排序）
R1299: 
R1300: #### B2. PROJECT_MAP_OPPORTUNITY_DETAILS_M cnt（总数）
R1301: - 同 where（无 limit/offset）；字段 cnt；`?.[0] || 0`
R1302: 
R1303: #### B3. initQueryParams（ts:340-398）构建的 queryParams
R1304: ```
R1305: mtime = '{opportunity_outline_end}'
R1306: [and is_key_poffice = 1]           # repOfficeCheck==='1' 且 !isRepOfficeDisabled
R1307: [cloud_class_code in (...)]        # lv2ProdRdTeam
R1308: [region SQL]                       # headerOptionService.getRegionQueryStr()
R1309: [public_cloud_na_level in (...)]   # naType
R1310: [sub_industry_level1_code/2 in (...)]  # industry（children 判级）
R1311: [overdue_status_code in (...)]     # overdueStatus
R1312: [opportunity_step in (...)]        # opportunityStage
R1313: [bidding_amount 区间]              # presignedAmount [start,end]
R1314: ```
R1315: 
R1316: ---
R1317: 
R1318: 
R1319: ### C. 查询后计算与转换
R1320: 
R1321: #### C1. 行派生（见 A2）
R1322: - 序号：offset+1+i（**服务端分页下序号连续**）
R1323: - 比率：winodds×100 POINT_ONE（**无 null 保护**）
R1324: - 金额：OPERATION_BILLION
R1325: - 枚举：ati_status_label / is_unupdated_opportunity_label
R1326: 
R1327: #### C2. 列头筛选（buildInString IN 条件）
R1328: - handleColumnFilter → updateFieldFilterList（ts:460-479）：选中值数组 → ` and {filterField} in ('v1','v2')`；**清空选中 → 该字段条件移除**；页码回 1
R1329: 
R1330: #### C3. 日期列筛选（onSelect，ts:481-532）
R1331: - 月份选择：start/end 为所选月份 Date → start=当月 01 00:00:00、end=月末 23:59:59 → ` and {field} between 'yyyy-MM-dd 00:00:00' and 'yyyy-MM-dd 23:59:59'`；单端同理 ≥ / ≤
R1332: - 清空 → 移除该字段条件；页码回 1
R1333: 
R1334: #### C4. 搜索转义（onSearch）
R1335: - 单引号 → 双写（SQL 注入防护）；LOWER like 双侧模糊
R1336: 
R1337: ---
R1338: 
R1339: ### D. 交互与状态转移
R1340: 
R1341: | # | 触发 | 参数来源 | 原→新状态 | 受影响 | 可见结果 |
R1342: |---|---|---|---|---|---|
R1343: | D1 | 头部筛选 | headerOptSelect | initQueryParams → queryParams | 主查询+总数 | 数据刷新 |
R1344: | D2 | 搜索（主模板搜索框） | keyword | searchParam SQL；页码回 1（initCurrentPage：currentPage=1、offset=0） | 主查询+总数 | 查询侧过滤 |
R1345: | D3 | 搜索清空 | - | searchParam=''；页码回 1 | 同上 | 恢复 |
R1346: | D4 | 列头筛选（headFilter normal） | column.headFilter.selected | fieldFilterParams；页码回 1 | 同上 | 查询侧 IN 过滤 |
R1347: | D5 | 日期列筛选（headFilter date） | onSelect | fieldFilterParams；页码回 1 | 同上 | 查询侧时间窗 |
R1348: | D6 | 表格排序 | dataState.sort | is_asc/sorting_field → 服务端排序条件；limit/offset 更新；starSort=offset+1 | 主查询 | 查询侧排序 + 序号重编 |
R1349: | D7 | 表格分页 | dataState.pagination | limit/offset 更新；starSort 更新 | 主查询 | 服务端分页 |
R1350: | D8 | 行点击（机会点名称列 clickable） | row | jumpDetail → jumpOpportunityDetail(routeUrl='opportunity-list', {row, mtime: **row.mtime**}) | 导航 | project-detail |
R1351: | D9 | 行点击（客户名称列——**clickable:false，不跳转**） | row | 无（模板 `@if (column.clickable)` 才绑 jumpDetail；客户列 clickable=false → 普通单元格） | - | 不跳转 |
R1352: 
R1353: **D8/D9 日期来源差异（任务 §五.E 特别核实）**：
R1354: - 项目详情：mtime = **点击行的 row.mtime**（ts:580-581）
R1355: - 客户详情：**当前版本客户列 clickable=false，不跳客户详情**（config.ts:59 注释：含子客户，详情页暂不支持子客户查询）；component.ts:586-591 的 jumpCustomerDetail 分支是死代码（模板永不触发）——**与任务描述"机会点清单进入客户详情使用页面日期"不符**：当前源码该入口已禁用（SOURCE-READ 确认）。
R1356: - 源码确认（project-overview → opportunity-list 阶段传参）：见 project-overview.md E6。
R1357: 
R1358: **筛选改变后页码/选中状态**：所有筛选/搜索/排序 → 页码回 1；无选中态（无 checkbox）；**列头筛选改变 → fieldFilterParams 重新 join**。
R1359: 
R1360: ---
R1361: 
R1362: ### E. 导航契约
R1363: 
R1364: | 来源 | 触发 | 目标 | 参数 | 参数来源 | 缺值 |
R1365: |---|---|---|---|---|---|
R1366: | E1 | 机会点名称行（clickable=true） | /operation-map/project-detail | from='opportunity-list'+search、page_title=project_initiation_name（ati_status==='Initiated'）或 opportunity_name、opportunity_code=row.opportunity_code、mtime=**row.mtime**、ati_status_label、project_initiation_level、public_cloud_na_level_name、sub_industry_level1_name | 点击行 | opportunity_code 缺失 → project-detail 无数据（跳转仍发生） |
R1367: | E2 | 客户名称行（**clickable:false，禁用**） | - | 不跳转 | - | - |
R1368: 
R1369: - 返回状态：面包屑记忆（FROM_PAGE_KEY sessionStorage，ts:154-173）；详情页返回 → 用记忆的上游页。
R1370: 
R1371: ---
R1372: 
R1373: ### 浮层清单（本页）
R1374: 
R1375: - 本页无浮层。
R1376: 
R1377: ---
R1378: 
R1379: ### UNKNOWN（本页）
R1380: 
```
