# 图片资源清单

生产代码使用的图片统一存放在本目录。批量替换时保持文件名和格式不变，构建系统会自动更新产物中的哈希文件名。

| 文件 | 原始尺寸 | 界面位置 | 主要消费方 |
| --- | --- | --- | --- |
| `ai-summary-icon.svg` | 256 × 256 | AI 总结内联文本前缀图标 | `TextBlock.svelte` |
| `header-flow-background.svg` | 1774 × 887 | 流水分析报告页头背景 | `ReportHeader.svelte` |
| `report-badge-background.svg` | 208 × 50 | 流水分析报告代表处标签背景 | `ReportHeader.svelte` |
| `ranking-decline.svg` | 25 × 25 | 排名详情卡下降趋势图标 | `RankingDetailCard.svelte` |
| `ranking-growth.svg` | 25 × 25 | 排名详情卡上升趋势图标 | `RankingDetailCard.svelte` |
| `report-assistant-icon.svg` | 28 × 28 | 报告页头“AI 助手生成”图标 | `ReportHeader.svelte` |
| `risk-warning.svg` | 20 × 20 | 风险提示文本图标 | `TextBlock.svelte` |
| `section-title-left.svg` | 20 × 20 | 内容分区标题左侧装饰 | `RuntimeSection.svelte`、`ReportHeader.svelte`、`TextBlock.svelte` |
| `section-title-right.svg` | 20 × 20 | 内容分区标题右侧装饰 | `RuntimeSection.svelte`、`ReportHeader.svelte`、`TextBlock.svelte` |

### IOC 作战地图图标（依设计稿手绘，尚未接入）

设计稿 `参考/项目地图/设计稿/project-overview.html` 引用的 `assets/` 目录不存在，以下图标按该 HTML 的节点名、标注尺寸与相邻文案重绘。它们只是资源，接入由后续改动完成。

| 文件 | 原始尺寸 | 界面位置 | 设计稿节点 |
| --- | --- | --- | --- |
| `map-region-pin.svg` | 15.51 × 20 | 地图区域标签（欧洲/亚太/…）左侧定位针 | `形状结合` 207:7815 及 7 个 7.91×20 同形节点 |
| `calendar.svg` | 16 × 16 | 筛选栏日期控件图标 | `ic_public_calendar` 207:8341 |
| `card-title-opportunity.svg` | 20 × 20 | 「机会点概况」卡标题图标 | `ic_public_finger` 207:9565 |
| `card-title-tiered-management.svg` | 20 × 20 | 「项目分层分级管理」卡标题图标 | `ic_public_management` 207:9659 |
| `card-title-review.svg` | 20 × 20 | 「复盘总结」卡标题图标 | `ic_ict_further_operation_maintenance` 207:9736 |
| `card-title-reward.svg` | 20 × 20 | 「及时奖惩」卡标题图标 | `ic_ict_trophy` 449:7609 |
| `table-maximize.svg` | 20 × 20 | 概览表「放大」入口（Tab 卡右上角） | `graph` 207:8179 |
| `medal.svg` | 12 × 12 | 「及时奖惩」金牌/银牌标记 | 449:7628、449:7632 |
| `penalty-card.svg` | 12 × 12 | 「及时奖惩」红牌/黄牌标记 | 449:7639、449:7656 |
| `sort-indicator.svg` | 10 × 10.99 | 概览表可排序列头的双向排序指示器 | 207:10047/10060/10063/10066/10069 |

#### 奖惩四色是占位值

`medal.svg` 与 `penalty-card.svg` 各覆盖两个节点：金与银、红与黄形状相同、只差颜色。这四个色值在设计稿里读不到——它们原本封在缺失的位图资源内部，类名里没有任何相关声明。所以文件里给的是**占位色，不是设计定稿**：

| 牌 | 占位色 | 怎么来的 | 在文件里怎么取到 |
| --- | --- | --- | --- |
| 金牌 | `#D6AF36` | 通行的奖牌金属色阶 | `medal.svg` 的默认值 |
| 银牌 | `#A7A7AD` | 同上，与金牌成对 | 设 `--medal-color` |
| 红牌 | `#D92D20` | 足球罚牌通行红 | `penalty-card.svg` 的默认值 |
| 黄牌 | `#F5C518` | 足球罚牌通行黄 | 设 `--penalty-card-color` |

