# Table 与 TinyVue OS Grid 样式差异盘点

日期：2026-10-20。状态：普通、forecastMatrix、embedded 的基础网格样式已落地，reportCompact 明确排除；完整控件状态的100%像素验收仍未闭合。实施与证据见 [执行记录](table-tiny-os/tasks.md) 和 [验收记录](table-tiny-os/acceptance.md)。下文差异数值保留为实施前快照，当前结果以验收记录为准。

## 已确认的修改范围（2026-10-20）

用户已明确：修改渲染引擎中涉及的内容。平台页面目录的 UI Grid 不属于本次实施范围，下文对 UI Grid 的观察仅用于解释当前两套实现的差异，不形成修改任务。

| 范围 | 实施落点 | 要完成的工作 |
|---|---|---|
| 页面内 Table 本体 | `packages/engine/widgets/src/components/table/Table.svelte` | 字体、表头与表体、短分隔线、行高、断行、空态、固定列及多级表头的呈现；既有数据、合并关系及业务显式值颜色保留 |
| 表格控件 | 同目录 `TableToolbar.svelte`、`TableControlIcon.svelte` | 搜索、排序和筛选图标、分页及控件状态，对齐对应的 TinyVue OS 样式 |
| 表头筛选弹层 | 同目录 `filter-popover.ts` 及弹层呈现 | 弹层尺寸、输入与选项、定位、滚动和关闭；筛选提交与候选项契约沿用现有实现 |
| 上层样式覆盖 | `packages/engine/runtime-ui/src/RuntimeSurface.svelte` | 收敛 Dashboard 表头高度、底色和分隔线覆盖，避免旧样式覆盖新的 Table 呈现 |
| 引擎消费场景 | Dashboard、Report、Tab、详情弹窗/抽屉及静态导出中的 Table | 使用同一引擎实现回归，不通过修改平台 Grid 或逐页补样式完成还原 |
| 验收支撑 | Playground 示例、相关浏览器检查、表格说明与本地创作知识 | 仅承接本次 Table 呈现调整所需的可观察场景与分发一致性 |

范围不涉及平台页面目录样式、查询执行语义、TableSession 状态所有权、排序/筛选业务规则、分页及导出结果范围。若后续确有连带改动，先记录具体原因和受影响契约。

2026-10-20 用户最终确认：`reportCompact` 不在本次外观修改范围；`forecastMatrix`、`embedded` 与普通 Table 一并同步 TinyVue OS。继续保留容器布局、列结构、合并、显式业务颜色与交互语义。

## 三个专用变体是什么，具体差在哪里

它们都是同一个 `Table.svelte` 的 `props.variant` 预设，不是三套查询或数据功能；只有页面文档显式声明才采用，Report 页面也可以使用普通 Table。

| 预设 | 用途与实际使用位置 | 当前 pages 目录中的使用情况 |
|---|---|---|
| `reportCompact` | 报告正文里的紧凑表格，例如 `flow-analysis-report` 的 TOP同比掉量客户、TOP掉量风险客户，`tokens-monthly-trend` 的月度汇总 | 5 个页面中的 14 张表；另包括 `flow-analysis-report-params`、`business-sdt-cascade-example`、`query-result-where-page` |
| `forecastMatrix` | 项目详情中的宽列销售预测矩阵，当前为 `ioc-project-detail` 的“销售预测”，顶层 14 列定义 | 1 个页面中的 1 张表 |
| `embedded` | 放在其他组件内部的无独立卡片表格，当前为 `ioc-project-overview` 中 Tab 内的 8 列明细表 | 1 个页面中的 1 张表；页面另显式声明 `bottomFade:true` |

### 网格皮肤与密度对照

以下是当前源码规则与已采样的 TinyVue OS 基本用法对照。表头高度由脚本与继承 CSS 变量共同决定；多级表头、换行内容会进一步撑高实际单元格。`forecastMatrix` 的网格、`reportCompact` 的紧凑密度等是现存设计，不表示已经通过本次还原标准。

