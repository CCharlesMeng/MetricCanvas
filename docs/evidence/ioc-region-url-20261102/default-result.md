# IOC Header Region 默认 URL 输入验收

2026-11-02 用户指出额外映射层多余，本次以 Header 默认行为替代显式配置。之前的 `result.md`、6.79 映射版本及其测量/安装回执仅保留为已撤回过程证据，不能作为当前行为说明。

## 当前方案

- 页面继续使用原有 `iocHeader.filterIds:["region"]` 和 Region 单选组织树。没有 `urlParams.byLevel`，无需添加配置或升级页面 Schema。16 个既有活动 IOC 页面全部恢复原始声明，新建 `ioc-region-url-demo` 也没有 URL 映射。
- IOC Header 默认识别 `region-dept` → 地区部层级，`rep-office` → office 层级；兼容原 IOC 页面已有 department 地区部 ID。值为稳定候选值，中文和特殊字符原样保留。
- 标准参数按 URL 顺序取最后一项，同名重复也取最后值；新输入优先于旧 value/level。改选回写一个标准键并清理同组其他新旧键，保留无关参数。
- 没有 Header 上下文的普通 region 筛选保持原语义，即使层级声明与 IOC 相同也不识别这两个专用键。Header 上下文由 RuntimeSurface 和目标输入投影从实际页面取得；宿主共享示例直接消费既有输入投影，作者不另配映射。
- 候选树、候选权限、查询 levelQueryFields、空选层级保留及严格 URL 门禁沿用既有机制。未接入新的真实组织或权限服务。
- 未发布的 byLevel 字段及其 6.79 能力声明撤回；Schema 仍为 6.78，Skill 为 1.16.0。产品文档、ADR、参考索引、契约向量及分发产物已同步为默认方案。

## 证据

- 页面：`pages/capabilities/filters/ioc-region-url-demo.json`，入口 `/pages/ioc-region-url-demo?region-dept=中国地区部&rep-office=上海代表处`。实际输入没有映射字段。
- Playground Chrome 9/9 通过：中文、正反顺序、重复键、旧链接、页面初值、Header 选中状态与查询字段/值、URL 清理、改选/清空/刷新，以及非法输入阻断。
- 打包 embed Chrome 15/15 通过：共享筛选、显式 URL 优先、清空、导航、返回、候选失效及导出。合计 24 个浏览器用例通过；`default-browser.log` 与 `default-embed-browser.log` 保留实际输出。
- 产品与 local-authoring 定向回归覆盖 236 个文件、2230 项。主轮 235 文件/2229 项通过，另一个文件因新增源码注释中的英文单词误命中页面 ID 子串扫描失败；改用不含该子串的等义注释后单独 1 项复验通过。没有基于页面 ID 的业务分支。日志见 `default-regression.log`、`default-neutrality.log`。
- Engine/Playground 的 Svelte 和 TypeScript 检查通过，均无错误或警告；tools/tsconfig.skills.json、tests/tsconfig.json 检查通过。
- 产品包与 embed 构建通过；`pnpm authoring:contracts`、`pnpm authoring:contracts:check` 确认 1329 product、4 authoring、1 interface 当前。local-authoring 的独立复制、哈希/链接闭合和契约向量与产品一致性均在本批定向回归覆盖；最终生成后再次执行 local-authoring-skill 与页面中立性两文件共36项，全部通过。
- 仓外复制完整 Skill 后，版本检查、无映射合法示例和保留组织键冲突分别退出 0/0/1，见 `default-standalone-skill.json`。

## 复杂度与边界

口径为 metriccanvas-ts-ast/1、TypeScript 5.9.3，函数 selfCC，闭包和回调逐个测量；Svelte 只测 script，生成脚本不当作新增人工函数。编码前从显式版本测基线，编码后测所有修改和新增函数，记录见 `default-complexity.json`。

| 函数 | 显式映射实现 | Header 默认实现 |
|---|---:|---:|
| filterURLKeys | 15 | 15 |
| readLevelURLSelection | 5 | 3 |
| levelURLMappingErrors | 8 | 删除 |
| parseFilterSearch | 10 | 10 |
| filterSearch | 14 | 14 |
| projectNavigationInputs | 7 | 8 |
| filterInputIssue | 11 | 11 |
| iocRegionLevelKeys | 无 | 4 |
| pageInputs（宿主示例） | 无 | 2 |
| createFilterState | 17 | 17 |

