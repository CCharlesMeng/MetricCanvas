# Design Inventory

> 由 `scripts/extract_design_spec.py` 确定性生成；文档哈希一致时保持只读，哈希变化时由下一次抽取重写。
> 来源：`index.html` — 350601 字符 / 5788 行 / 平均 61 字符每行 / 已格式化（行号可用）
> 文档哈希：`adad63b3`（归一化 DOM+CSS，重新格式化文件不会改变它）

## Design Tokens


抽取模式：`literal-frequency` — 未命中 `_commonN` 约定，退化为字面量频次统计（值被 ≥2 个类引用才算 token）。

### 抽取覆盖

**本表不完整。** 下列样式来源在本抽取器的能力边界之外（边界是「内联 `<style>` 里的单类选择器」）。每条都必须登记进 `dev-baseline.md / 已知缺口` 并在 Phase A 确认门里说明，否则受影响的维度会以 `未见` 的形式从冻结基线里消失。

| 缺口 | 数量 | 影响 | 明细 |
| --- | --- | --- | --- |
| at 规则 | 24 | 整块跳过；@media 内的响应式取值与 @layer / @container 内的声明全部不可见 | `@container ×14`；`@media ×10` |
| 行内 style 属性 | 9 | 行内声明不参与类 → 声明映射，这些元素的尺寸与间距不可见 | `9 个元素带非空 style 属性` |
| 非单类选择器 | 1320 | 伪类、后代与组合选择器只登记不解析，R4 状态样式取不到期望值 | `.activity-progress.svelte-pdrxmn`；`.activity-progress.svelte-pdrxmn .change-label:where(.svelte-pdrxmn)`；`.activity-progress.svelte-pdrxmn .change:where(.svelte-pdrxmn)`；`.activity-progress.svelte-pdrxmn .changes:where(.svelte-pdrxmn)`；`.activity-progress.svelte-pdrxmn .metric-content:where(.svelte-pdrxmn)`；`.activity-progress.svelte-pdrxmn .metric-row:where(.svelte-pdrxmn)`；`.activity-progress.svelte-pdrxmn .metric-values:where(.svelte-pdrxmn)`；`.activity-progress.svelte-pdrxmn .progress-slot:where(.svelte-pdrxmn)`；`.activity-progress.svelte-pdrxmn .row-label:where(.svelte-pdrxmn)`；`.activity-progress.svelte-pdrxmn .row-value:where(.svelte-pdrxmn)`；`.activity-progress.svelte-pdrxmn .unit:where(.svelte-pdrxmn)`；`.activity-progress.svelte-pdrxmn .value-line:where(.svelte-pdrxmn)`；`.activity-progress.svelte-pdrxmn h3:where(.svelte-pdrxmn)`；`.ai-summary.report-inline.svelte-cx68n`；`.ai-summary.svelte-cx68n`；`.analysis-stack.svelte-wrtxs7 .pager`；`.analysis-stack.svelte-wrtxs7 .scroll`；`.analysis-stack.svelte-wrtxs7 .tab-list:where(.svelte-wrtxs7)`；`.analysis-stack.svelte-wrtxs7 .tab-panel:where(.svelte-wrtxs7)`；`.analysis-stack.svelte-wrtxs7 .table-heading`；`…另 1300 条` |

### 二分判据

- **共享类 → design tokens**：单属性且被 ≥2 个元素引用。本表就是它们，可直接对照仓内 token。
- **具名类 → 逐元素布局值**：属性以 margin/width/height/padding 为主，一次性尺寸与位置，**不进本表**，逐区块写在区块规格里。
- 命名与仓内样式/token `PATTERN-*` 的映射**不在本层做**（本产物 requirement 级复用，不绑定某个仓的快照）。

- 类规则合计 61 条 = **0 个 token 类** + **61 个布局类**；另有 1327 条非类选择器规则（`.semantic-html.svelte-1ohuc5t p`、`.semantic-html.svelte-1ohuc5t p + p`、`.semantic-html.inline.svelte-1ohuc5t`、`.semantic-html.inline.svelte-1ohuc5t .semantic-inline-paragraph + .semantic-inline-paragraph::before`）。

### Token 表（0 项）

### 去重字面量（全稿，含具名类）

统计口径是「声明中出现的次数」，用于交叉核对 token 表的完整性。

