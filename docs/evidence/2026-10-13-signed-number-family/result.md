# 普通数值格式族的带符号版本补齐

2026-10-13：用户指出全部 `number` 格式都应有带符号版本，并要求本次独立提交及push，`customBlock`保持未提交。隔离工作树基线为 `e848d05c82202cd9c06fed4b7dd8032474112b2f`；本批只包含数字格式族相关代码、测试、文档及生成契约。

| 原格式 | 带符号格式 | 版本下限 |
|---|---|---|
| number | number-signed | 6.17 |
| number-1 | number-1-signed | 6.17 |
| number-2 | number-2-signed | 6.18 |
| number-grouped | number-grouped-signed | 6.18 |

新格式继承各自原格式的小数精度与千分位策略。两位小数的 `±0.004` 显示 `0.00`，千分位的 `±0.0004` 显示 `0`，均无符号、正负颜色中性、变化箭头隐藏；`±0.005` 与 `±0.0005` 分别显示 `±0.01` 与 `±0.001`，方向保留。千分位判断展示零时处理分组逗号，`+1,234.568`不误判为中性。旧6.17格式与商务SDT的8处配置保持行为。

| 验证 | 结论 |
|---|---|
| 格式、方向、颜色、版本门禁定向测试 | 4文件、87测试全部通过；参数/筛选文本、默认格式及详情绑定同时覆盖 |
| 全量TypeScript回归 | 202文件，1818通过、4跳过、0失败；见[日志](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/2026-10-13-signed-number-family/vitest.txt)，跳过项不计通过 |
| 全量创作侧Python回归 | 527测试：526通过、1跳过、0失败；真实模型调用为0，跳过项不计通过 |
| 全仓类型检查 | `pnpm check`通过，Svelte无错误或警告；见[日志](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/2026-10-13-signed-number-family/typecheck.txt) |
| 公共模块复杂度 | radon6.0.1检查通过，上限15、最大15、无违规 |
| 分发与页面 | 生成契约及Bundle摘要检查通过；16个页面文档通过；ADR索引最新 |
| 实际浏览器 | 表格8行、指标卡16个变化项均验证；新格式正负值、舍入零、舍入临界、缺失和千分位方向通过；见[记录](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/2026-10-13-signed-number-family/browser.json)及[截图](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/2026-10-13-signed-number-family/browser.jpg)；error日志为空 |
| 真实服务及部署 | 未执行真实DS模型、真实DQE、Relay/Java或生产部署 |

本地跳过项依赖被gitignore排除的设计参考源及语义目录原始证据，在隔离工作树中未提供；格式定向测试没有跳过。

浏览器使用本地页面试验场19191端口与正式合法内联夹具；临时页面副本验证后已删除。产品源是孤立工作树内的代码，未使用主工作区正在开发的自定义组件。提交和CI状态以Git历史和对应GitHub Actions运行为准。
