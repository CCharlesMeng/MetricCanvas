# 数据计算场景

## 条件显隐与按需取数

入口 `/pages/conditional-query-demand`，显式 Dashboard，表格和柱线组合图复用现有布尔及维度筛选。页面声明合成查询；自动浏览器验收拦截 DQE HTTP 并返回合成数据，执行 `pnpm --filter playground exec playwright test tests/conditional-query-demand.browser.ts` 即可启动页面试验场并观察。手动浏览需向已配置的数据网关提供同名合成字段，不代表真实业务查询。

初始勾选“显示明细”时查询评分与达成率；取消后评分列消失且补充查询停止，图表只请求销售额，类别维度保持。此时切换到“合成范围B”，评分和达成率仍不查询；重新勾选后两者以 B 范围恢复。浏览器 Network 中检查 `dsl_list[].output_metrics` 及范围条件；页面操作和自动断言消费同一份 JSON。共享消费者、默认排序、计算依赖、零业务列、外部事实等待/错误、取消及迟到响应另由运行时集成测试覆盖。合成 HTTP、静态校验和真实 DQE/Relay 分层报告。

## 当前值与前端均值并排柱

入口 `/pages/sdt-period-aggregation`，执行 `pnpm dev:playground`，无需额外服务或参数。页面底部「代表处决策次数：当前值与均值」用两个柱系列绑定同一字段，均值系列声明 `aggregate: "avg"`。

默认近一年：甲两根柱120/90，乙60/90，丙当前值空、均值90。均值为(120+60)/2，空值不计分母。切「月」后甲10/7.5、乙5/7.5；切回「近一年」恢复90。表格翻页不改变均值，横轴始终只有代表处。`?state=missing` 为120/87.5和55/87.5；`?state=error|truncated|duplicate` 不展示部分聚合或伪均值。

悬停任一代表处可同时查看当前值和均值，两组颜色、图例独立。图例可隐藏/恢复任一系列，点击均值不触发原始行联动。宽窄屏均检查并排柱及旋转类别文字。把两系列改绑时长字段时，近一年6.5和0参与计算、均值3.25。非法配置可将均值系列改成折线，或设置 stacked:true，或将 aggregate 改为 sum；校验须给出系列路径错误。

数据是预览 Adapter 的合成月度回执，不代表真实DQE/Relay验真；算术均值也不是加权业务口径。浏览器脚本 `apps/playground/tests/bar-series-average.browser.ts` 覆盖当前值/均值提示、期间重算、分页、宽窄屏和截断状态。

## 近一年字段聚合（6.97）

启动 `pnpm dev:playground` 后打开 `/pages/sdt-period-aggregation`，无需 URL 参数或 DQE 服务。页面查询字段取自商务 SDT 报告的代表处效率；预览 Adapter 提供逐月合成回执，不实现年度聚合。默认近一年：甲决策次数120、月均时长平均6.5天；乙60次、0天；丙两项均为 `--`。每页2条，第二页可见丙；Chart 仍消费完整3组结果。点击次数列排序后按年度次数排序，导出包含全部3组原值，而非当前2行。

切换“月”后只执行普通单月查询，甲10次、时长为月份数字；切回“近一年”恢复120与6.5。`?state=missing` 在每年2月缺少乙记录，乙为55次、0天，平均分母不补缺月；`?state=error|truncated|duplicate` 分别提供失败、总数不一致、同月重复键，均拒绝输出部分年度值。表格保留表头，诊断在控制台；完整导出同样失败。

浏览器验收脚本 `apps/playground/tests/period-aggregation-browser.mjs`，默认服务端口5276，可用 `PLAYGROUND_BASE_URL` 覆盖。脚本覆盖表格、Chart tooltip、切换、分页、Excel 原值和截断错误。取消、空值、字段引用及版本由定向测试覆盖。该场景不证明真实 DQE 月度口径、Relay 或部署。

## 金额单位与舍入（6.88）

启动 `pnpm dev:playground` 后打开 `/pages/operation-money-formats`，无需 URL 参数、DQE 或凭据，全部为 inline 合成数据。首 section 首组件为 iocHeader。默认人民币：卡片与图表标签显示 2.5亿，选择表格显示 2.5亿；切换美元后三者显示 250M，切回恢复。金额字段相互独立，数字相同只用于格式对照，不表示汇率。

