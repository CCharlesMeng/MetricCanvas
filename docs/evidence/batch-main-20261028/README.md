# 未合入代码批量交付 · 2026-10-28

本批从 `origin/main=c4b3429e577472e877c3b4c4501376ce089b927e` 建立干净交付工作树 `/Users/moon/.codex/worktrees/batch-main-integration/DataDashboard`，分支 `codex/batch-main-integration`。保留主检出及既有工作树的未提交修改，只迁入核对过的增量。

## 批次与文件范围

| 批次 | 实际内容 | 提交 |
|---|---|---|
| 1 功能补全 | Platform 开发代理禁用上游证书校验、记录路径与凭据存在性；日志不包含凭据值或查询参数。层级表格候选适配器以明确合成归属关系建树，补实际页面联动测试、示例操作说明和协议参考入口。 | `2feec3843` |
| 2 原型与临时页面 | 合并饼图表格式图例原型和层级交互原型；设计文档冲突保留 main 的正式实施结论，补原型来源。原型保持独立入口。成熟度期间联动页纠正 6.66 → 6.67，并声明区域单选，保留 inline 合成数据与现有业务结构。 | `7d9e19f45`、`8d5420387`、`49fcded1c` |
| 3 分发与收口 | 从产品参考重新生成契约、MC、local-authoring 及夹具；Skill 1.7.0 → 1.7.1。核对独立安装、远端与精确 SHA 的完整 CI，按交付规则清理已合并原型分支与本次工作树。 | 本记录所在提交 |

已经交付的伙伴健康度、期间策略、审批时间下推、Report 组合指导、层级表格正式能力不重复搬入。其他工作树中的旧 Schema/生成物不作为本次实现基线。

## 验证

- `pnpm test --exclude tests/authoring-export-isolation.test.ts`：376 个文件通过，3385 项通过、4 项既有跳过；耗时隔离测试由本次完整 CI 验证，本地结果不称为全量通过。受影响的代理与层级功能首轮独立回归为 4 文件58项通过。
- `pnpm --filter playground check`、`pnpm --filter platform check`：均0 errors、0 warnings；`pnpm exec tsc --noEmit -p tests/tsconfig.json`通过。
- `pnpm build:playground`通过；`pnpm validate pages`：130/130通过。
- 从最终源文件执行 `pnpm authoring:contracts`、`pnpm mc:content:fixtures`、`pnpm mc:content:check`通过，包括33项MC测试。Python使用项目已锁定虚拟环境；按生成器UTF-8读取口径，709个sourceIdentity输入摘要均一致。
- 完整复制 local-authoring 到仓外临时目录：6.67临时页校验通过；原6.66文件因期间显隐能力下限被拒绝，20条准确路径诊断。合法/非法检查与链接封闭另有local-authoring测试覆盖。
- 最初的本地整批命令在临时页旧区域声明触发既有断言、且生成输入尚未冻结时已取消；修正、冻结、重新生成后，以以上完整本地回归和本次CI结果为准。首次MC夹具命令用系统Python缺jsonschema，改用项目虚拟环境后通过；未改门限或依赖锁。

## 当前基线浏览器与导出

本次实际服务：交付工作树的 Playground `http://127.0.0.1:5246`、DQE Sim18246；独立HTML原型静态服务5247。上述为验收期间入口，收口后停止。

1. `/pages/table-hierarchy-selection`：一个区域树内直接选择上海，URL保留`region=O101`及`region.level=office`；2026父整体1200、子360，切2025为960/288。
2. `/pages/contract-maturity-score-linked`：月、年、季、近一年模式分别仅显示对应KPI，刷新保留近一年模式；两张表沿同一声明替换期间列。仅合成呈现，不代表业务取数联动。
3. `/prototypes/pie-table-legend?variant=A|B|C`：实际绘图、移动类别转自定义排序、左右方案切换；390px视口等待图表ResizeObserver稳定后不横向溢出。开发路由保持生产404约束。
4. 层级HTML原型：上海选择、切年联动通过；真实下载.xlsx并ZIP/XML回读工作表“地区部汇总”“代表处明细”，数据行分别4/17。
5. 本次浏览器未捕获pageerror。截图、机器回执和下载文件存于本目录本机附件，遵循证据仓库规则不新增跟踪原始附件。

## 复杂度

工具`metriccanvas-ts-ast/1`、TypeScript5.9.3，按逐函数selfCC计量，含所有新增闭包与回调；Svelte脚本及模板表达式分别提取，HTML跳过原样内嵌的第三方ExcelJS，仅测作者脚本。

| 函数或范围 | 前 → 后 |
|---|---|
| developmentServer | 4 → 4；新增configure与proxyReq回调均1 |
| 代理测试两个主回调 | 8 → 9、6 → 7；其余新回调1 |
| createHierarchyGateway / encodeSearch | 1 → 1 / 2 → 2 |
| fetchFilterCandidates | 2 → 5 |
| regionTree及其新回调 | 新增1、1、1、2 |
| 层级HTTP联动测试 | 新增主回调6，内部回调1–2 |
| 饼图原型39个函数/回调及1个路由load | main新增；当前实测最高10，load为2 |
| 层级HTML原型作者函数/回调119个 | main新增；当前实测1–10，第三方脚本原样保留 |

正式运行时和Schema未新增分支。临时页与说明不涉及可执行函数。新增/修改函数无未关闭CC>15项。

## 证据边界

本地浏览器使用inline或HTTP DQE Sim；不代表真实DQE、Relay、生产权限或DS模型验收。原型归档不增加正式协议能力。推送、远端SHA、CI及清理结果以本次交付回执为准。
