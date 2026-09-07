# #109 URL 导航：裁决与工作区验收

日期：2026-09-07。起点：`8c87a4c`。本报告随 #109 实现提交，记录代码与验证结果；远端交付及关闭状态见 #109 的后续评论，不等同于 #100 发版或 #103 真实异构宿主集成验收。

## 用户确认的行为

导航保持普通超链接语义，支持当前行、当前页面参数、指定筛选值的动态绑定。缺值省略本次绑定，仍可跳转；发送端不检查外部目标是否缺少必填参数，也不改动详情页已有演示默认值。图表直接点击内容，不增加提示框中的链接入口。

`navigate` 与文本链接统一为 `href + query`。HTTP(S)/相对地址按承载文档基址解析；有值绑定覆盖已有同名查询键，保留其他键和 hash，仅合并外层查询串。多选重复键，范围和层级拆键；`0`、`false` 有效。接收页按自己的声明解释普通值，筛选器可用 `urlParams` 映射查询键。

规则与版本取舍见 [ADR-0068](../adr/0068-plain-url-navigation-protocol.md)。页面协议为 6.0；明确删除旧 pageId 导航与私有类型前缀，不在 5.4 上静默切换。旧不可变修订保留原文；由原引擎读取或显式迁移后另存新修订。离线工具 `tools/scripts/migrate-url-navigation.ts` 要求部署 URL 映射，拒绝覆盖源文件；目标查询键与业务含义仍需内容提供方核对。

## 实现范围

- 页面 Schema、源侧校验、页面参数消费分析、运行时 URL 构造与声明驱动的接收解析；移除目标页面目录交叉校验。
- 文本、表格链接与指标值使用真实 anchor；Canvas 图表直接点击默认导航。可选 `navigation.navigate` 返回 `true` 接管普通点击；观察事件不能替代接管回调。
- 正式渲染与创作入口继续共用 RuntimeSurface。编辑态捕获链接点击；退出编辑恢复导航，切换控件不重启查询或丢筛选/分页。
- 指标值行参数检查实际点击值的数据槽，覆盖 `compare` 值；字段必须存在于所有可点击行来源中。
- Canvas 参考宿主处理实际 URL 变化（含同页不同参数），筛选 URL 同步不原样回灌初始化。Embed 接收可选导航能力，省略时默认浏览器跳转。
- IOC 概览→清单→详情、文本链接及仓内页面/校验样例迁移；概览代表处链接显式携带 `region.level=office`。
- TS / Java / Python 校验器、中立契约、创作 Bundle 快照同步；Unicode 地址、非法 scheme/authority/port、点击来源、参数名冲突均纳入契约样例。

## 验证记录

| 检查 | 结果 |
|---|---|
| `pnpm check` | 全仓通过；Svelte 0 errors / 0 warnings |
| `pnpm build` | Embed、Canvas、platform 构建通过 |
| `node --import tsx packages/page/src/validate-cli.ts` | 11 个真实页面全部通过 |
| `node --import tsx tools/scripts/export-authoring-contracts.ts --check` | 183 product / 4 authoring / 1 interface 文件一致 |
| `python3 metriccanvas-authoring/scripts/check_bundle.py` | 456 项摘要检查通过 |
| Python 3.12 Bundle 环境 `unittest discover` | 152 项通过 |
| JDK 17 `mvn -B verify` | BUILD SUCCESS；261 项，0 失败/错误，15 项跳过；其中页面一致性 177 项 |
| Embed Playwright | 35 项通过（原有 30 项 + 5 项导航） |
| MetricCanvas Playwright | 6 项通过（包含新增原生链接编辑态拦截） |
| 全仓 Vitest | 172 文件通过；1362 项通过、49 项跳过；3 项既有 Ask 白名单失败 |
| `git diff --check` | 通过 |

导航浏览器用例覆盖：无导航适配器的 HTML 宿主加载真实 IOC 页面并完成概览→清单→详情、浏览器后退/前进；相对/绝对链接、参数编码、重复键、缺值、链接地址读取与新标签打开；图表直接点击；可选宿主接管与同文档参数重新初始化；指标卡对比数据槽的行参数。

沙箱内 HTTP 测试无法绑定本机端口，Java Mockito 不能执行 attach；对应命令在允许本机测试能力的环境重跑后通过。未以沙箱失败替代测试结果。

全仓剩余 3 项失败均来自 `apps/platform/tests/ask/dependency-boundary.test.ts`：文件白名单未登记 `business-terms.ts`、该文件缺少白名单、`lexical-model.ts` 新依赖未登记。与 #56 交付报告记录一致，本次未修改这些问数模块，不将全仓标作全绿。

## 公开面与交付边界

`RuntimeNavigationTarget` / `navigate` 事件删除目标 `pageId/search`，改为 `href` 与来源字段；`RuntimeNavigation.href()` 删除，`navigate` 可选且返回 `boolean | void`，`true` 表示接管。Embed 新增可选 `RuntimeInput.navigation`，导出其导航类型。

runtime 导出 `navigationHref`、`parseFilterSearch`、`filterSearch`，删除 `drillThroughSearch` / `PAGE_PARAM_PREFIX`；`FilterState.fromURL` 需要接收声明。page 导出新导航类型、源侧校验和接收键工具，删除旧跨页目标交叉校验 API。

composition 的 `TableRenderBinding` / `NestedComponentRender` 及组件转发增加 href 回调，链接回调收到 MouseEvent。#100 应按这些实际形状冻结 API，并把页面协议 6.0 与包版本区分；本轮未改变包名、包版本或发布形态。

用户已授权提交与 push；推送确认后关闭 #109，其导航实现前置即完成。#103 仍须与 #100 发布结果一起完成真实宿主验收，仓内 HTML 示例不替代该验收。

已同步 [#109 实现/验证记录](https://github.com/CCharlesMeng/MetricCanvas/issues/109#issuecomment-5568788769)、[#100 公开 API 对账](https://github.com/CCharlesMeng/MetricCanvas/issues/100#issuecomment-5568787785)，并更新 #95 的 #109 执行索引。上述初次同步时尚未提交，最新交付状态以票内后续提交记录为准。
