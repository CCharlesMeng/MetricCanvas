# 页面诊断仅输出控制台

2026-11-05；独立工作树以 `cbba8e94f` 为基线。此记录保存实施验收结果；提交、远端和CI状态以本记录所在提交及其GitHub Actions为准。

## 实现与声明

沿用既有完整页面及声明；Schema 字段净增减 0。无需页面开关或修改业务 JSON。引擎维护诊断输出职责：

- `TableWarnings.svelte` 不再生成提示条、展开明细或样式，仅通过 `console.warn` 输出数据快照的来源诊断。组合查询与空组织键计算的 warnings 都保留。
- `WidgetHost.svelte` 不再插入“当前载入 X 条，共 Y 条（部分数据）”，改为 `console.warn`。组件结构与正常加载态沿用现有行为。
- 数据清理、结果总数、筛选、排序、分页、失败分类与 Excel 异常说明沿用现有行为。

产品真源为 `PAGE-METADATA.md`、`docs/page-metadata/data-sources.md` 和 `docs/page-metadata/components/table.md`；从真源生成契约、MC 内容及 local-authoring 知识。local-authoring 升至 1.22.3。

## 可观察页面与浏览器

启动 `pnpm --filter playground dev --host 127.0.0.1 --port 5198 --strictPort`。

| 入口 | 操作与结果 |
| --- | --- |
| `/pages/table-data-recovery` | 合并6条、记录关联8条；第二页仍有3条；页面无额外诊断条；控制台有恢复告警；两个 Excel 均回读正确行数及异常说明表 |
| `/pages/table-data-recovery?recoveryState=ready` | 恢复8/8条；不再出现恢复告警；390px表格正常呈现 |
| `/pages/missing-organization-key` | 控制台保留组织键跳行诊断；页面无提示条 |
| `/pages/tokens-monthly-trend` | 保留部分 initial 的业务内容，控制台记录载入条数与总数；页面无提示条 |
| `/pages/multi-source-generated-key?rowFailure=order` | 仍显示256条，排序恢复，页面无提示条 |
| `/pages/multi-source-composite-key?rowFailure=duplicate-composite`、`missing-composite-key` | 保留255条；搜索、分页、导出回归通过；页面无提示条 |
| `/pages/paged-join-diagnostics` | ready/null/duplicate/truncated/budget 五场景通过；可用行、总数、脱值控制台诊断及资源错误边界保留 |
| `/pages/paged-join-on-demand?supplementKey=ready/empty/all-empty/failure/truncated` | 正常与空键场景可翻页；空键仅控制台告警；权限与截断失败边界保留 |

自动入口：`table-data-recovery-browser.mjs`、`paged-union-generated-key-browser.mjs`、`paged-union-composite-key-browser.mjs`、`empty-supplement-key-browser.mjs` 和 `paged-join-diagnostics.browser.ts`。独立脚本均设置 `PLAYGROUND_BASE_URL=http://127.0.0.1:5198`。本地 `/tmp/metriccanvas-console-warnings/browser/result.json` 与 `mixed.png` 保存本批实际浏览器证据；这些可重建产物按仓库忽略规则留在仓外。

## 工程检查

- `widget-host-state`、`table-recovery-export`、`missing-key-export`：3文件、28项通过。
- engine、embed 的 Svelte/TypeScript 检查与 `tsc --noEmit -p tests/tsconfig.json` 通过。
- embed build、单独 check:dist、复制目录的原生 ES/global 及分块失败测试通过；实际 npm tarball 包含全部16个JS，最大929901字节，小于1000000字节。
- Embed 全量首次271/273通过；ESM示例标题等待、inline参数测试的runtime初始化各出现一次时序失败。两个失败在相同源码、相同产物上使用独立4199端口单独重跑均通过。随后固定产物、独立4199端口完整复跑：273/273通过；保留首次失败记录，避免将重跑成功混作首次全绿。
- 生成一致性、MC source coverage、52项MC回归通过；MC诊断夹具先报告摘要漂移，按真源重新生成后检查通过。
- repair入口类型检查与16项CLI/归档回归通过。local-authoring五个定向测试文件共205项通过，覆盖仓外独立安装、知识/哈希、页面校验、工具和升级。
- 全量skills:check曾启动；其中额外包含的历史Bundle/导出隔离行为测试不在本次用户约定的默认Skill验收范围内，已停止该部分，改为执行local-authoring相关五个测试文件；未将整条skills:check记录为通过。

初次同步遇到系统Python缺 fastmcp/jsonschema，改用已安装依赖的Python环境完成生成与MC回归。生成后的诊断夹具按产品真源重新生成。

## 复杂度

口径：`metriccanvas-ts-ast/1`、TypeScript 5.9.3；Svelte仅提取实际script测量，模板另行核对。

| 函数或范围 | 修改前 | 修改后 |
| --- | --- | --- |
| WidgetHost effect回调 | 无此函数 | selfCC 2 |
| TableWarnings effect回调 | 无此函数 | selfCC 2 |
| 新增浏览器console回调 | 无此函数 | selfCC 2 |
| 新增poll/filter回调 | 无此函数 | selfCC 1 |
| 既有修改测试相关回调 | selfCC 1–6 | selfCC 1–6，未增长 |

TableWarnings移除if/each及全部提示DOM，WidgetHost移除notices each。修改的可执行函数及新增回调均≤15，无本批未关闭复杂度项。数据执行与查询算法未修改。

## 证据边界

上述均为本地、合成数据、浏览器及构建归档证据；实施验收未执行真实DQE/Relay、真实模型或线上部署；交付CI另按精确提交核对。原工作区并行改动未修改。
