# 伙伴健康度 IOC 页头迁移验收

最新 main 交付复核见 [交付记录](../2026-11-02-missing-organization-key/delivery.md)。以下保留迁移时的基线与验收记录。

目标文件：`pages/temporary/partner-health.json`。2026-11-02 本地验收，未提交、未推送、未验证内网真实查询。

## 功能对账

原页为 Dashboard 隐式通用工具栏，未声明 `dashboardToolbar`，没有承担页面身份的正文 `reportHeader`。

| 原始功能 | 目标声明 | 结论 |
|---|---|---|
| `meta.title`：伙伴健康度 | `iocHeader.identity.title` 同文案，原 meta 保留 | 等价承接，身份仅一份 |
| 页级 `stat-year`：2026-10，月 | `iocHeader.filterIds[0]` | 默认值、日期控件和查询绑定保持 |
| 页级 `region`：全球；地区部/代表处树；单选 | `iocHeader.filterIds[1]`；增加现有协议 `treeSelection:"level"` | 使用现有 IOC 区域树能力；搜索默认启用 |
| 总览内 `china-overseas` filterGroup | 原位置、默认中国区和作用范围保留 | 无重复认领 |
| 隐藏层级 `level`、图表和表格的独立切换 | 原声明及绑定保留 | 沿用原语义 |
| 33 个源查询、计算及正文/详情 | 原样保留 | 严格 JSON 对比通过 |
| 页头操作 | 原页没有导出按钮、只读声明、返回声明 | 未新增推测功能 |

页头呈现使用现有迁移规范 `inline / normal / overflow`；根布局继续是 `dashboard`。
Schema 版本继续为 6.77；Schema 字段新增 0、删除 0。只使用既有协议，无引擎或生产 DQE 网关修改。
项目长期规则已加入 `AGENTS.md` 的“IOC 页头迁移（必选）”：分析功能后迁移并明确告知。

## 文件证据

本次开始前备份：`/tmp/partner-health-ioc-header-20261102/partner-health.before.json`。

- 备份 SHA256：`a86a376b05f053d8fe25877d3040207040441edf9df6999db44f7905d2584eb8`
- 迁移后 SHA256：`3bdee5c5aacd020fbfcbeafa8e6e5d74569a6c5154b3b0d3d7263422bb4cafb7`

严格结构对比仅允许增加根级 `iocHeader` 以及原 `region` 的 `treeSelection`，其余字段相等。原页既有查询拆分和缺键行容错工作是前序改动，不计作本次页头改动。

## 验证与边界

- local-authoring 单页校验、repair-page-metadata 单页校验均通过；`pnpm validate` 全部 157 页通过。
- `pnpm test tests/partner-health-scope.test.ts tests/partner-health-overview.test.ts tests/partner-health-union.test.ts`：3 文件、30 项通过。
- `pnpm exec tsc --noEmit -p apps/playground/tsconfig.test.json` 通过。
- `pnpm --filter @metriccanvas/embed build` 通过，使用当前源码重建的嵌入运行时验证。
- `git diff --check` 通过。
- 浏览器直接读取目标 JSON，候选和 DQE 返回明确使用合成数据：全球地区部图表和代表处表格均有 15 条；ORG-06 筛选总分 6，展开后选择 REP-06 总分 3，表格切换代表处显示 REP-06；清空恢复全球，海外总览为 30。缺项仍显示 `--`，真实 0 与负数保留。
- 420px 外容器验证页头自动换行，标题、日期、区域均可见；宽容器布局见截图。
- 演示地址：`http://127.0.0.1:18235/?demo=synthetic`；宿主脚本在 `/tmp/partner-health-ioc-header-20261102/demo.ts`。直接读取正式 JSON，不给正式 Playground 页面的路由注入合成网关。
- 本地组织夹具补了现有 `fetchFilterCandidates`，父子关系来自已有 Mock 数据；候选代码只用于测试与显式 Mock 页，正式 `partner-health` 仍原样返回其宿主网关，30 项回归包含隔离断言。未将合成候选写入交付 JSON。
- 内网 `fetchFilterCandidates` 接入和其他 IOC 看板正常由用户确认；本次没有直接访问内网，真实权限、业务数据及部署效果由内网验收确认。

## 复杂度

`metriccanvas-ts-ast/1`，TypeScript 5.9.3，逐函数 `selfCC`；包含全部新增闭包，详见前后 JSON。

| 函数 | 前 | 后 |
|---|---:|---:|
| `organizationFilterCandidates` | 无 | 2 |
| 该函数 2 个 map 回调 | 无 | 各 1 |
| `createPartnerHealthUnionPreview` | 1 | 1 |
| 其新增 `fetchFilterCandidates` | 无 | 3 |
| 其新增候选 map 回调 | 无 | 1 |
| `partnerHealthUnionGateway` | 3 | 3 |

新增和修改函数均不超过 15；这两个文件的所有函数最高为 10，本次没有复杂度未关闭项。JSON 与 AGENTS 文档没有新增可执行分支。