| 维度 | 去重数量 | 取值（值 ×出现次数） |
| --- | --- | --- |
| 颜色 | 284 | `#191919` ×174、`#fff` ×78、`#1476ff` ×63、`#ffffff` ×57、`#c2c2c2` ×56、`#595959` ×45、`#808080` ×35、`#f5f5f5` ×30、`#f0f0f0` ×23、`#f23030` ×23、`#71717a` ×21、`#dbdbdb` ×20、`#5cb300` ×17、`#08359e` ×15、`#18181b` ×14、`#e4e4e7` ×14、`#0f1a4d` ×13、`#deecff` ×13、`#ff8800` ×13、`rgba(0,0,0,.08)` ×13、`#f1f4ff` ×12、`rgb(0 0 0 / 0.15)` ×12、`#a1a1aa` ×11、`#121e3b` ×10、`#eef0f4` ×8、`#f4f4f5` ×8、`#ff9a2e` ×8、`rgb(0 0 0 / 0.05)` ×8、`rgba(0,0,0,.16)` ×8、`#f5222d` ×7、`#ffebd1` ×7、`#2563eb` ×6、`#303b4d` ×6、`#f0f7ff` ×6、`#52c41a` ×5、`#b91c1c` ×5、`#d4d5ff` ×5、`#dcdbdb` ×5、`#fff1f0` ×5、`#fff4e8` ×5、`#4191fa` ×4、`#52525b` ×4、`#667085` ×4、`#8490a0` ×4、`#8a94a5` ×4、`#d8deeb` ×4、`#e6e6e6` ×4、`#edf7df` ×4、`#fce3e1` ×4、`#3cc6c1` ×3、`#445593` ×3、`#4f46e5` ×3、`#505a84` ×3、`#536173` ×3、`#5b72ea` ×3、`#697386` ×3、`#737f91` ×3、`#7b8494` ×3、`#7dcc29` ×3、`#8c8c8c` ×3、`#daf2bb` ×3、`#e6f2d5` ×3、`#edf0f5` ×3、`#eef3ff` ×3、`#f21e1e` ×3、`#f3f5f8` ×3、`#f76360` ×3、`#fce2e0` ×3、`#fcfcff` ×3、`rgb(0 0 0 / 0.03)` ×3、`#001a4a` ×2、`#022e7a` ×2、`#0845a6` ×2、`#0f5ed4` ×2、`#2098ff` ×2、`#222b38` ×2、`#246fe3` ×2、`#3d6899` ×2、`#3f3f46` ×2、`#59677a` ×2、`#647084` ×2、`#777` ×2、`#7eb7fc` ×2、`#7fa6d4` ×2、`#8a91a5` ×2、`#a64d00` ×2、`#a6b1c1` ×2、`#b3d6ff` ×2、`#b42318` ×2、`#b6d4f2` ×2、`#d4d4d8` ×2、`#d96900` ×2、`#e4e8ef` ×2、`#e5e8ef` ×2、`#e7eaf2` ×2、`#e8ebf0` ×2、`#e8f1ff` ×2、`#f0f2f5` ×2、`#f7f7f7` ×2、`#f7faff` ×2、`#fafafa` ×2、`#fcd5a4` ×2、`rgb(0 0 0 / 0.1)` ×2、`rgb(20 118 255 / 0.08)` ×2、`rgb(20 118 255 / 0.28)` ×2、`rgb(20 77 184)` ×2、`rgb(33 111 240 / 0.05)` ×2、`rgb(46 36 180)` ×2、`rgb(46 50 149)` ×2、`rgb(60 198 193 / 0.1)` ×2、`rgb(73 119 255)` ×2、`rgba(0,0,0,.1)` ×2、`rgba(255,255,255,.7)` ×2、`#000` ×1、`#000000` ×1、`#00000012` ×1、`#0003` ×1、`#0006` ×1、`#029931` ×1、`#14223926` ×1、`#176bfa` ×1、`#1f1414` ×1、`#1f2a56` ×1、`#1f4700` ×1、`#202938` ×1、`#2276fa` ×1、`#242b36` ×1、`#2538580c` ×1、`#25385815` ×1、`#2638581c` ×1、`#27272a` ×1、`#2e6600` ×1、`#333` ×1、`#333333` ×1、`#337cf0` ×1、`#338eff` ×1、`#363b51` ×1、`#3c8001` ×1、`#3d8af3` ×1、`#424d60` ×1、`#42516a` ×1、`#4257c9` ×1、`#4338ca` ×1、`#4b9902` ×1、`#4ba0f7` ×1、`#4d0005` ×1、`#4d2201` ×1、`#5b6474` ×1、`#5f6e83` ×1、`#6177e4` ×1、`#628c38` ×1、`#6672a8` ×1、`#68778a` ×1、`#68788d` ×1、`#6891ca` ×1、`#68b9ff` ×1、`#697588` ×1、`#69778a` ×1、`#6b7789` ×1、`#6b778a` ×1、`#707d90` ×1、`#70bdff` ×1、`#7184e7` ×1、`#733400` ×1、`#75809c` ×1、`#778295` ×1、`#778496` ×1、`#78080e` ×1、`#7d9fff` ×1、`#7e899a` ×1、`#832fd6` ×1、`#8590a1` ×1、`#87909e` ×1、`#8a929d` ×1、`#8aa7ff` ×1、`#8b929d` ×1、`#8f3c00` ×1、`#91bdff` ×1、`#929ba8` ×1、`#93c5fd` ×1、`#999` ×1、`#9aa3b0` ×1、`#9aa4b3` ×1、`#9e6d3f` ×1、`#9edb58` ×1、`#a0a8b4` ×1、`#a2c777` ×1、`#a3171c` ×1、`#a4b0c2` ×1、`#a64242` ×1、`#aaa5e7` ×1、`#acb3bf` ×1、`#acb9f0` ×1、`#b9e683` ×1、`#bbc5d4` ×1、`#bed8fa` ×1、`#bf0a1c` ×1、`#bfbfbf` ×1、`#bfd6fc` ×1、`#c0c5cd` ×1、`#c4dcff` ×1、`#c64c4c` ×1、`#cb4646` ×1、`#cf4848` ×1、`#d2e6b8` ×1、`#d43838` ×1、`#d5e4fa` ×1、`#d5f2dc` ×1、`#d6a981` ×1、`#d8e6fa` ×1、`#d9d9d9` ×1、`#d9dff6` ×1、`#daeaff` ×1、`#dbeafe` ×1、`#e5e5e5` ×1、`#e5e9f0` ×1、`#e8cda4` ×1、`#e8e8e8` ×1、`#e8ebf3` ×1、`#e8edff` ×1、`#e9e9e9` ×1、`#e9edf3` ×1、`#eff5ff` ×1、`#f0f5ff` ×1、`#f2c5c2` ×1、`#f2d8c2` ×1、`#f2f4f7` ×1、`#f2f5f9` ×1、`#f4e0fc` ×1、`#f4f6ff` ×1、`#f4f7fb` ×1、`#f5f6f8` ×1、`#f7f9ff` ×1、`#f8eddb` ×1、`#f8f8f8` ×1、`#f8f9fc` ×1、`#f9fcff` ×1、`#fa8682` ×1、`#faa7a3` ×1、`#fcbc72` ×1、`#fce3e0` ×1、`#fe9902` ×1、`#fec72a` ×1、`#fecaca` ×1、`#fef2f2` ×1、`#ffb30f` ×1、`#ffb700` ×1、`rgb(0 0 0 / 0.06)` ×1、`rgb(0 0 0 / 0.08)` ×1、`rgb(0 0 0 / 0.12)` ×1、`rgb(0 0 0 / 0.16)` ×1、`rgb(102 196 255)` ×1、`rgb(15 23 42 / 0.16)` ×1、`rgb(15 23 42 / 18%)` ×1、`rgb(15 23 42 / 45%)` ×1、`rgb(189 213 255)` ×1、`rgb(20 118 255 / 0.05)` ×1、`rgb(212 213 255 / 0.75)` ×1、`rgb(218 214 255)` ×1、`rgb(242 30 30 / 0.1)` ×1、`rgb(242 48 48 / 0.08)` ×1、`rgb(25 25 25 / 0.1)` ×1、`rgb(255 174 0 / 0.1)` ×1、`rgb(255 255 255 / 0.08)` ×1、`rgb(255 255 255 / 0.32)` ×1、`rgb(255 255 255 / 0.62)` ×1、`rgb(255 255 255 / 0.68)` ×1、`rgb(255 255 255 / 0.72)` ×1、`rgb(255 255 255 / 0.78)` ×1、`rgb(29 105 218 / .055)` ×1、`rgb(29 111 255 / .045)` ×1、`rgb(35 93 178 / .055)` ×1、`rgb(39 188 253)` ×1、`rgb(49 46 129 / 0.2)` ×1、`rgb(53 65 130 / 0.06)` ×1、`rgb(68 85 147 / 0.06)` ×1、`rgb(69 89 180 / 0.2)` ×1、`rgb(8 53 158 / 0.28)` ×1、`rgb(86 174 255 / .012)` ×1、`rgb(91 114 234 / 0.12)` ×1、`rgb(91 143 255)` ×1、`rgba(0,0,0,.2)` ×1、`rgba(0,0,0,0)` ×1、`rgba(0,0,0,0.05)` ×1 |
| 字号 | 59 | `14px` ×54、`12px` ×52、`11px` ×24、`16px` ×17、`13px` ×16、`18px` ×13、`var(--mc-filter-font-size, 13px)` ×11、`20px` ×6、`10px` ×5、`24px` ×5、`var(--mc-card-title-font-size, 16px)` ×5、`var(--mc-card-title-font-size, 13px)` ×4、`0.875rem` ×3、`inherit` ×3、`var(--mc-card-title-font-size, 18px)` ×3、`var(--mc-semantic-font-size, 12px)` ×3、`var(--tv-Pager-font-size)` ×3、`26px` ×2、`28px` ×2、`9px` ×2、`var(--mc-card-title-font-size, 20px)` ×2、`var(--mc-font-size-report-level-4, 18px)` ×2、`var(--mc-insight-body-font-size, 18px)` ×2、`var(--mc-insight-heading-font-size, 20px)` ×2、`var(--mc-section-title-font-size, 32px)` ×2、`var(--tv-Grid-font-size)` ×2、`var(--tv-Input-font-size)` ×2、`var(--tv-Pager-icon-size)` ×2、`var(--tv-Textarea-font-size)` ×2、`0.9em` ×1、`1.02em` ×1、`1.08em` ×1、`1.15em` ×1、`1.625rem` ×1、`19px` ×1、`32px` ×1、`80%` ×1、`clamp(42px, 5cqi, 60px)` ×1、`var( --mc-section-card-title-font-size, var(--mc-font-size-report-level-3, 20px) )` ×1、`var(--mc-filter-font-size, 14px)` ×1、`var(--mc-metric-label-font-size, 16px)` ×1、`var(--mc-metric-unit-font-size, 16px)` ×1、`var(--mc-metric-value-font-size, 20px)` ×1、`var(--mc-section-title-font-size)` ×1、`var(--mc-tab-font-size, 13px)` ×1、`var(--mc-text-heading-font-size, 16px)` ×1、`var(--progress-ring-label-font-size, 16px)` ×1、`var(--progress-ring-percent-font-size, 11px)` ×1、`var(--progress-ring-value-font-size, 24px)` ×1、`var(--tv-Button-font-size)` ×1、`var(--tv-DialogBox-body-font-size)` ×1、`var(--tv-DialogBox-close-icon-size)` ×1、`var(--tv-DialogBox-head-title-font-size)` ×1、`var(--tv-Dropdown-font-size)` ×1、`var(--tv-DropdownItem-font-size)` ×1、`var(--tv-Option-font-size)` ×1、`var(--tv-SelectDropdown-font-size)` ×1、`var(--tv-Tabs-item-font-size)` ×1、`var(--tv-Tag-font-size)` ×1 |
| 行高 | 57 | `20px` ×23、`22px` ×23、`24px` ×9、`18px` ×8、`1` ×7、`1.5` ×7、`32px` ×7、`30px` ×5、`var(--mc-card-title-line-height, inherit)` ×5、`28px` ×4、`43px` ×4、`21px` ×3、`25px` ×3、`var(--mc-card-title-line-height, 24px)` ×3、`var(--mc-semantic-line-height, 18px)` ×3、`1.35` ×2、`1.6` ×2、`1.65` ×2、`1.8` ×2、`14px` ×2、`34px` ×2、`36px` ×2、`calc(var(--tv-Pager-height) - 2px)` ×2、`inherit` ×2、`var(--mc-card-title-line-height, 28px)` ×2、`var(--mc-card-title-line-height, 30px)` ×2、`var(--mc-insight-body-line-height, 30px)` ×2、`var(--mc-insight-heading-line-height, 25px)` ×2、`var(--mc-section-title-line-height, 50px)` ×2、`1.2` ×1、`1.7` ×1、`16px` ×1、`23.5px` ×1、`26px` ×1、`38px` ×1、`42px` ×1、`72px` ×1、`var(--mc-card-title-line-height, 25px)` ×1、`var(--mc-field-text-body-line-height, 24px)` ×1、`var(--mc-metric-label-line-height, 22px)` ×1、`var(--mc-metric-unit-line-height, 40px)` ×1、`var(--mc-metric-value-line-height, 40px)` ×1、`var(--mc-page-title-line-height, 1.15)` ×1、`var(--mc-section-card-title-line-height, 30px)` ×1、`var(--mc-section-title-line-height)` ×1、`var(--mc-text-heading-line-height, normal)` ×1、`var(--progress-ring-label-line-height, 20px)` ×1、`var(--progress-ring-value-line-height, 24px)` ×1、`var(--tv-Button-line-height)` ×1、`var(--tv-Dropdown-line-height)` ×1、`var(--tv-DropdownItem-line-height)` ×1、`var(--tv-Grid-line-height)` ×1、`var(--tv-Input-height)` ×1、`var(--tv-Option-line-height)` ×1、`var(--tv-SelectDropdown-line-height)` ×1、`var(--tv-Tabs-height)` ×1、`var(--tv-Tag-line-height)` ×1 |
| 字重 | 24 | `400` ×33、`500` ×30、`600` ×21、`700` ×11、`var(--mc-card-title-font-weight, 600)` ×7、`var(--mc-card-title-font-weight, 500)` ×6、`var(--mc-section-title-font-weight, 600)` ×3、`inherit` ×2、`var(--mc-tab-active-font-weight, 600)` ×2、`300` ×1、`650` ×1、`850` ×1、`bolder` ×1、`var(--mc-card-title-font-weight, 400)` ×1、`var(--mc-metric-unit-font-weight, 500)` ×1、`var(--mc-metric-value-font-weight, 500)` ×1、`var(--mc-page-title-font-weight, 500)` ×1、`var(--mc-page-title-font-weight, 700)` ×1、`var(--mc-section-card-title-font-weight, 400)` ×1、`var(--mc-text-heading-font-weight, 600)` ×1、`var(--tv-Button-font-weight)` ×1、`var(--tv-DialogBox-head-title-font-weight)` ×1、`var(--tv-Pager-page-item-font-weight-hover)` ×1、`var(--tv-Tabs-header-font-weight-active)` ×1 |
| 圆角 | 54 | `6px` ×24、`0` ×19、`4px` ×16、`8px` ×13、`999px` ×12、`16px` ×8、`5px` ×7、`7px` ×6、`12px` ×5、`3px` ×5、`var(--mc-filter-control-radius, 8px)` ×5、`var(--mc-radius-report-content, 12px)` ×4、`var(--mc-radius-cell)` ×3、`var(--mc-radius-section)` ×3、`0 999px 999px 0` ×2、`50%` ×2、`999px 0 0 999px` ×2、`9px` ×2、`inherit` ×2、`var(--mc-insight-body-radius, 8px)` ×2、`var(--mc-insight-radius, 16px)` ×2、`var(--mc-radius-section, 16px)` ×2、`0 0 16px 16px` ×1、`0 12px 12px 0` ×1、`0 5px 5px 0` ×1、`10px` ×1、`11px` ×1、`3px 1px 3px 1px` ×1、`5px 0 0 5px` ×1、`8px 3px 8px 3px` ×1、`9999px` ×1、`var(--mc-cell-radius, var(--mc-radius-cell))` ×1、`var(--mc-field-text-body-radius, 0)` ×1、`var(--mc-filter-bar-radius, var(--mc-radius-cell))` ×1、`var(--mc-filter-control-radius, 6px)` ×1、`var(--mc-gauge-radius, 0)` ×1、`var(--mc-key-value-panel-radius, var(--mc-radius-section, 16px))` ×1、`var(--mc-metric-panel-radius, var(--mc-radius-report-content, 12px))` ×1、`var(--mc-radius-control,4px)` ×1、`var(--mc-section-panel-radius, var(--mc-radius-section))` ×1、`var(--mc-section-panel-radius, var(--mc-radius-section, 16px))` ×1、`var(--table-widget-radius-top-left, 16px) var(--table-widget-radius-top-right, 16px) var(--table-widget-radius-bottom-right, 16px) var(--table-widget-radius-bottom-left, 16px)` ×1、`var(--tv-Button-border-radius)` ×1、`var(--tv-Button-border-radius-circle)` ×1、`var(--tv-Button-border-radius-only-icon)` ×1、`var(--tv-Button-border-radius-round)` ×1、`var(--tv-DialogBox-border-radius)` ×1、`var(--tv-DialogBox-border-radius,8px)` ×1、`var(--tv-DropdownMenu-border-radius)` ×1、`var(--tv-Input-border-radius)` ×1、`var(--tv-Pager-page-item-border-radius)` ×1、`var(--tv-SelectDropdown-border-radius)` ×1、`var(--tv-Tag-border-radius)` ×1、`var(--tv-Textarea-border-radius)` ×1 |
| 阴影 | 28 | `none` ×19、`0 0 0 3px color-mix(in srgb, var(--mc-color-accent) 18%, transparent)` ×4、`0 0 1px 1px #191919` ×2、`0 8px 24px rgb(0 0 0 / 0.1)` ×2、`0 12px 32px rgb(15 23 42 / 0.16)` ×1、`0 12px 32px rgb(15 23 42 / 18%)` ×1、`0 1px 2px rgb(0 0 0 / 0.08)` ×1、`0 1px 4px #25385815` ×1、`0 2px 12px rgb(0 0 0 / 0.16)` ×1、`0 2px 8px #00000012` ×1、`0 2px 8px #2538580c` ×1、`0 2px 8px rgb(35 93 178 / .055)` ×1、`0 2px 9px rgb(29 105 218 / .055)` ×1、`0 4px 16px rgba(0,0,0,.08)` ×1、`0 4px 4px 0 rgb(0 0 0 / 0.12)` ×1、`0 5px 24px #14223926` ×1、`0 6px 16px rgb(69 89 180 / 0.2)` ×1、`0 6px 22px #2638581c` ×1、`0 8px 20px rgb(49 46 129 / 0.2)` ×1、`0 8px 32px #0003` ×1、`inset 0 -2px var(--tv-Tabs-active-text-color,#191919)` ×1、`inset 0 0 0 1px #1476ff` ×1、`var(--mc-cell-shadow, 0 8px 22px rgb(53 65 130 / 0.06))` ×1、`var(--mc-section-default-shadow, 0 8px 24px rgb(68 85 147 / 0.06))` ×1、`var(--tv-DialogBox-shadow)` ×1、`var(--tv-DropdownMenu-box-shadow)` ×1、`var(--tv-SelectDropdown-box-shadow)` ×1、`var(--tv-shadow-3-down, 0 4px 16px 0 rgba(0, 0, 0, .08))` ×1 |
| 间距 | 212 | `0` ×148、`8px` ×33、`6px` ×26、`4px` ×22、`12px` ×13、`10px` ×11；另有 206 个低频值（逐元素噪声，完整值见区块规格） |
| 尺寸 | 93 | `100%` ×98、`32px` ×18、`28px` ×16、`16px` ×14、`20px` ×12、`auto` ×11；另有 87 个低频值（逐元素噪声，完整值见区块规格） |