| 项目 | reportCompact | forecastMatrix | embedded | TinyVue OS 基本用法 |
|---|---|---|---|---|
| 表头高度 | 缺省 33px，可被继承变量覆盖 | 自设 32px | CSS 指定 64px | 40px |
| 表头 padding | 上下 5、左右 8px；fit/wrap 时水平被改成 6px | 上下 0、左右 4px | 上下 0、左右 6px | 上下 4、左右 16px |
| 表头底色 | 继承基础淡蓝 `#f1f4ff`，也受主题变量影响 | 黑色 5% 透明背景 | 在现有 Dashboard 页继承黑色 5% 透明背景 | 实色 `#f5f5f5` |
| 表头字重 | 500 | 500 | 500 | 标题文字 600 |
| 表头竖分隔 | 全高 `#d8deeb` 线，末列清除 | 全高黑色 15% 透明线 | 沿用基础/Dashboard 全高线，末列清除 | 基础示例用 16px 短分隔线 |
| 表体基础高度 | 42px | 58px | 48px | cell-height 48px，内容可撑高 |
| 表体 padding | 上下 7、左右 8px | 上下 0、左右 4px | 上下 0、左右 6px | 上下 12、左右 16px |
| 单元格文字行高 | 表头 22px；表体继承 | 表头/表体 20px | 表头/表体 20px | 21px |
| 表体横线 | `#edf0f5`，末行清除 | 黑色 15% 透明线，另有末行清线规则 | 现有 Dashboard 中为黑色 15% 透明线，末行清除 | `#f0f0f0` |
| 表体竖线 | 无 | 有，另加 table 顶边与左边 | 无 | 基本用法无 |
| 表头分组文字 | 继承基础蓝色 `#08359e` | 覆盖为 `#595959` | 若有分组则沿用基础蓝色 | 普通标题 `#595959`；多级分组需按对应官方场景验收 |
| 排序图标 | 字符图标，沿用基础规则 | 字符图标，沿用基础规则 | 字符图标，平时隐藏；hover 显示未排序图标，focus 显示排序态 | 16px SVG；具体触发配置对应验收 |
| 搜索/分页/筛选 | 共用引擎基础控件 | 共用引擎基础控件 | 共用引擎基础控件 | 共享控件差异见 D13–D19，不因 variant 自动解决 |

### 容器与业务配置，需单独对待

| 项目 | 当前行为 | 与样式还原的关系 |
|---|---|---|
| reportCompact 的自然流 | 外壳无 padding、无独立卡片圆角；内容层可溢出，不建独立表体滚动层；内容层缺省浅底/12px 圆角 | 服务报告正文排版；浅底与圆角属于皮肤，是否保留自然流应独立于皮肤决定 |
| forecastMatrix 的容器 | 外卡高 770px、16px 圆角，滚动区 703px，table 自设 702px 高度，表头与表体默认居中 | 锁定高度会影响留白和滚动；TinyVue 本身支持宽高与对齐配置，不能把固定高度/居中本身判为样式错误 |
| embedded 的容器 | 无外壳 padding/圆角，表与滚动区均指定 448px 可视高度 | 用于现有 Tab 空间；采用 OS 网格皮肤不要求把可视高度改成官网 demo 的 420px |
| embedded 的文本 | 表头保留显式换行；普通单元格可换行，`fit:container` 路径另设 nowrap/ellipsis；链接文字黑色无下划线 | 换行、省略和链接呈现要映射到对应官方配置，不应全局误删 |
| 小计/合计与渐隐 | forecastMatrix 小计/合计为浅蓝底；overview 页面独立设置 bottomFade | 合计的业务分类和显式值颜色保留，装饰底色可对齐；bottomFade 是独立页面属性，不是 embedded 必带效果 |

本节来自当前源码和 `pages/**/*.json` 结构扫描，未将这些业务页面冒充同环境截图实测。

## 对比对象与证据边界

