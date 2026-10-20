# 引擎 Table TinyVue OS 执行基线

| 字段 | 值 |
|---|---|
| 基线源 | reference_page；用户提供的 TinyVue OS Grid，文档所加载 3.32.0 CSS |
| 冻结状态 | 已冻结 ✅；2026-10-20 用户确认 reportCompact 排除，另外两种纳入；布局与业务语义保留 |
| 来源指纹 | 官方 Grid CSS SHA256 `0a28d81088961dfc5972eaf3e29af1e637ca0e777e1e677045b2d008f87ac21b`；源码快照和 SVG 来源见 `packages/embed/tests/fixtures/tiny-os-grid-reference.json` |
| 执行档位 | standard；还原 Task 1，初始 9 个计划文件；最终连带真源/分发/测试工件共 20 个路径，shared-boundary、visual、spec-gap 取证触发器 |
| app baseline | apps/playground/frontend-baselines；structure、styles、components、tests |
| 声明状态 | 确认不等于通过，逐项状态在 alpha-tests.md |

## 执行起点（环境）

- base-ref：`952b3a273f0f4f8be5820f5af1bb76c2f5afa513`，产品 Table/图标文件起点干净；工作区有并行页面、文档及创作知识改动，保留。
- 浏览器：仓内 Playwright + Chrome，同一 context 内冻结官方 CSS 参照与引擎网格；1280×720、DPR 1（默认）；另验 390px 窄屏。
- 数据：本次 `table-tiny-os` 内联合成场景，状态/导出另复用已有 table-toolbar 浏览器契约；不声称真实 DQE/Relay 验收。
- 起点：上一轮盘点已观察到旧蓝表头、42/64px 表头、字符图标、完整竖线；未在修改前完整跑质量命令，不能把本轮通过冒充起点通过。

## 工程依据

采用 PATTERN-COMP-2、PATTERN-STYLE-1、PATTERN-STYLE-2、PATTERN-STYLE-5、PATTERN-TEST-1、PATTERN-TEST-2、PATTERN-TEST-4。规格和代码侧只读勘察已完成。

## QA 基线

### R3 — 网格基本样式

| 编号 | 判定对象 | 具体期望 | 取证方式 |
|---|---|---|---|
| R3-1 | 纳入的三种网格 | 字体 Helvetica/Arial 等官方字体族；14px，21px 行高，正文 #191919 | 冻结官方 CSS/基本用法 DOM · computed style 与同环境像素比较 |
| R3-2 | 表头 | 单层单行 40px，padding 4px 16px，#f5f5f5 底，标题 600/#595959 | 冻结官方 Grid 基本用法 · render/exact |
| R3-3 | 分隔 | 列头 1×16px #dbdbdb 短线；表体无整列竖线，横线 1px #f0f0f0 | 冻结官方 Grid CSS · render/exact |
| R3-4 | 表体 | 基础 48px、padding 12px 16px，内容可撑高；显式省略配置保留 | 冻结官方 Grid CSS · render/exact |
| R3-5 | 排序 | 16px 官方 SVG path；默认 #808080，激活 #191919 | 官方排序页 DOM 及 @opentiny/vue-icon 3.32.0 · SVG 路径与状态采样 |

### R4 — 状态与滚动

| 编号 | 判定对象 | 状态 | 具体期望 | 取证方式 |
|---|---|---|---|---|
| R4-1 | 筛选 | 打开/激活 | 14px 官方 SVG、默认 #999，激活 #191919；弹层 min-width 270px、shadow 0 2px 12px #0003 | 官方 Grid CSS、图标包 · 样式/行为测试；内部原生日期控件不冒充官方完整日历验收 |
| R4-2 | 固定列 | 横向滚动 | 按实际列宽定位；30px 边界区、左右 inset 阴影，到对应边界消失 | 官方 Grid CSS · 浏览器滚动与几何断言 |

### R5 — 边界内容

| 编号 | 判定对象 | 边界条件 | 具体期望 | 取证方式 |
|---|---|---|---|---|
| R5-1 | 空态 | 零行 | 独立 flex 居中、min-height 60px、padding 60px 0 | 官方 empty-block CSS · 浏览器样式 |

### R6 — 布局完整性

| 编号 | 视口宽度 | 判定对象 | 具体期望 | 取证方式 |
|---|---|---|---|---|
| R6-1 | 390px 与默认宽度 | 固定列/多级表头 | 页面不横向溢出；表内滚动；多级 top 累计实际行高，固定列偏移累计实际列宽 | 用户已确认范围与现有布局契约 · 浏览器几何 |

### F3 — 回归边界

| 编号 | 类别 | 判定对象 | 触发方式 | 期望表现 |
|---|---|---|---|---|
| F3-1 | 排除项 | reportCompact | 同页操作 | 旧字体、间距、表头、行高、字符图标保留 |
| F3-2 | 数据状态 | 三种纳入表格 | 排序/筛选/搜索/清空/分页/导出 | 既有结果和作用域不变，互不污染 |
| F3-3 | 导出 | 静态导出 | 创建导出视图 | 关闭几何订阅和阴影，不锁定屏幕尺寸 |

### 豁免表

无豁免；业务布局/颜色保留是已确认范围，reportCompact 是明确排除项。

### 已知缺口

完整官方筛选日历/枚举面板各模式、所有 hover/focus/disabled 像素、真实业务页面整页视觉尚未全部同环境取证；基础网格局部像素相等不代表这些状态全部相等。

### 变更记录

2026-10-20：用户收敛为普通 + forecastMatrix + embedded，reportCompact 排除；不再重复请求该范围确认。