### 资源引用（2 项，缺失 0 项）

| 资源 | 状态 | 引用类 | 引用元素数 |
| --- | --- | --- | --- |
| `data:,` | 存在 | `.<html-attribute>` | 1 |
| `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PGNsaXBQYXRoIGlkPSJhIj48cGF0aCBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAiIGQ9Ik0wIDBoODB2ODBIMHoiLz48L2NsaXBQYXRoPjwvZGVmcz48ZyBjbGlwLXBhdGg9InVybCgjYSkiPjxwYXRoIGQ9Ik03My42MSAzOS4zOXYzMC42N2MwIDIuMTctMS43NiAzLjkzLTMuOTQgMy45M0g1Mi41OXYtLjg3aDE3LjA4YzEuNyAwIDMuMDctMS4zNyAzLjA3LTMuMDZWMzkuMzloLjg3eiIgZmlsbD0iZ3JheSIvPjxwYXRoIGQ9Ik03My42MSAzOS4zOXYzMC42N2MwIDIuMTctMS43NiAzLjkzLTMuOTQgMy45M0g1Mi41OXYtLjg3aDE3LjA4YzEuNyAwIDMuMDctMS4zNyAzLjA3LTMuMDZWMzkuMzloLjg3eiIgZmlsbD0iZ3JheSIvPjxwYXRoIGQ9Ik01Ni45MiAyNXY0NS4wNmMwIDIuMTctMS43NyAzLjkzLTMuOTUgMy45M0gxMC45NEEzLjk0IDMuOTQgMCAwIDEgNyA3MC4wNlYzOS4zOWguODh2MzAuNjdhMy4wNiAzLjA2IDAgMCAwIDMuMDYgMy4wNmg0Mi4wM2MxLjcgMCAzLjA3LTEuMzcgMy4wNy0zLjA2VjI1Ljg3SDEwLjY3VjI1aDQ2LjI1eiIgZmlsbD0iZ3JheSIvPjxwYXRoIGQ9Ik05LjQzIDI1Yy0uNiAwLTEuMTUuMzEtMS40Ni44MkwuMTMgMzguNjRjLS4yNi40Mi0uMTMuOTYuMjcgMS4yMi4xNC4wOS4yOS4xNC40Ni4xNGg0NC44MmMxLjE3IDAgMi4yNi0uNjEgMi45LTEuNjJMNTcuMDQgMjVIOS40M3ptLjIyIDFoNDUuNTJsLTcuNTIgMTEuODFjLS40Ny43NC0xLjI4IDEuMTktMi4xNCAxLjE5SDEuMTdsNy43NS0xMi42Yy4xNi0uMjUuNDMtLjQuNzMtLjR6IiBmaWxsPSJncmF5Ii8+PHBhdGggZD0iTTcwLjc1IDI1Yy41NiAwIDEuMDguMyAxLjM5LjhsNy43MiAxMi43MmMuMjUuNDEuMTQuOTUtLjI1IDEuMjEtLjEzLjA5LS4yOC4xNC0uNDQuMTRINjYuMTRjLTEuMTcgMC0yLjI1LS42Ni0yLjg1LTEuNzNMNTUuOTggMjVoMTQuNzd6bS0uMDMgMUg1Ny44bDYuMzggMTEuNzFjLjQzLjggMS4yMiAxLjI5IDIuMDggMS4yOWgxMi42M0w3MS40IDI2LjM5YS44MDIuODAyIDAgMCAwLS42OC0uMzl6IiBmaWxsPSJncmF5Ii8+PHJlY3QgeD0iMTMuNSIgeT0iNTYiIHJ4PSIxLjg4NiIgd2lkdGg9IjE0IiBoZWlnaHQ9IjQiIGZpbGw9IiMxNDc2RkYiLz48cGF0aCBkPSJNMjMuNTYgNjNjLjI0IDAgLjQ0LjIyLjQ0LjUgMCAuMjctLjIuNS0uNDQuNWgtOS42M2MtLjI0IDAtLjQzLS4yMy0uNDMtLjUgMC0uMjguMTktLjUuNDMtLjVoOS42M3oiIGZpbGw9ImdyYXkiLz48cmVjdCB4PSIxMy41IiB5PSI2NiIgcng9Ii41IiB3aWR0aD0iNSIgaGVpZ2h0PSIxIiBmaWxsPSJncmF5Ii8+PHBhdGggZD0iTTQwIDZjLjI3IDAgLjUuMTkuNS40NHY2LjE2YzAgLjI1LS4yMy40NC0uNS40NC0uMjggMC0uNTEtLjE5LS41MS0uNDRWNi40NGMwLS4yNS4yMy0uNDQuNTEtLjQ0ek01Ni41NSA4LjY0Yy4yNC4xNC4zMy40Mi4yMS42M2wtMy4wOCA1LjM0Yy0uMTIuMjEtLjQyLjI3LS42Ni4xMy0uMjQtLjE0LS4zMy0uNDItLjIxLS42M2wzLjA4LTUuMzRjLjEyLS4yMS40Mi0uMjcuNjYtLjEzek0yMy40NCA4LjY0Yy4yNC0uMTQuNTQtLjA4LjY2LjEzbDMuMDggNS4zNGMuMTIuMjEuMDMuNDktLjIxLjYzcy0uNTQuMDgtLjY2LS4xM2wtMy4wOC01LjM0Yy0uMTItLjIxLS4wMy0uNDkuMjEtLjYzeiIgZmlsbD0iZ3JheSIvPjwvZz48L3N2Zz4=` | 存在 | `..mc-ui-theme.svelte-11etrp1 .mc-ui-select-dropdown` | 0 |

