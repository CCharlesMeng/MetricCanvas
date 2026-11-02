# 按页同比环比：main 交付复验

日期：2026-11-02。承接基线 `2db7f26ee05b8fad0c59f937fadecdd591c24681`，独立交付工作树 `period-delivery`。本记录固定提交前的源码验证；提交后完整 CI 以该提交对应的 GitHub Actions 为准。真实 DQE、Relay、DS 模型与部署未运行。

## 交付内容

Schema 6.78、local-authoring 1.15.0。主查询执行后端分页，比较期只按本页业务键补查，再统一计算增长率和百分点。主查询持有行域、排序和总数；计算列仅展示，完整导出逐页补查。原完整集合模式保留。

使用说明：[配置、限制、操作与预期结果](../../../pages/capabilities/data/period-comparison/README.md)。演示入口 `/pages/period-comparison-query-page`；旧模式 `/pages/period-comparison-demo`。均使用专属合成网关，不代表真实 DQE 验收。

## 接入最新 main

保留最新 main 的子表折叠缓存、页面加载结构、盘古部署配置与分发完整性能力；合并示例注册表和文档索引。已有 ADR-0126 属于子表折叠缓存，本批使用 ADR-0127。产品真源合并后重新生成契约、MC、本地 Skill 与诊断示例，不复制旧基线的派生产物。

## 本地验证

- 核心协议、执行、运行时和表格回归：250 个文件、2092 项通过。
- `pnpm check`：全仓类型检查通过，各 Svelte 检查均为 0 错误、0 警告。
- `pnpm validate`：153 个页面通过，0 失败。
- 新按页浏览器脚本通过：有界首屏、本页键补查、翻页、四种期间、当期阈值作用域、完整 Excel、十万对象、失败重试；旧完整集合浏览器脚本通过，无 pageerror。实际查看交付版本首屏截图。
- `skills:repair:check`：定向类型和 16 项工具/分发测试通过。
- 独立 local-authoring 归档与仓外回验通过：Skill 1.15.0、Schema 6.78；本地归档回执标记 uncommitted，仅作为本地验证。
- 升级示例版本漂移已用产品升级器修正；`local-authoring-upgrade.test.ts` 最终 112 项通过。完整 `skills:check` 已运行，初次发现该旧版本断言失败；其他长耗时用例与完整检查以提交对应 CI 复验为准，不将初次命令记为全绿。
- MC 首轮 51 项通过；本地字节码缓存触发完整性拒绝后，清理本工作树缓存，禁用字节码写入，重新生成诊断夹具和最终来源摘要。最终生成一致性与夹具检查通过。
- ADR 索引、差异空白检查通过。

## 复杂度

`metriccanvas-ts-ast/1`、TypeScript 5.9.3，比较上述最新 main 基线与交付源码中的 26 个手写 TS/JS/MJS/Svelte 脚本文件；全部嵌套回调独立计数，模板由 Svelte 与浏览器覆盖。完整测量见 [delivery-complexity.json](delivery-complexity.json)。

| 函数 | selfCC 前→后 |
|---|---|
| periodComparisonErrors | 12→12 |
| validateBinding | 14→14 |
| projectionErrors | 15→15 |
| compilePagedJoin | 12→12 |
| projectRows | 2→2 |
| runPageQuery | 7→7 |
| evaluateRows | 9→9 |
| captureJoinedResult | 10→12 |
| computedFailureBinding | 2→4 |
| tableFailureNotice | 3→5 |

全部新增辅助和回调 selfCC≤15；本批扫描范围内无超限或未关闭项。