下方对照表同时显示人民币 A/B、美元与旧格式：999 分别为 999、999元、999$；12,345 为 1.2万、1.2万、12.3K；99,999,999元保留 10,000万；-105,000元为 -11万；-1,005,500美元为 -1,006K；-0.4 显示 0、0元、0$；缺失为 --。通用金额列从6.93起去尾零，小额美元取整；A/B和美元$个性化格式保留。点击选择表格“导出”可下载基本单位原数值 250000000，标题按所选币种变化。

浏览器验收：`node apps/playground/tests/operation-money-formats-browser.mjs /tmp/mc-money-browser`（先在5267启动 Playground，或设置 PLAYGROUND_BASE_URL）。脚本直接访问本页，核对卡片、表格、图表 tooltip、切换、Excel 原值和窄屏，并记录截图和结果。非法币种、旧版本使用新格式及非有限数值由定向行为测试补充。本地通过不证明真实旧系统库输出、DQE、Relay、模型或部署。

## 创作百分比与覆盖边界

启动 `pnpm dev:playground` 后打开 `/pages/authoring-percent-coverage`，无需 URL 参数或 DQE。页面为 inline 合成数据，字段默认格式对应创作工具在部分/未知覆盖下的百分比决策。表格依次显示 12.5%、0.0001%、-0.0001%、0%、--；原值列保留 12.5、0.0001、-0.0001、0 和缺失。显式一位格式列显示 12.5%，证明组件意图仍优先；指标卡继承 12.5%。排序仍使用原值。该页不调用 Python query_data；覆盖率与来源建议修正、精度限制告警由字段/查询回归验证，浏览器只证明渲染与绑定。真实 DQE、Relay、模型与保存另验。


## 空组织键兼容

启动 `pnpm dev:playground` 后打开 `/pages/missing-organization-key`，无需 DQE 服务或 URL 参数。页面沿用Schema6.74，全部为 inline 合成数据，无新增开关。上表显示甲0、乙单项缺失且总分0、丙-2；页面不插入诊断提示；控制台 warning 记录来源a跳过2行、b跳过1行，同一来源并集与关联不重复计数。下表所有组织键都为空，显示空态，跳过2行的诊断仅在控制台输出。类型异常、重复键、依赖失败及导出告警由定向回归覆盖；此页不证明真实 DQE 或内网部署。

## 组织键并集

启动 `pnpm dev:playground` 后打开 `/pages/union-keys-demo`（inline 合成）。三个组织按键并集显示：甲真实0、乙单项全缺但总分0、丙负数-2；单项缺失显示 `--`。Schema6.74。完整查询响应验证入口 `/pages/partner-health-union-null-probe`，见对应临时页 README；正式 `/pages/partner-health` 继续使用真实 DQE。

## 缺项得分归零

启动Playground后打开 `/pages/sum-fields-missing-values`（inline合成）。部分缺项分类8、风险-2、总分6；全部缺项和真实零值均为0。非法非空值/溢出由行为测试覆盖。Schema6.71，真实DQE另验。


## 整数与缺失值显示

入口 `/pages/numeric-value-display`，[完整页面](numeric-value-display.json)。启动 `pnpm dev:playground`，无需 URL 参数和数据服务；全部为 inline 合成数据。

查看表格：整数行依次显示 `50`、`50%`、`50万`；小数行显示 `12.5`、`12.5%`、`12.5万`；零行显示 `0`、`0%`、`0万`；负整数行显示 `-12`、`-12%`、`-12万`。缺失行默认 `--`（百分比为 `--`）；数值列、缺失指标和进度环分别覆盖旧 `--` / `—` 配置，仍按数值或百分比显示缺失文案。自定义缺失列显示“未提供”。上方指标卡显示 `50%`，缺失指标及进度环显示 `--`，进度环显示 `--`。该页只验收呈现，不代表真实 DQE 查询或线上发布。


## 全局语义数值规范

入口 `/pages/semantic-numeric-display`，[完整JSON](semantic-numeric-display.json)。启动 `pnpm dev:playground`，无需URL参数及数据服务，全部为inline合成数据。