## Content Inventory


50 个文本节点去重后 **46 条**：静态标签 45 条、动态数据位 1 条。

### 占位符判据

命中任一条即判为**动态数据位**，否则为静态标签：

| 编号 | 判据 | 命中样例 |
| --- | --- | --- |
| P1 | 含连续 2 个及以上大写 `X` 掩码 | `XX客户名称`、`X,XXX个`、`XX%`、`XXXX` |
| P2 | 某个空白分隔片段整体是数值（可带千分位、小数、单位、尾部省略号） | `2,000`、`-888次`、`28%`、`智能光伏(业主) 38%` |
| P3 | 含日期形态 | `2026/03/26`、`2026年2月28日` |
| P4 | 整条只由省略号组成 | `…` |

### 静态标签（可作 R2 文案期望值）

| 文案 | 次数 | 所在区块 |
| --- | --- | --- |
| 6/12 | 2 | `.inspector-track` |
| ← | 2 | `.docbar`、`.prototype-switcher` |
| 画布交互验收（静态演示） | 2 | `.docbar`、`.canvas` |
| 经营概况 | 2 | `.canvas` |
| 3/12 | 1 | `.inspector-track` |
| 4/12 | 1 | `.inspector-track` |
| A · 紧凑标题栏 | 1 | `.prototype-switcher` |
| B · 组件导航 | 1 | `.prototype-switcher` |
| C · 当前：经营概况 · 顺序：first → second → third | 1 | `.prototype-switcher` |
| C · 画布就地操作 | 1 | `.prototype-switcher` |
| M | 1 | `.rail` |
| ‹ 全部组件 | 1 | `.inspector-track` |
| ↑ | 1 | `.chat` |
| ↑ 上移 | 1 | `.canvas` |
| → | 1 | `.prototype-switcher` |
| ↓ 下移 | 1 | `.canvas` |
| ↶ 撤销 | 1 | `.docbar` |
| ▢ | 1 | `.rail` |
| ▦ | 1 | `.rail` |
| 分析说明 | 1 | `.canvas` |
| 删除 | 1 | `.canvas` |
| 区域表现 | 1 | `.canvas` |
| 原型 | 1 | `.prototype-switcher` |
| 同分区排序与宽度 | 1 | `.canvas` |
| 宽度 | 1 | `.inspector-track` |
| 工作副本 | 1 | `.docbar` |
| 布局 | 1 | `.inspector-track` |
| 拖动到此组件的上半区或下半区。删除后可通过顶部撤销恢复。 | 1 | `.canvas` |
| 描述需要调整的内容… | 1 | `.chat` |
| 整行 | 1 | `.inspector-track` |
| 文本属性 | 1 | `.inspector-track` |
| 等待方案决策 · 所有操作只保留在当前原型中 | 1 | `.canvas` |
| 组件标题 | 1 | `.inspector-track` |
| 组件配置 | 1 | `.inspector-track` |
| 调整页面组件与布局 | 1 | `.chat` |
| 跨分区移动与删除 | 1 | `.canvas` |
| 选中后使用常用宽度、上移或下移。 | 1 | `.canvas` |
| 选择画布中的组件，在右侧配置展示效果。 | 1 | `.chat` |
| 选择组件，调整布局与展示效果 | 1 | `.inspector-track` |
| 配置区域原型 | 1 | `.docbar` |
| 静态演示。悬停右上角，使用手柄拖动调整顺序。 | 1 | `.canvas` |
| 页面内容 | 1 | `.canvas` |
| 页面搭建 | 1 | `.chat` |
| 页面设置 | 1 | `.inspector-track` |
| 页面配置 | 1 | `.inspector-track` |

