# UI · 执行与 QA 基线

| 字段 | 内容 |
| --- | --- |
| 基线源 | reference_page |
| 来源指纹 | be385350e63d4c1007a8216d8df04af443d5c9bfd517ddefefea8e353a482e5b |
| 冻结状态与时间 | 已冻结 ✅，2026-10-12；按用户明确的连续实施授权冻结，无新增产品决策 |
| 声明状态 | 冻结时全部 UNVERIFIED；逐条执行状态见 alpha-tests.md |

完整 QA 契约晚于首批实现补齐。本次按最终工作区重新采集；不追记不存在的实现前 RED，也不将来源 CSS 摘要当作浏览器验收。

官方来源：TinyVue OS Theme 3.32.0；组件 URL、完整样式资产及 SHA-256 见 `docs/evidence/platform-ui-os-theme-2026-10-12/sources.json`。日期保留 `docs/archive/report-date-ui-2026-10/report-date-picker-tiny-os/` 冻结来源；新增控件不继承旧验收结论。

## 采用的工程与需求规范

采用 `packages/ui/frontend-baselines/` 中的 PATTERN-STRUCT-1、PATTERN-RUN-1、PATTERN-COMP-1、PATTERN-STYLE-1、PATTERN-DATA-1、PATTERN-TEST-1；需求采用 `docs/plan/platform-ui-management/requirement-frontend-design.md` 的 REQ-DEC-1、REQ-DEC-2、REQ-DEC-3。规范正文仍由相应基线与需求文档持有。

## QA 基线

### R3 — 官方控件尺寸与间距

| 编号 | 判定对象 | 具体期望 | 取证方式 |
| --- | --- | --- | --- |
| R3-1 | Button | 1440×900 默认高度 32px、font-size 14px、radius 6px | 冻结契约 · render/numeric · 官方 Button 3.32.0 CSS 与浏览器抽样 |
| R3-2 | Input | 默认高度 32px、font-size 14px、radius 6px、左右 padding 12px、边框色 #c2c2c2 | 冻结契约 · render/numeric · 官方 Input 默认示例 |
| R3-3 | Grid 表头 | 单元格 padding 4px 16px；背景 #f5f5f5；标题内层 font-size 14px、line-height 21px、weight 400、色 #595959 | 冻结契约 · render/numeric · 官方 Grid 基础表格；TH 的 600 与内层 400 区分 |
| R3-4 | Select 面板 | radius 6px、padding 8px 0px、shadow 0 4px 16px rgba(0,0,0,.08)；选项高度 32px、padding 0 16px、line-height 21px | 冻结契约 · render/numeric · 官方 Select 基本用法，2026-10-12 浏览器实测 |

### R6 — 产品使用边界

| 编号 | 视口宽度 | 判定对象 | 具体期望 | 取证方式 |
| --- | --- | --- | --- | --- |
| R6-1 | 390 | 公共控件展示入口 | 文档横向溢出 ≤1px；Dialog 原根挂载 | 冻结契约 · render/overflow · 管理交互文档窄屏和浮层约束 |

### F3 — 功能边界

| 编号 | 对象 | 触发 | 期望 |
| --- | --- | --- | --- |
| F3-1 | 输入 | 填入文字，不先失焦，点击保存 | 调用者取得最后一次输入；禁用时不得写入 |
| F3-2 | 浮层 | 键盘方向键、禁用项、Escape | 不选择禁用项；关闭后回原触发器；保留 ShadowRoot |
| F3-3 | Grid/Pagination | 请求排序、翻页 | 只发事件，不在控件内排序或切片 rows |
| F3-4 | DatePicker | 日/月单值及范围 | 合法历法和完整提交保持原行为；page 协议验证仍由引擎适配器负责 |

### 豁免

无视觉豁免。Edge 动画帧与截图故障是验证环境缺口，不能改写为 GREEN。

### 已知缺口

官方 Button/Input/Grid/Select 数值可机器比较；Tabs/Tag/Pagination/Dialog/Empty 的全量状态像素对照尚未收口。冻结样式来源与行为用例不替代全量 1:1 视觉证据。真实门户字体/reset 及 Java 生命周期验证另列。


## 执行起点


base-ref：1e941d5f（main）；起点目录已由完整 stash 清理。W1 源码验收树：92baa1dfe8a956a4cc7e1005642b7648c77bfef7；源副本 test/check/build 起点失败集合为空。UI 尚无 Svelte 控件，单独 check 报“未发现 Svelte 文件”警告，不作为组件验收。

已选浏览器：仓内 Playwright；Chrome 可启动，Edge 可执行尚缺；当前与最低 Svelte tarball 类型/构建已通过，浏览器矩阵因环境未执行完成。真实服务/身份/门户不在 mock 控件证据中。