本批新增函数和回调均 ≤15。未关闭项为 createFilterState 自身存量 17，不增长；仅传入由 Header 推导的 URL 上下文，未扩展候选、事务或异步协调职责，保留原复杂度治理入口。本批没有真实 DQE/Relay、真实权限、DS 模型、CI 或线上部署证据。

交付基线为 `origin/main` 的 `bf2cc88ebc257a328bf74dbe41b60143f0755df3`，2026-11-02 提交前 fetch 确认没有基线漂移。本批由独立工作树 `/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard` 交付；主工作区并行内容未并入本批。预览端口 5192 由该工作树的 Vite 进程持有。此记录覆盖前一显式映射方案。

版本收尾：最终盘点发现独立工作树基线的 Skill 已为 1.15.0；此前更新内容时未增加发行标识。本次补升至 1.16.0，并重新生成、检查清单及执行独立安装验证。先前 1.15.0 回执只作内容验证过程证据，以最终 1.16.0 回执为准。

Skill 1.16.0 最终检查：local-authoring-skill 与 skill-release 两文件40项全部通过；生成一致性检查通过（1329 product、4 authoring、1 interface）；独立目录合法/保留键冲突验证符合0/1预期。此次收尾只改 Skill 版本元数据与分发锁/回执，未改变可执行分支。最终产品/分发 JSON 清单见 [json-changes.md](json-changes.md)。

提交前复验：`pnpm test packages/page/tests/level-url.test.ts packages/engine/runtime/tests/region-url.test.ts packages/engine/runtime/tests/key-office-filter.test.ts packages/engine/runtime/tests/navigation-inputs.test.ts apps/playground/tests/hierarchy-region-tree.test.ts apps/playground/tests/page-id-neutrality.test.ts tests/local-authoring-skill.test.ts tests/skill-release.test.ts tests/page-reference.test.ts`，9 文件101项全部通过；`METRICCANVAS_PYTHON=<primary>/metriccanvas-authoring/tool/.venv/bin/python pnpm authoring:contracts:check` 通过（1329/4/1）。此前浏览器与构建结果对应同一基线、同一可执行源码，继续有效。CI 结论随实际交付另行报告。

与交付基线同口径比较，filterURLKeys 的 selfCC 为19→15，resolveNavigationTarget 为31→7；新增辅助函数均≤15。createFilterState 保持17→17的存量例外，其未拆原因和后续入口如上。

## 首轮 CI 补修

首轮提交 `55f630873ed54a0db0d3564cc38ac74e3ec95b4b` 的 [CI](https://github.com/CCharlesMeng/MetricCanvas/actions/runs/41404315075) 发现两处漏同步验收：平台 reading-navigation 测试仍断言旧的输入投影键，完整测试为3868通过、1失败、5跳过；MC 诊断可视夹具仍记录221主题，实际为223，导致 authoring 检查失败。这些失败没有改写为通过。

补修同步输入投影 `iocRegion:true` 的平台断言，并通过 `mc-content-fixtures.py` 从最终MC重生成诊断页与三份诊断证据；再从更新后的源页面重生成来源摘要和锁，最后刷新诊断里的内容摘要。未改变产品执行分支、Skill安装目录内容或版本。定向复验4文件36项通过；修改的测试回调与其4个嵌套函数按相同AST口径均保持selfCC 1→1。

补修后的 `pnpm mc:content:check` 完整通过：契约生成一致、MC来源覆盖一致、51项Python测试通过、最终诊断及可视夹具无漂移。执行环境使用已锁定依赖的Python虚拟环境，并禁用字节码缓存。

首轮兼容性随后完成：518项中514通过、4失败，均为 ioc-header-business 两条用例在Chrome/Edge上的旧URL回写断言（region/region.level），未当作无关失败忽略。补齐为rep-office及旧键清理断言后，本地运行 `MC_EMBED_EXAMPLE_PORT=4196 pnpm --filter @metriccanvas/embed exec playwright test tests/browser/ioc-header-business.spec.ts tests/browser/key-office-filter.spec.ts tests/browser/navigation.spec.ts`，21项全部通过。28个测试函数与回调selfCC均不变，最高4；没有产品源码变化。第二轮CI因尚未包含该浏览器断言补修，已主动取消，以最终提交的新CI为交付结论。