### 动态数据位（**不得作为 R2 文案期望值**）

下游只能拿「格式模板」列做格式断言（位数、单位、千分位），不得把「样例值」写成期望文案。

| 样例值 | 次数 | 判据 | 格式模板 | 所在区块 |
| --- | --- | --- | --- | --- |
| 3 个组件 | 1 | P2 | `9 个组件` | `.inspector-track` |

## Interface Inventory


节点：136 个元素节点（另有 1 个空元素，不计入结构签名）；区块 6 个；重复结构模式 3 种，覆盖 40 节点 = 29%。

### 区块索引

锚点主体是 class 名：取该元素引用次数最少的**非 token** class；该 class 在全稿出现多次时加 `[i]`，i 是它在 DOM 序中的出现序号（第 i 个带这个 class 的元素），可用 `rg` 复算。根元素没有非 token class 时，以 `@ancestor(...)` / `@path(...)` 记录最近具名后代或祖先的结构路径，不退回语义标签。行号可用，附 `L起–L止`。

单区块切片按需取：`python3 scripts/extract_design_spec.py block <html> --anchor <锚点>`。

以下是**确定性候选段**（节点上限 80，`*` 表示超限的扁平容器，切碎无意义故整块给出）。把候选段归并成「一屏可截」的页面区块是 `extract-prototype` 的职责。