真值寻源条目见 `docs/plan/ioc-legacy-handoff.md` D.6。拿到后只改这两个文件的 `color` 属性与本表。

写法是根节点 `color="<占位色>"` 加上形状 `fill="var(--<名>-color, currentColor)"`，三种消费方式下的行为：

| 消费方式 | 表现 |
| --- | --- |
| `?inline` 当 `<img>`（本仓现状） | 外部 CSS 进不来，显示占位色 |
| 内联进 DOM，祖先或自身设 `--medal-color` / `--penalty-card-color` | **被覆盖**（自定义属性会继承，`var()` 的兜底只在未设时生效） |
| 内联进 DOM，CSS 规则命中 `<svg>` 元素本身设 `color` | **被覆盖**（`currentColor` 仍然活着） |

注意祖先上的 `color` 覆盖不了：根节点的 `color=` 是表现属性，优先级虽为 0，但仍高于继承值。要用 `color` 覆盖就得让选择器命中 `<svg>` 自己（`.foo svg { color: … }`），否则用自定义属性。

### 不画的：门户外壳图标

设计稿 `project-overview.html` 左侧导航（`编组 14` 487:17233）与顶栏（`编组 12` 207:8441）另有 13 个图标引用：6 个 16×16 导航项图标（`ic_public_management` 487:17255、`ic_huawei_cloud_other_managementcenter` 487:17269、`ic_ict_campus_view` 487:17292、`ic_car_user` 487:17302、`ic_ict_office_network` 487:17328、`ic_ict_tenant_management` 487:17343）、5 个 16×16 展开箭头（487:17264/17287/17320/17337/17352）、以及 487:17242 与 207:8456。

**这些不画，也不要补画。** 按 `docs/host-contract.md`，路由、面包屑与导航属应用外壳（门户或 `packages/embed` 嵌入方），不是页面内容，本仓 widget 层没有任何消费方。画进本目录只会留下一批无人引用的死文件，且本清单的「主要消费方」列填不出来。哪天真要在本仓还原门户外壳，先定它归哪个包，再在那里建资源目录。

## 图标绘制规则

新增单色图标一律按以下规则手写，改动既有图标时同样遵守。

1. **画布**：`viewBox` 与设计稿标注尺寸 1:1，并同时写出 `width` / `height`。非整数标注（`15.51×20`、`10×10.99`）照抄，不取整。
2. **描边优先**：≥16px 的图标主体用描边（根节点 `fill="none"`）；只有 ≤12px 的标记与三角形指示器用填充——该尺寸下描边会糊成一团。
3. **线宽**：描边一律 `stroke-width="1.5"`，16px 与 20px 画布同值，保证并排时视觉重量一致。
4. **端点与拐角**：一律 `stroke-linecap="round"` `stroke-linejoin="round"`。
5. **圆角**：外框矩形圆角取画布边长的 1/8（20→2.5，16→2，12→1.5）；内部条形取其短边的 1/3。
6. **颜色**：单色图标只用 `currentColor`，不写死十六进制；次要结构用 `opacity` 表达，不引入第二个颜色值。**注意 `currentColor` 只在 SVG 被内联进 DOM 时才受外部 CSS 控制**——本目录现在的用法是 `?inline` 导入后当 `<img src>`，那种模式下 SVG 是独立文档，`currentColor` 解析到它自己的 `color`（未声明时为黑）。图标确实需要一个非黑的默认色时，在根节点写 `color="…"`，并按上文奖惩四色那套写法保留可覆盖性。
7. **留白**：主体保留 ≥0.75px（半个线宽）安全边距，并在画布内视觉居中。
8. **禁用**：不用 `<image>`、外链字体、`<script>`、内嵌 base64 位图、滤镜。
9. **注释**：文件首行写 `<!-- 用途 · 设计稿节点名与 ID -->`。

## 替换约束

- 保持上述文件名与扩展名不变，可直接批量覆盖。
- SVG 应保留 `viewBox`；PNG/JPG 建议保持原始宽高比，避免拉伸或裁切变化。
- 不要直接修改 `apps/*/build` 或 `.svelte-kit` 下的图片，它们会在构建时重新生成。

内容分区面板及报告摘要的背景已改为 `RuntimeView.svelte` 中的 CSS 渐变，不再依赖图片资源。