- 目标：[TinyVue OS Grid 基本用法](https://opentiny.design/tiny-vue/zh-CN/os-theme/components/grid)，以及其导航中的排序、筛选与分页。浏览器实际加载的文档静态资源路径为 `tiny-vue-web-doc/3.32.0`；本轮以这个页面快照为准，不推断所有 npm 发行版相同。
- 当前：`packages/engine/widgets/src/components/table/Table.svelte`、`TableToolbar.svelte`、`TableControlIcon.svelte`，以及 `packages/engine/runtime-ui/src/RuntimeSurface.svelte` 的 Dashboard 覆盖。
- 已实测当前页面：[多级表头、搜索和导出](http://localhost:5173/pages/table-toolbar-demo)（Report 页面中的基础 Table）和 [表格点击与详情弹窗](http://localhost:5173/pages/table-detail-overlay)（Dashboard）。两页使用本仓源码、内联合成数据。
- 目标基础表格、排序 SVG、分页静态样式：浏览器 DOM/computed style 已观察，基础表格另有页面截图观察；目标筛选面板、冻结阴影、空态等下表标明为官方 CSS 来源，未冒充交互实测。
- 官方 Grid CSS：[当前文档实际加载资源](https://res-static.opentiny.design/tiny-vue-web-doc/3.32.0/assets/index-0a28d810.css)。本轮已读取其中规则与 Token。
- 当前与目标会话的浏览器 viewport/DPR 不同：当前为 1600×900、DPR 约 0.8，目标为 1280×720、DPR 1。本轮比较 CSS 值和布局规则，不计算截图相似率，也不据此签署像素一致。
- 没有用户指定某张业务表，故以渲染引擎共享 Table 为主对象；平台页面目录的 `@metriccanvas/ui/Grid` 只保留对照观察，不在实施范围。

## 已识别差异

“当前值”除另注外为基础 Table。源码指定的 1px 线在当前浏览器缩放环境下 computed style 可显示为 1.25px，表中使用源码 CSS 值。

| ID | 项目 | 当前 | TinyVue OS 目标 | 影响与来源 |
|---|---|---|---|---|
| D01 | 字体族 | 表体继承 `-apple-system, system-ui, Segoe UI, PingFang SC…`；搜索和分页另设 Helvetica 字体族 | Grid 使用 `Helvetica, Arial, PingFangSC-Regular, Hiragino Sans GB, Microsoft YaHei…` | 字宽、换行、基线与行高会不同；两端浏览器实测 |
| D02 | 字号与行高 | 基础字号 14px，但表体行高继承 `normal` | 14px，cell line-height 1.5，即 21px | 字号相同不代表文本排版相同；两端浏览器实测 |
| D03 | 表头底色 | 基础 `#f1f4ff`；Dashboard 为 `rgba(0,0,0,.05)` | `#f5f5f5` | Dashboard 的透明色还取决于底层背景；两端浏览器实测 |
| D04 | 表头高度 | 基础 42px；Dashboard 64px；`reportCompact` 缺省 33px；`forecastMatrix` 32px | 基本用法为 40px；small/mini 有独立档位 | 默认值与 Dashboard 覆盖都要处理；基础与 Dashboard 已实测，其他变体为源码 |
| D05 | 表头字重 | 500；分组标题另染 `#08359e` | 普通标题文字 600、`#595959`；外层 th 本身可为 400 | 应对标题文字采样，不能只读取 th；两端浏览器实测 |
| D06 | 表头内边距 | 基础 `8px 10px`；fit+wrap 表头水平 6px | `4px 16px` | 文字离列边界的距离明显不同；两端实测 |
| D07 | 表头分隔线 | 全高 `border-right:1px solid #d8deeb`，底线同色 | 基本用法无整列右边框；可调整列宽处为居中的 1×16px `#dbdbdb` 短线；底线 `#f0f0f0` | 短分隔线是独立元素/伪元素，不能通过边框换色还原；目标 DOM/伪元素实测 |
| D08 | 表体行高 | 基础 40px；Dashboard 48px；`reportCompact` 自设 42px | 基本用法 cell-height Token 48px，同时内容允许撑高；本轮两行内容测得 67px | 48px 是基础高度约束，67px 是本示例内容结果，不应把二者当固定统一行高；medium 规则另为 Token +4px |
| D09 | 表体内边距 | `8px 10px`；嵌入形态 `0 6px` | `12px 16px` | 单行和多行的密度都不同；两端实测 |
| D10 | 表体分隔线 | 基础有贯穿所有列的竖线、`#edf0f5` 横线，末行横线清除；Dashboard 覆盖为 `rgba(0,0,0,.15)` | 基本用法仅横向 `1px #f0f0f0` 分隔 | 当前网格感更强；两端实测与源码 |
| D11 | 表格边框和外壳 | Table 自带白色 16px 圆角卡片，padding `19px 19px 11px`，scroll 另有 `#e8ebf3` 边框 | Grid 根 padding 0、radius 0、无外边框；官网示例外框属于文档容器 | 必须区分组件本体、MetricCanvas 卡片和官网 demo 外壳；两端实测 |
| D12 | 断行与列宽 | 普通单元格 `nowrap`；fit/wrap、嵌入及业务变体有各自规则；auto 与 fixed table-layout 并存 | 基础 cell `white-space:normal; word-break:break-word`；省略模式使用单独类 | 同数据、同宽度才能判断还原；目标 130px 业务列不是所有表的统一列宽 |
| D13 | 排序图标 | Unicode `⇅`、`↑`、`↓`；未排序 11px `#d4d4d8`，排序态 `#2563eb` | 16×16 SVG；默认 `#808080`，hover/active Token 为 `#191919` | 形状、占位、粗细和激活颜色均不同；目标排序页 DOM/SVG 实测，状态颜色来自 CSS/Token |
| D14 | 筛选图标 | 9px 字符 `▼`，active `#2563eb` | 专用 SVG，filter icon 由 16px Token 减 2px；active `#191919` | 源码与官方 CSS；目标弹层未完成浏览器交互采样 |
| D15 | 筛选弹层 | 自制 details/popover，min-width 160px、radius 8px、padding 6px、shadow `0 8px 24px /10%`，原生 checkbox/date input | 官方 filter-wrapper min-width 270px、shadow `0 2px 12px #0003`，有独立输入/枚举/简化日期面板 | 不是替换一条弹层 CSS 即可；须选与现有 select/dateRange/numberRange 对应的目标模式；官方 CSS 证据，交互待补 |
| D16 | 固定列滚动边界 | sticky 偏移已实现，固定单元格白底；未见对应边界阴影实现 | 左右固定边缘有 30px 阴影承载区，横向滚动状态下显示 inset shadow | 源码与官方 CSS；需实际滚动验证阴影和 hover/selected 背景传递 |
| D17 | 空数据 | 表内一行“暂无数据”，padding `24px 0` | 官方 empty-block 独立 flex 区域，min-height 60px，padding `60px 0` | 源码与官方 CSS；是否带图取决于官方示例/配置，不能一概断言 |
| D18 | 高亮与选择 | 当前没有常规整行 hover 背景规则；选择为蓝色单元格底色/描边；合计小计有自有业务颜色 | 官方 row/column highlight、current、selected 各有专门开关和 Token | 不能擅自把所有行默认加 hover；应按对应目标配置验收；源码/CSS |
| D19 | 工具栏与分页 | 搜索 240×32、radius 6、SVG；pager padding `24px 0 8px`，当前页 32px、radius 999px、字重 700 | 分页已抽样实测到同样的 padding 与当前页尺寸/圆角/字重；目标 sizes 容器另有 `margin-left:16px`，采用 popover | 已存在一致的静态参数，应保留；不能直接称全部一致，工具栏对应配置、下拉、禁用、焦点和跳页逐状态待验 |
| D20 | 业务单元格与变体 | 下钻链接、小计/合计、显式值颜色、详情交互、`reportCompact`、`forecastMatrix`、embedded、bottomFade 等 | 基础 Grid 示例不定义这些业务呈现 | 必须明确映射或保留规则，否则“全局统一”可能破坏现有报表与业务语义 |

## 根因与改动落点

1. **共享 Table 没有消费 UI Grid。** 渲染期表格直接由 `widgets/Table.svelte` 实现；平台页面目录另用 `packages/ui/src/components/grid/Grid.svelte`（调用点为 `apps/platform/src/lib/views/ManagementList.svelte`）。修改 UI Grid 不会更新页面内的 Table。
2. **Table 混用了两套视觉规则。** 表体保留蓝色网格体系；搜索、分页和部分 SVG 已靠近 OS。相同页面中字体和状态色并不统一。
3. **上层覆盖优先于缺省样式。** `RuntimeSurface.svelte` 给 Dashboard 设置 64px 表头与深色横竖线；不能只改 Table 的 42px fallback。
4. **UI Grid 也不能直接宣称 100%。** 它虽然已有灰表头与水平分隔线，但其局部 CSS 把 header `.mc-ui-grid-cell` 字重设为 400、缺少基础列头短分隔线；窄屏还支持 `stack` 结构。这一对象本轮只做源码核对，没有冒充平台页面实测。
5. **有些差异属于 DOM。** 短线、SVG 排序/筛选控件、独立空态和固定边界阴影都需要对应结构与状态，单独贴官方 CSS 无法闭合。

## 100% 还原需要冻结的标准

下列是待实施的验收建议，不是已经通过的结果，也不放宽“100%”为主观相似率。

- 固定本轮目标版本/资源快照、OS 浅色主题、浏览器、系统字体、缩放、viewport、DPR。官网 demo 容器不是 Grid 本体；比较区域必须明确。
- 两侧使用相同字段、文字、数据、列宽、可用宽高和功能配置；独立准备单行、多行、长文本与空值，否则无法用截图差异解释样式偏差。
- 几何和样式声明逐项相等：表头/行/单元格 box、padding、字体、line-height、颜色、边框、短线、图标路径/尺寸与弹层位置。出现差异即保留差异记录，不用汇总分数掩盖。
- 截图对比覆盖普通态、排序升降序、多列排序、筛选开关及选中、分页首中末页/禁用/下拉、搜索聚焦/有值/清空、空数据、固定列横滚、多级表头纵滚及窄屏。
- hover、current、selected、边框、stripe、size、overflow 各有配置前提；冻结具体参考配置，避免把官方不同示例拼成并不存在的默认样式。
- Dashboard、Report 中的基础 Table 和详情中的表格均进入回归。`reportCompact`、`forecastMatrix`、embedded 等业务变体先明确映射；不从基础示例反推其设计。
- 保留行列/数据/分页/排序/筛选/导出/详情的既有业务契约；新增或调整页面协议能力时按 `docs/agents/feature-acceptance.md` 同批完成 Playground、文档及 local-authoring 同步。
- 最终需要浏览器结构化对账、同环境截图和真实人员视觉验收。当前没有同环境像素证据，不能标记已达到 100%。

## 建议实施顺序

1. 建立一个使用相同数据与宽度的官方参照/当前 Table 对照场景，补齐目标弹层、分页、固定列、空态和多级表头取证。
2. 冻结引擎基础 Table、Dashboard 覆盖和各业务变体的 QA 基线；平台页面目录 Grid 已明确排除，不再重复确认。
3. 统一表格的样式 Token、字体和 box 模型，再处理 SVG/短线/弹层/空态/固定列结构；头部 sticky 偏移继续与实际表头高度同源。
4. 按状态矩阵逐项修复和回归；完成本仓要求的可观察场景、相关文档和分发闭合后，再给出还原验收结论。

本文件保留勘察时的当前值，实施结果与实际限制由执行目录记录；尚未提交和推送。