| 锚点 | 行号 | 节点数 | 文本节点 | 内容哈希 | 父链 | 文案摘要 |
| --- | --- | --- | --- | --- | --- | --- |
| `.rail` | L5787–L5787 | 4 | 3 | `0c1e0d3b` | `@ancestor(1,.prototype-app)` › `.prototype-app` | M / ▢ / ▦ |
| `.docbar` | L5787–L5787 | 7 | 5 | `4334ca5c` | `@ancestor(1,.prototype-app)` › `.prototype-app` | ← / 画布交互验收（静态演示） / 工作副本 / … |
| `.chat` | L5787–L5787 | 6 | 5 | `9e2433a3` | `@ancestor(1,.prototype-app)` › `.prototype-app` | 页面搭建 / 调整页面组件与布局 / 选择画布中的组件，在右侧配置展示效果。 / … |
| `.canvas` | L5787–L5787 | 73 | 15 | `61d51b9b` | `@ancestor(1,.prototype-app)` › `.prototype-app` | 页面内容 / 等待方案决策 · 所有操作只保留在当前原型中 / 经营概况 / … |
| `.inspector-track` | L5787–L5787 | 35 | 15 | `17c7c80c` | `@ancestor(1,.prototype-app)` › `.prototype-app` | 页面配置 / 3 个组件 / 选择组件，调整布局与展示效果 / … |
| `.prototype-switcher` | L5787–L5787 | 9 | 7 | `a5ef0d4d` | `@ancestor(1,.prototype-app)` | 原型 / ← / A · 紧凑标题栏 / … |