PC下人民币显示1.23万，视口缩至390px后为1.2万；美元为12.3K。普通比率12.3%、微小比率0.001%、500%显示上升>500%。SLO保留99.999%，人力为12,345个；核、资源TB、存储GB和带宽Mbps分别显示1.23万核、1.23万TB、1 TB、1 Gb/s。套餐时长1.23千分钟，消息1.23万条，3666秒计费显示1.02小时。变化项显示+12.3%且没有箭头。

基期边界表的增长率依次为+12.3%、--、--、--、上升>500%、-50%；导出Excel保留原始数字及冻结展示格式。图表显示1 TB、2 TB，零合计饼图画布缺失标签为“--”，两个 ASCII 短横线相邻。真实零、负数、阈值两侧和一般ratio的行为由单元/集成测试补充。这些检查不代表真实DQE、Relay或真实模型。

## 最多五位小数（6.107）

入口：`/pages/number-precision-five`；[页面 JSON](number-precision-five.json)。无需 URL 参数或外部数据服务，全部为内联合成数据。启动 `pnpm dev:playground` 后访问该入口。

1. 对照表格三、四、五位普通数值与带符号列：1234.12345678 分别显示 1234.123、1234.1235、1234.12346，带符号列正数前有 +，无千分位；12.3 不补零，9.999999 舍入进位。
2. 比较三、四、五位正负边界，以及 ±0.000004：五位格式的 ±0.000005 显示 ±0.00001，±0.000004 显示无符号的 0 且无正负颜色。零显示 0，缺失显示 --。
3. 指标卡每行的正负变化显示对应 ↑/↓，舍入零无箭头、无正负颜色。图表标签、悬浮提示及数值轴沿用五位带符号格式。
4. 关键异常由契约测试复现：新预设在 6.106 及更早版本报能力下限，number-6 和 number-6-signed 均非法。

页面展示及浏览器验收只覆盖本地渲染，不代表真实 DQE/Relay 接入。

## 四舍五入整数（6.113）

复用用途：现有数值精度场景增加 `number-0`，四舍五入显示为无千分位整数，保留原始数据精度。

参考对象：[完整页面](number-precision-five.json)，入口 `/pages/number-precision-five`。`precision-table` 的末三列对照原值、显式整数和字段默认；`integer-metric`、`integer-chart` 复用统一格式；分区标题中的数字参数也使用该格式。

移植边界：映射实际数字字段及数据源，整数能力要求版本至少6.113；合成数据无需移植。`number-0-signed` 未提供，原值与计算、排序保持。

可观察预期与环境：执行 `pnpm dev:playground`，无参数、无需外部服务。末三列 `1234.4 → 1234`、`1234.5 → 1235`、`-1234.5 → -1235`、`±0.4 → 0`，空值为 `--`。分区目标显示13，整数指标卡显示1234，整数柱图标签及提示显示整数。Excel 保留原始数值，以相同整数文本展示。将 schemaVersion 改为6.112应因整数能力被拒绝；自动验收见 `apps/playground/tests/number-integer.browser.ts`。不代表真实 DQE/Relay 或部署验真。


## Excel 基础数字精度统一

入口 `/pages/numeric-precision-export`、`/pages/number-precision-five` 和 `/pages/numeric-value-display`，运行 `pnpm dev:playground`，无需 URL 参数或真实服务。三个页面均使用 inline 合成数据。页面普通及带符号的 number-0 至 number-5 按最大精度四舍五入、去尾零，舍入零为0。导出表格后核对原值未变，基础精度列不再使用固定显示文本；将单元格改成整数、小数或舍入零，Excel 原生数字格式与条件格式继续按列精度生效，不出现尾随小数点或正负零。父子表及分组表头沿最终工作表行列生成规则。

`packages/engine/runtime-ui/tests/workbook-number-format.test.ts` 使用独立 ExcelJS 读取器验证真实 XLSX 的原值、类型、数字格式、条件公式及合并区域；`apps/playground/tests/numeric-precision-export.browser.ts` 覆盖0至5位页面显示和浏览器下载，`number-precision-five.browser.ts` 覆盖颜色与箭头。桌面 Excel 的实际打开与编辑属于另行验收，不以结构回读冒充。显式展示单位、自适应数字与百分比仍沿各自已定义的导出策略。
