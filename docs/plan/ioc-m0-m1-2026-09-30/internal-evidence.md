# 给内部来源维护者的精确补证请求

背景：将IOC启用业务内容迁移至MetricCanvas，本阶段不接真实数据、不改DQE、不要求开放整个源码仓。已有第一批报告自述基线 a260c10744add7fe013d5e4591fa1ecc407f8083。请只补以下消费者证据，每项提供：当前commit、源文件及行号、启用模板/绑定片段、匿名输入/输出、排序/完整性保证、能否确认及原因；未执行浏览器/接口请明确not-run。可分项返回，不必重写报告。

| 页面与消费者 | 请返回的具体材料 | 阻塞范围 |
|---|---|---|
| 客户详情 customer-detail：客户声音/授信/客户合同KPI | 当前启用卡模板→最终数据槽→源字段→时间窗口→单位。确认unresolvedcnt/allcnt、ptd_amt、totalCreditBalance各覆盖哪个配置槽；risk_contract_count是计数还是金额 | 这些卡字段和精确显示，不阻塞经营进展 |
| 客户详情：基本信息 | customer_basic_info正确where/输入绑定；报告party_number=mtime是否笔误；声音更多链接html:821与模板704行矛盾的实际启用片段 | 基本信息和链接真实性 |
| 客户详情：空间格局表8份额 | 华为云/阿里云/腾讯云/IDC/AWS/Azure/Google/其他逐列：源字段→计算输出→列绑定/表头/单位/合并规则，不能返回share_xxx占位 | 8列绑定；已知计算可先验 |
| 客户详情：声音表及云服务明细浮层 | QueryCustomerVoiceDetail、CDI_IOC_Customer360_Voice_Detail_Intl、Income_Detail/Sum/Count匿名响应；列数组同序同长保证或稳定关联键，空/缺列/总数缺失/错误响应；明细CURINCOME排序和count口径 | 归一化与对应消费者，不能先假设数组可靠 |
| 客户详情：机会点名称导航 | 启用名称点击模板及opportunity_code实际来源；当前报告查询字段没有该标识 | 名称导航，不阻塞其他字段 |
| 客户详情：双年趋势重复月 | revenue_trend_chart、cloud_service_trend同mtime重复时稳定顺序契约/匿名示例（已有前端排序事实无需重复解释） | 精确择取重复期，不阻塞唯一月份 |
| 经营概览 business-overview：卡和四启用Tab | 完整启用卡模板（5卡/7项矛盾），AreaColumns/regionColumns/downColumns/growColumns逐列配置；确认show=false的收入TOP10NA无需实施 | 覆盖数量、字段/排序/动作；不恢复禁用Tab |
| 经营概览：地图和日期 | 两层地图字典、阈值单位、三日期最新时钟匿名值；同代表处同指标重复取后项的稳定顺序依据 | 地图精确输出/重复键，不要求修改目标计算 |
| 项目主页 project-overview：概览表/地图 | realized region_code/repoffice_code与flow/target region_dept_code_fin/rep_office_code_fin值域对照，匹配/不匹配/重复匿名例 | 跨源关联准确性 |
| 项目主页：分层卡/TOP/丢单 | 3卡/4项完整模板；两个表完整启用列；TOP查看清单到底routeFilterParams还是projectInitiationStatus；CSSC实际传参片段；地图阈值原值是比例还是百分数 | 覆盖分母、TOP导航/地图；CSSC显式传递方向已定 |
| Token专项 token-specific：趋势与开通表 | trend_data真实解析前后示例（x_time/hour/date）；h_tag格式/时区；customer_count原响应；分页单位客户还是行、是否完整返回客户×账号组、客户跨账号如何计数；合法排序键 | 趋势格、页数和分组；不允许假设完整组 |
| Token专项：趋势浮层及无效时间控件 | component.config:600–750完整图表绑定；24小时/7天/14天参数；主图/表格时间控件无消费是否仍可见，用当前模板定位 | 浮层契约/可见无效交互，不擅自修正旧业务功能 |
| 机会点清单 opportunity-list：主表 | 主模板html:27–108实际逐列绑定、排序、筛选、链接；与备用opportunity-table关系；36/40矛盾解释；客户列clickable:false确认 | 启用列分母，不恢复客户死链接 |
| 五页金额/比率/枚举显示 | ANA准确版本及0/null/-1200/0.5/50输入的原始输出字符串；数字枚举43/1语义；未知枚举样例 | 精确字符串对账，不阻塞已知原始数值 |

我们自行负责详情查询分页、局部筛选、固定汇总、计算闭集/空值策略、TOP5及时间对齐。查询分页全量搜索受本阶段“不改DQE”约束，不能让内部补证替代这个目标侧缺口。第二批其余16启用入口仍需后续证据，本请求不缩减最终范围。