内容哈希是 requirement 级缓存的时效校验单位：只有哈希变了的区块需要重抽，其余直接复用。哈希输入是归一化的 `tag + class + 文案`，与空白格式无关。

### 重复结构模式

签名忽略文案，只看 `tag[class]` 骨架，逐层嵌套；只取**不互相嵌套的顶层模式**。编号 `IC-nn` 是抽取序号（按覆盖节点数降序），**不是组件名**——命名与变体归并由 `extract-prototype` 审定。

#### IC-01（2 实例 × 15 节点 = 30 节点）

| 项 | 值 |
| --- | --- |
| 根元素 | `article` `.cell.svelte-1cqpwej.authoring-cell.authoring-full-row` |
| 签名哈希 | `508b7b05` |
| 实例锚点 | `.cell[2]`、`.cell[3]` |
| 所在区块 | `.canvas` |

骨架（忽略文案，token 类折叠为计数）：

```
article.cell.svelte-1cqpwej.authoring-cell.authoring-full-row
  div.authoring-toolbar
    button.authoring-drag-handle
      svg
        circle ×6
  div.authoring-drop-slot.authoring-drop-slot-before
  div.authoring-drop-slot.authoring-drop-slot-after
  div.text-block.svelte-18k8pg7
    h3.heading.svelte-18k8pg7
    p.body.svelte-18k8pg7
```

