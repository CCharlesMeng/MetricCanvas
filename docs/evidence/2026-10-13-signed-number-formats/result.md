# 商务SDT变化量符号与零值呈现

2026-10-13：用户完成格式预设、全部8处变化项、零值及舍入方向的讨论，并授权实施。决定见[ADR-0103](../../adr/0103-signed-numbers-use-displayed-polarity.md)。

新增 `number-signed` / `number-1-signed`，正数加正号、负数保留负号；一位小数格式先舍入，`0.04`、`-0.04`、0与负零均显示无符号 `0.0`。表格正负颜色与指标卡变化箭头使用同一展示方向，舍入零保持普通颜色且无箭头。原始普通格式、带符号百分比格式、固定颜色规则均保留行为。

商务SDT的3张指标卡各2项月变化、2张效率表的时长环比共8处显式配置新格式，页面版本更新为6.17。数据源及字段默认格式不改。使用HEAD页面作差分校验，差异仅含页面版本、8处字段绑定及3处静态零值正号；查询、计算、行数据与其它正文均精确相等。

| 验证层 | 结论 |
|---|---|
| TypeScript回归 | `pnpm test`：202文件、1800测试通过，见[日志](vitest.txt) |
| 创作侧Python回归 | `metriccanvas-authoring/tool/.venv/bin/python metriccanvas-authoring/test-harness/run_tests.py`：59文件、527测试通过；包含共享正反例校验，不调用真实模型 |
| 创作公共模块复杂度 | `check-authoring-complexity.py`通过：radon 6.0.1，上限15、最大15、零违规 |
| 全仓类型/Svelte检查 | `pnpm check`通过，见[日志](typecheck.txt) |
| 页面产物 | `pnpm validate`：16个页面文档全部通过；6.17新格式门禁、6.16旧文档读取、字段绑定/默认格式/参数与筛选文本/详情视图覆盖通过 |
| 分发 | `pnpm authoring:contracts`生成；contracts检查与Bundle摘要校验通过；没有手改锁或副本 |
| 浏览器 | 本地页面试验场及DQE仿真通过；实际6项卡片变化和2张表展示见[结构记录](browser-actual.json)与[截图](business-sdt.jpg)；浏览器error日志为空 |
| 边界夹具 | 表格和指标卡实际渲染8组正负/零/舍入/缺失值，`±0.04 → 0.0`无符号无色无箭头，`±0.05 → ±0.1`保留方向；见[记录](browser-boundaries.json)与[截图](boundaries.jpg) |
| 真实模型及生产集成 | 未运行真实DS模型、真实DQE、Relay/Java或生产部署 |

边界页面取自[正式合法夹具](../../../packages/page/fixtures/contract-valid/signed-number-page.json)，验收时临时复制至页面目录，验收后删除临时副本。夹具的主值保留普通 `number-1`，可出现负零，用来对照旧格式兼容性；变化项始终按新格式展示。浏览器还发现报告摘要有3处手写 `+0.0天`，已改成 `0.0天`，与变化项的零值规则一致。

本地预览：`http://127.0.0.1:5173/pages/business-sdt-report`。提交及CI状态以Git历史和对应GitHub Actions运行为准。
