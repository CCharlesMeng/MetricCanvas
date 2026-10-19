# 页面验收场景

新功能按[必选验收要求](../docs/agents/feature-acceptance.md)维护完整页面、协议文档和本地创作 Skill。页面试验场首页按用途列出所有页面；下列场景提供明确操作与预期。JSON 是运行输入，测试直接读取同一文件。

## Windows gray 开发环境

这是页面试验场的开发服务器配置，不新增页面能力或协议字段，页面文档与本地创作 Skill 沿用当前版本。配置与 hosts/HTTPS 步骤见[试验场说明](../apps/playground/README.md#windows-本地连接-gray-cloudioc)。

- 复用已在目录注册的完整业务页面 [business-sdt-report-monthly.json](business-sdt-report-monthly.json)，入口 `https://local.cloudioc.huawei.com/pages/business-sdt-report-monthly`；它包含业务查询，不承诺 gray 环境具备对应数据集和权限。
- Windows 填入有效 cftk 并打开开关后，运行 `pnpm dev:playground`，加载页面并提交报告月份。动态查询经本地 DQE 路径代理到 gray 的同路径；浏览器和上游请求均带配置中的 cftk，可在 Network 的 Request Headers 查看。请求体及页面绑定沿用原规则；静态构建不注入 cftk。仅该开发代理设置 `secure: false`。
- Windows 启用但 cftk 为空或包含无效换行时启动失败；关闭开关恢复原有仿真代理。macOS/Linux 即使打开开关也保持 HTTP 5173 和仿真代理。灰度服务的查询拒绝或鉴权失败沿现有错误处理呈现，不回退到仿真数据。
- 配置边界由 `tests/dev-server-contract.test.ts` 覆盖；本批次按用户要求不启动服务器、不做浏览器或真实 Windows/gray 联调，不能据此声称业务取数成功。

## 商务 SDT 报告与单月筛选

- 原页面：[business-sdt-report.json](business-sdt-report.json)，入口 `/pages/business-sdt-report`，保留人工维护的固定2026年10月报告。
- 新页面：[business-sdt-report-monthly.json](business-sdt-report-monthly.json)，入口 [商务SDT报告（单月筛选）](http://localhost:5173/pages/business-sdt-report-monthly)，目录「经营分析」。从当前原页复制，保留全部图表、表格和业务查询口径。
- 在报告顶部「报告月份」提交2026-09，报告主标题和「统计月份」同步变化；15个查询声明均绑定月份；实际呈现的14个查询联动，其中11个取所选月，3个趋势取含所选月的近6个月。2026-09对应2026-04～2026-09，2020-06对应2020-01～2020-06。
- 月份必选，最早2020-06，无上限。日历禁用2020年1—5月和更早年份；手工提交2020-05或非法月份时显示错误，标题、已应用月份与查询保持不变。URL `?report-month=2020-06` 可初始化，越界URL回退合法默认月2026-10。
- 原页另有未被组件消费的 `rep-office-efficiency` 查询声明，新页保留并配置月份绑定，运行时按既有规则不主动执行。
- 报告摘要保留原页内容并明确标记为「2026年10月固定摘要（不随月份筛选更新）」，本次不提供动态数值或排名摘要。
- 协议页面：[time-point-min-page.json](../packages/page/fixtures/contract-valid/time-point-min-page.json)，覆盖 month/date 两种下限。协议见[时间点下限](../docs/page-metadata/filters.md#时间点下限624)。
- 自动验收读取新页面：`packages/embed/tests/browser/business-sdt-monthly.spec.ts` 检查14个呈现查询窗口、文字联动、选择器禁用、越界草稿、URL与空结果。测试使用明确的合成传输回放，只证明交互与绑定，不能证明真实业务数据。
- 运行 `pnpm dev:dqe` 可预览；本地DQE Sim未覆盖此人工更新报告的完整15个查询，直接预览可能显示查询失败。真实DQE、Relay、线上部署不属于本地验收结论。

## 多查询表格

- 页面：[multi-query-table.json](multi-query-table.json)，试验场「验收样例 → 多查询表格验收（仿真）」。
- 启动：在仓库根运行 `pnpm dev:dqe`，打开 [多查询表格](http://localhost:5173/pages/multi-query-table)。该命令同时启动 DQE Sim 与页面试验场；保持统计月份为 2026-09。
- 数据：8 个代表处的合成数据，仅支持本地 DQE Sim；页面无真实业务查询或能力证明。顶部月份改变到其他期间会显式失败。

页面同时提供两张独立组合表，共用普通查询定义。场景一的「序号」由 `ordinalField` 在当前排序/筛选后编号；场景二的「预签金额排名」来自普通查询字段 `bidding_rank`，在完整统计月份行域按预签金额降序计算，再按代表处编码投影。场景二的表格排序、筛选和搜索保留原名次；同额按编码升序打破并列。本组合源不计算固定业务排名，真实接入需上游返回已验真的排名字段。

以下操作先在场景一执行：

| 操作 | 预期结果 |
|---|---|
| 初次打开 | 预签金额降序第一页：上海、北京、广州；总数8，页大小3 |
| 点击召开率表头两次，切到降序 | 第一页上海、深圳、北京；独立图仍为8类，下方独立完整表仍为8行 |
| 下一页 | 杭州、成都、广州；序号4、5、6 |
| 召开率降序时，金额下限输入150000000并提交 | 回到第一页，匹配上海、北京、广州，总数3；金额按元比较 |
| 再加召开率下限85 | 跨源条件 AND 后仅上海，总数1；百分数使用原始刻度85 |
| 清空数值条件，搜索「天津」并提交 | 在完整行域匹配天津，共1行；独立图与完整表保持8行 |
| 清空搜索后导出 | Excel 含全部8条数据；有过滤时只导出全部匹配行；未提交或非法草稿不进入导出 |

然后在场景二执行以下操作，场景一的已提交视图保持独立：

| 操作 | 预期结果 |
|---|---|
| 初次打开 | 上海、北京、广州，预签金额排名1、2、3 |
| 召开率切到降序 | 上海、深圳、北京，预签金额排名1、4、2 |
| 下一页 | 杭州、成都、广州，预签金额排名5、6、3 |
| 召开率下限85 | 回到第一页，仅上海、深圳，预签金额排名1、4；不会重新编号为1、2 |
| 上述条件下导出 | 两条匹配数据的预签金额排名仍为1、4 |
| 清除条件，搜索天津 | 唯一结果的预签金额排名仍为8；场景一序号表在相同搜索下为1 |

协议见[数据源](../docs/page-metadata/data-sources.md#多查询组合源-pagedjoin622)、[表格](../docs/page-metadata/components/table.md#数值范围和组合表622)。自动证据为 `packages/embed/tests/browser/paged-join.spec.ts` 与 `tools/dqe-sim/tests/multi-query-table.test.ts`，直接读取本页面；其他错误、取消与范围边界由共享执行测试覆盖。既有实施证据见[验收报告](../docs/evidence/multi-query-table/result.md)，真实接入仍按报告单独验收。

### 时间选择统一入口

时间选择控件统一默认禁止未来时间；表头日期范围在 [IOC 机会点清单](ioc-opportunity-list.json) 的“机会点创建时间／进展更新时间”列验证。

时间选择集中在两个页面，均位于页面试验场「功能演示」，可按“时间选择”搜索；不再为测试变体新增独立演示卡片。

| 页面 | 入口 | 覆盖能力 |
|---|---|---|
| [Report 时间选择与联动](report-date-filter-example.json) | `/pages/report-date-filter-example` | 单月、月份范围、标题及正文联动、清空、参数初值、禁止未来月份及日期 |
| [Dashboard 期间选择与查询](dashboard-period-filter.json) | `/pages/dashboard-period-filter` | 顶部统一筛选中的年／季／月／近一年，以及查询范围与未绑定查询对照 |

Report 页面按三节组织，控件相互独立：

1. “单月与范围文字联动”：报告月份初始为2026-09，改为2026-10后标题和正文同步变化；未提交草稿与无效输入不改变已应用标题。清除后显示“全部期间 经营分析报告”。对照期间支持范围及同月折叠，本节不改变明细查询。
2. “范围筛选与查询联动”：报告期间由页面参数初始化为2026-01至2026-06，修改后当前期间与月度明细同步变化。这一节使用本地 DQE 仿真；运行 `pnpm dev:dqe` 和 `pnpm dev:playground` 后操作，不代表真实业务数据。
3. “月份与日期禁止未来时间”：所有控件默认限制未来时间，不需逐个启用。受限月份／日期另展示2020-06下限；日期范围不能结束于明天，精确时间范围不能超过当前分钟。面板、输入、URL 和外部状态写入均受限，非法值保留已应用状态，不触发查询；跨月后新月份可选。

原 `report-title-filter-example`、`time-point-no-future` 的演示能力已并入 Report 页面；旧独立页面入口撤下。浏览器回归直接消费聚合页，协议专用夹具仍保留。

## 查询数值容错

- 页面：[query-numeric-tolerance.json](query-numeric-tolerance.json)，试验场「验收样例」，或直接打开 [数值容错](http://localhost:5173/pages/query-numeric-tolerance)。
- 数据：八行固定合成数据，含正常数值、占位符、null、数字字符串、真实零、负数、布尔和空串；首屏使用 initial，本地动态查询由 DQE Sim 提供相同原始值。
- 操作：启动 `pnpm dev:dqe` 后打开页面；表格应保留八行，数值依次为 10.0、—、—、12.5、0.0、-4.0、—、—，完成率按相同缺失规则计算。折线保留 10、12.5、0、-4 四个有效点及其间缺口。排序后八行仍保留。两张指标卡分别显示缺失占位符和真实的 0%，缺失值进度环不能显示 0%。
- 动态链路：自动行为测试直接读取此页面，通过真实网关和 Sim 执行函数验证无 initial 的动态结果、告警计数、计算、保存与重开；内嵌首屏不请求 DQE。
- 边界：字段缺失、维度类型、行/明细结构仍拒绝；number 与 money 的查询度量缺失即使 nullable=false 也继续显示。inline 仍严格。
- 协议：[结果字段契约](../docs/page-metadata/fields.md#查询数值度量的容错)。静态/行为和本地浏览器证据不代表真实 DQE、Relay、DS 模型或部署验收。

此页面同时用于查询错误与结果总数回归：`packages/embed/tests/browser/result-diagnostics.spec.ts` 直接读取页面，在 DQE HTTP 边界注入异常。字段缺失或维度类型错误时，表格、指标卡和折线图呈现空数据，错误只打印到控制台；总数小于或大于实际八行时，八行继续显示并打印 `TOTAL_COUNT_MISMATCH`，不修改上游总数。协议见[查询异常与结果总数](../docs/page-metadata/data-sources.md#查询异常与结果总数)。

## 商务SDT级联查询保留场景

[business-sdt-cascade-example.json](business-sdt-cascade-example.json)，试验场「验收样例」。它保存原有Top5项目→阶段明细的完整配置，替代人工业务报告作为自动级联与展示格式的回归输入。运行本地DQE Sim后，9/10月HTTP验收检查两条独立链使用各自商务编号，并验证导出与屏幕结果一致；不证明真实业务数据。

## 业务月份限制

[商务SDT终极版](sdt/commercial-sdt-efficiency-ultimate-monthly.json)保留为独立业务报告，默认2026-10并禁止未来月份，报告期间和全部查询继续跟随月份；主标题保持“商务SDT行权效率专项报告”。业务页需要真实 DQE，本地选择器验收不证明业务取数成功。通用月份／日期限制请使用上方 Report 时间选择入口。

## Report PDF 下载与 SDT 月报预览

[report-pdf-export.json](report-pdf-export.json)使用45行inline合成数据，覆盖配置文字/动态文件名、默认按钮及未启用对照。入口为`/pages/report-pdf-export`。

[SDT月报](sdt/commercial-sdt-efficiency-ultimate-monthly.json)可在`http://localhost:5173/pages/commercial-sdt-efficiency-ultimate-monthly`预览，目录中的经营分析分组提供入口；下载文件名包含已应用月份，业务数据仍依赖DQE。页面仓库现在递归读取pages子目录。

按钮使用白底描边，准备/生成状态在按钮内显示，成功后恢复配置名称，不提供取消按钮；失败可重试，悬停可看原因。自动回归通过内置下载入口检查Worker、实际文件和临时资源清理；真实DQE与部署另验。

## Dashboard 期间筛选

- 统一入口 `dashboard-period-filter` 使用日期精度，声明两个查询表格：sales 绑定顶部期间，fixed 不绑定。
- 月份精度、进入“更多筛选”、compact 只读三种变体仅保留于 `packages/page/fixtures/contract-valid/dashboard-period-filter-{month,more,readonly}.json`，不在演示目录重复展示。浏览器直接加载完整夹具，不临时拼装配置；安装包兼容性验收同步携带这些夹具。
- 人工配置入口：运行 `pnpm --filter platform exec vite --config tests/browser/report-date.vite.config.ts` 后，打开 `http://127.0.0.1:5187/tests/browser/report-date-editor.html?dashboard`；复用正式属性面板，使用本地合成数据。
- 数据环境：浏览器自动验收通过合成网关响应回显实际请求起止范围；人工使用时需要 DQE 网关提供匹配字段，页面本身不包含已验证真实业务数据。
- 操作：切年／季／月并选期间；季度使用 Q1—Q4；检查未来年／季／月不可选，当前自然期间仍使用完整查询范围；先选历史月份再选近一年；改变 URL value 编码；跨月重新选择近一年；缩窄容器。
- 预期：一次选择更新一个筛选状态，sales 范围改变而 fixed 不重新请求；近一年无输入框，按当前月之前 12 个完整月份显示范围。切回月保留历史月份。协议／日历／状态与请求断言见对应 period-filter 测试。
- 证据边界：浏览器测试为合成数据，真实 DQE／Relay／Java 及部署未由此证明。

## Report 内置 PDF 下载

[report-pdf-export.json](report-pdf-export.json)（页面 id：`report-pdf-export`，页面试验场 `/pages/report-pdf-export`）使用纯 inline 合成数据，无外部网关。顶部更改月份后点击“下载经营报告”，预期下载包含全部45行的多页PDF，文件名和正文期间使用点击时已应用的月份；日期与下载工具带不进入PDF。第二个页头不配置日期，`pdfExport: {}` 显示默认“下载 PDF”；最后一个页头未配置导出，不显示按钮。点击任意按钮均下载整页，文件名取触发按钮所在页头的配置或标题。

生成失败、实例更新/销毁、并发和宽内容由对应行为回归覆盖；高于一页的块按原布局连续切片。图片和PDF编码在Worker，DOM按时间预算分批处理；无取消入口，旧withExportView已移除。浏览器需要Worker/ImageBitmap/OffscreenCanvas及允许Blob Worker的CSP。合成数据验收不代表真实DQE、内网浏览器或部署已验证。
## Dashboard 图表独立筛选

- 页面：[chart-local-filter-page.json](chart-local-filter-page.json)，页面试验场「验收样例」，入口 `/pages/chart-local-filter-page`。启动 `pnpm dev:dqe`，数据由本地 DQE Sim 提供，为固定合成数据。
- 四张图左上角分别显示圆角单选按钮组，选中项黑底白字：订单默认中国区、收入默认海外、渠道默认亚太、地图默认中国区。每个选项的显示名称与查询值可在页面创作时配置，例如“中国区”对应 CN、“海外”对应 OVERSEAS。
- 将订单切到海外：只重新查询订单，图中从国内一组/二组变为海外一组/二组；其他三个筛选和全区域对照图保持原值。收入与地图也能独立切换。
- 渠道切到“欧洲（空结果）”：图表为空，但标题和筛选仍可操作；切回亚太恢复两组数据。查询失败同样保留筛选。
- URL 带独立筛选值，重开保留选择；未知值或多值 URL 回退各图默认项。静态导出保留捕获时的选项名称与数据，去掉按钮交互。宽/窄屏中控件均在图表左上角，不进入公共工具栏。
- 自动验收：`packages/embed/tests/browser/chart-local-filter.spec.ts` 直接加载本页面，通过真实浏览器与网关检查请求范围、候选值请求缺席、URL和空结果。静态导出投影由引擎内部测试覆盖。协议反例覆盖共享源、跨查询依赖、非法初值及版本下限。
- 协议：[图表独立筛选](../docs/page-metadata/filters.md#图表独立筛选629)。这些本地证据不代表真实 DQE/Relay、DS 模型或部署验收。

## Report 导出图片

- `report-png-export`：本地合成12行，包含日期、图表、表格、2倍PDF+3倍图片、4倍PDF+4倍图片及未启用对照。Playground `/pages/report-png-export`；页头直接显示“导出 PDF”和“导出图片”，点击按元数据倍率下载；无格式/清晰度弹窗或二次保存。文件名与标题使用点击时的月份。
- `report-png-long-export`：本地合成140行；`/pages/report-png-long-export`。4倍导出跨多个内部截图块，最终仍只有一张完整长PNG。不能按当前表格10行分页截取；无ZIP或其他格式。
- HTML单文件接入：`packages/embed/examples/report-image-download.html`消费同一作者页面，`?page=report-png-long-export`切换长图。水印由浏览器测试在父文档注入，业务页面不声明水印。合成场景不证明实际门户、真实DQE/Relay、生产部署或终端扩展隔离。

- `report-export-scale-fallback`：本地合成数据，PDF配置99、PNG配置2、旧PNG配置字符串“4”；页面正常打开，按钮直接下载，分别采用默认2/3/3倍。入口 `/pages/report-export-scale-fallback`。图表和输出像素尺寸由浏览器测试验证，不代表真实门户/DQE验收。

## Platform 搭建画布体验

- 页面：[platform-canvas-experience.json](platform-canvas-experience.json)，页面试验场「验收样例 → 画布交互验收（静态演示）」。全部为静态演示文字，无 DQE、Relay 或真实业务数据依赖。
- 操作入口：在 Platform 页面搭建工作台打开该页面；浏览器自动验收直接读取此文件，使用受控页面资产与保存端口运行 `node apps/platform/tests/workbench/canvas-experience-browser.mjs`。试验场仅展示页面，搭建操作须在 Platform 验收。
- 悬停或键盘聚焦组件后，右上角显示拖动手柄；选中后显示蓝色微渐变细框，组件旁的就地操作条提供上移、下移与删除。拖动手柄可同分区重排或跨分区移动；整行组件按上/下半区判断前后，同行组件按左/右半区判断。靠近滚动区边缘继续拖动可滚屏；结束或取消后清除落点。
- 组件配置提供常用宽度、逐轨调节及展示属性，不再重复摘要卡或移动/删除按钮；页面设置独立呈现日期筛选配置。操作条跟随选择、尺寸和滚动，目标完全滚出视野后隐藏。选中组件按 Delete 可删除，输入框中的 Delete 不触发删除。
- 删除或移动一个分区的最后组件时，该分区在搭建草稿中保留并可继续接收拖入，正式页面投影移除空分区。页面须至少保留一个组件；删除最后一个组件会显示原因且保留原文档。删除不回收共享页面数据源。
- 修改与删除可用顶部「撤销上一步」恢复；点击「保存草稿」才提交。本地浏览器测试证明交互、文档投影与受控保存回读，不能替代真实 Java 资产服务或部署验收。