逐实例文案样例：
- 实例 1：区域表现 / 选中后使用常用宽度、上移或下移。
- 实例 2：分析说明 / 拖动到此组件的上半区或下半区。删除后可通过顶部…

#### IC-02（2 实例 × 3 节点 = 6 节点）

| 项 | 值 |
| --- | --- |
| 根元素 | `button` `.tool-action.svelte-28nifc.icon-only` |
| 签名哈希 | `831f8497` |
| 实例锚点 | `.tool-action[1]`、`.tool-action[2]` |
| 所在区块 | `.inspector-track` |

骨架（忽略文案，token 类折叠为计数）：

```
button.tool-action.svelte-28nifc.icon-only
  svg.svelte-28nifc
    path.svelte-28nifc
```

逐实例文案样例：
- 实例 1：（无文案）
- 实例 2：（无文案）

#### IC-03（2 实例 × 2 节点 = 4 节点）

| 项 | 值 |
| --- | --- |
| 根元素 | `h2` `.section-title.svelte-1cqpwej` |
| 签名哈希 | `7fa4a894` |
| 实例锚点 | `.section-title[1]`、`.section-title[2]` |
| 所在区块 | `.canvas` |

骨架（忽略文案，token 类折叠为计数）：

```
h2.section-title.svelte-1cqpwej
  span.svelte-1cqpwej
```

逐实例文案样例：
- 实例 1：同分区排序与宽度
- 实例 2：跨分区移动与删除
