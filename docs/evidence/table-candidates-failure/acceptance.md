# 表格查询失败后的表头候选验收

日期：2026-11-05。交付基线：`3c42c138b6dadbae4495c18e04bee0d557e936b9`。实现位于本任务独立工作树；原工作区的并行改动未纳入。

## 问题与最终行为

比较期补查失败后，ComponentRenderer 用内部错误提示和重试按钮替换整张表，导致用户配置的表头筛选也消失。所属当期成员仍可独立返回候选。

本次删除该替换分支。查询失败时保持用户配置的表格结构和筛选，不注入失败说明、重试按钮或默认“暂无数据”。错误快照仍保持错误状态，展示行为空；控制台诊断与 data-error 内部事件保持。候选继续遵守权限、条件、完整性、取消和过期回执规则，不从残缺行集补选项。正常空结果与用户配置的内容保持原行为。

声明仍使用现有 `filterable: {mode: "select"}`，Schema 字段净增减为0。本地创作 Skill 1.23.1 的表格参考、主题知识、清单与锁从最新产品真源生成，保留 main 已有的 Schema 6.85、表头参数初始化及控制台诊断能力。

## 可观察场景

启动：`pnpm --filter playground dev --host 127.0.0.1 --port 5183 --strictPort`。

- `/pages/period-comparison-query-page?state=error`：合成去年同期请求持续失败；控制台保留错误，客户表头有23个当期候选。选择 C000023 后保持勾选，不展示残缺比较行或额外按钮、文案。
- `/pages/period-comparison-query-page?state=retry`：首次补查失败，通过原本配置的客户筛选选择 C000023，再次查询后恢复1条完整比较行；没有自动重试按钮。
- `/pages/period-comparison-demo?state=retry`：通过原本配置的期间筛选切换后重新查询成功；完整计算与导出边界保持。

页面声明：`pages/capabilities/data/period-comparison/period-comparison-query-page.json`。语义：`PAGE-METADATA.md`、`docs/page-metadata/components/table.md`。操作：页面同目录 README。截图：`failed-supplement-candidates.png`。

## 最新 main 上的验证

- `pnpm test --maxWorkers=2` 加6个候选、组合查询、枚举、期间比较及取消测试路径：6文件16项通过。
- Playground 的 `table-candidates-failure.browser.ts`、`full-query-candidates.browser.ts`：8项通过，覆盖内部错误仍在、候选23项、勾选、已配置筛选恢复、超限、截断、取消与完整读取。
- `period-comparison-query-page-browser.mjs`、`period-comparison-browser.mjs`：两套脚本通过，覆盖分页、按页键补查、四种期间模式、全局排序、筛选、完整 Excel、十万对象与配置内恢复。
- engine / embed 的 check 通过：0 Svelte错误、0警告；更新后的 embed 浏览器测试类型检查通过。
- `pnpm authoring:contracts` 与 `pnpm authoring:contracts:check`：生成与一致性检查通过。
- `pnpm mc:content:fixtures` 后执行 `pnpm mc:content:check`：退出0，MC覆盖与52项测试通过，夹具无漂移。
- `pnpm skills:check`：本批最新基线检查运行中；完成结果补入交付回执。
- `pnpm complexity:check`：通过，无新增或增长的超限项；TS/JS维护代码均值2.223433，Python维护代码均值4.216542，两个语言的全扫描均值也严格小于5。存量超限仍由原台账维护，本批不宣称全仓函数均不超限。

Embed 全量浏览器首轮273项中265项通过，8项仍断言失败时显示“暂无数据”。本批在6个测试文件中仅将失败状态断言更新为空表体；正常空结果的断言保留。修正后的9项诊断/执行/报告场景、1项搜索失败恢复、1项详情宽度场景均独立通过，共11项。首轮非零退出没有作为完整绿色报告；远端 CI 将执行最终源码的完整套件。

## Embed 分发

构建、独立 check:dist、ES/global 复制目录浏览器、Webpack development/production 接入、模块闭合与按需导出已验证。实际 `pnpm pack` 再次构建并执行门禁；归档回读核对完整 dist 的全部JS与本地构建逐字节一致。

- JS文件数：16；最大文件：929,901字节，小于1,000,000字节。
- 归档：`metriccanvas-table-candidates-embed-20261105.tgz`。
- 归档 SHA256：`c7fe8e5e48aeca43137aa9758b633cde533b17dfab501cdd1d77dbe38c244dc6`。
- 锁文件 SHA256：`d2c2a6ca0a914225ccdac58b2457c9332c3bf7988929c054c1945654e7a8bd73`。
- 机器回执：`embed-archive.json`。

## 复杂度与范围

口径：metriccanvas-ts-ast/1、TypeScript 5.9.3。两个产品Svelte文件仅改模板，脚本与 main 真源逐字相同；ComponentRenderer脚本最大CC 2→2，Table脚本最大CC 9→9，不将模板当TS函数计数。新增候选集成测试主体CC5，两个新增浏览器测试主体均CC1，新增openFilter为CC2，所有新增闭包均不超过15。Embed更新的测试主体仅改断言，CC保持：execution 1、报告 5、诊断 8、presentation 6；其余修改函数也不增长。原始前后记录见 `complexity.json`。

本记录证明本地合成网关、浏览器与分发检查；真实 DQE、Relay 和部署未验。提交、远端 SHA 与 CI 以本批 GitHub 记录及聊天交付回执为准。
