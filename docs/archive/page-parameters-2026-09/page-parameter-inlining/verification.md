# 页面参数原位引用：实施与验收记录

日期：2026-09-17。工作区基线：`14526fbb6e11218e741ac9820a144d01662c90f6`。

P1—P7 的本仓实现已交付：Page 6.5、独立解析/迁移/提取、运行时与发送门禁、人工模板评审、现有单次保存接线、Python 程序交接、共同向量和外部调用示例。没有创建另一种模板根文档、实例存储或模型召回流程。E1 真实 Java／Relay／外部召回接入未验收，不宣称生产接通。

全仓测试有两项已存在的基线失败，见下文。它们没有被跳过、修改预期或隐藏；本任务定向检查与浏览器测试通过。

## 可复核命令与结果

| 检查 | 结果 |
|---|---|
| `pnpm exec vitest run packages/page/tests packages/engine/runtime/tests apps/platform/tests/workbench/authoring-publication.test.ts apps/platform/tests/workbench/inline-parameter-publication.test.ts apps/platform/tests/java-assets-integration.test.ts tests/publication-contract.test.ts` | 63 文件、555 测试通过；随后新增的 15 个共同向量另行通过 |
| `pnpm exec vitest run packages/page/tests/inline-param-contract.test.ts` | 18 测试通过，含 15 个 TS/Python 共用向量 |
| `pnpm test` | 已执行；最终单 worker 复核见下文，两项基线失败保留 |
| `pnpm exec vitest run --maxWorkers=1` | 最终 159 文件通过、2 文件失败；1434 测试通过、2 项基线失败、5 项既有跳过，共 1441 项 |
| `PATH=/private/tmp/metriccanvas-inline-params-venv/bin:$PATH pnpm authoring:test` | 436 测试通过，含真实 Node 子进程提取/解析和 stdio/Java HTTP 既有回归 |
| 同一 Python 的 `-m unittest discover -s metriccanvas-authoring/test-harness/tests -p test_page_validation.py` | 最后补齐窗口共同向量后 8 测试通过 |
| `pnpm check` | 工作区全部类型检查通过，Svelte 0 错误、0 警告；新增共同向量测试又经 page 测试类型检查 |
| `pnpm validate` | 12 个现有页面全部通过 |
| `pnpm authoring:contracts` / `pnpm authoring:contracts:check` | 作者导出、生成一致性检查通过；480 product / 4 authoring / 1 interface 文件 |
| `python metriccanvas-authoring/scripts/check_bundle.py` | Bundle 0.2.0，1489 摘要检查通过 |
| `pnpm build:packages` / `pnpm packages:check` | 三个源码包构建、四个交付包公开面与产物检查通过 |
| `pnpm --filter @metriccanvas/embed build` / `pnpm --filter platform build` | 浏览器交付与平台生产构建通过 |
| `pnpm --filter @metriccanvas/embed exec playwright test inline-params.spec.ts params-initialization.spec.ts` | 4 浏览器用例通过，覆盖新路径与 classic/ESM 旧路径 |
| `node apps/platform/tests/workbench/inline-parameter-browser.mjs` | 本地 HTTPS 工作台＋HTTP 替身通过：预览、非法 JSON、来源变化、取消、一次无值保存、未知不重试 |
| `node --import tsx packages/page/examples/resolve-page-params.ts` | 两种输入方式一致，输出普通 DQE start/end/dim_value_list |
| 从 `packages/page/dist/index.js` 独立导入 resolvePageParams | 6 个 typed inputs 成功，无渲染包、Relay、网络参与 |
| 两份分发 Skill 的 quick_validate | 均通过；工具权限未增加 |
| `git diff --check` | 通过 |

本机 Python 默认环境缺少锁定依赖；验证使用 `/private/tmp/metriccanvas-inline-params-venv`，按 `metriccanvas-authoring/tool/requirements.lock` 安装。需要监听本机端口的测试在授权沙箱外运行；首轮 EPERM 是环境限制，不作为产品失败或通过证据。未连接真实 DQE/Java，未推送或部署。

## AT 追溯

| 验收 | 证据与观察 |
|---|---|
| AT01 同构 | `tokens-parameter-roundtrip.test.ts`：去掉 filled.params.value 后与 template 深度相等；同一 validate 接受两者 |
| AT02 类型 | `inline-param-contract` 共用向量、`resolve-page-params`：单/多维度、重复/空值、闰日、反向区间、value/default 冲突与 required 版本门禁 |
| AT03 缺值 | `inline-param-initialization` + embed `inline-params.spec.ts`：带旧 initial 的无值页面零 HTTP 请求，不呈现旧行 |
| AT04 引用位置 | 共同向量：未知 ID、额外键、越界消费位置、双端/窗口不一致、混用绑定；既有 `page-param.test.ts` 保证业务行不在文本替换范围 |
| AT05 确定性 | resolver 与 Tokens 回填测试：原稿不变、相同输入结果一致、文本与 DQE 同源、日/月闭区间；browser 检查区间显示 |
| AT06 提取身份 | extraction / Tokens 测试：可信身份同值归并，无身份和异值分开，不提取 groupBy/metric 条件 |
| AT07 勾选覆盖 | 全覆盖、3/5 多数、2/5 少数、单查询；UI 显示原值与覆盖/未覆盖，选择决定产物 |
| AT08 筛选接管 | runtime 新测试与既有 classic/ESM 浏览器：受控查询清空不复活参数，未绑定查询保持固定值；6.5 旧绑定只注入一次 |
| AT09 保存与空结果 | Tokens browser 下半年返回空行、不回退旧行；发布 browser 和真实 single-save Adapter 测试保存无 value/default/initial 的模板 |
| AT10 迁移等价 | migrate 测试覆盖 time fixture、dimension fixture、现有 flow-analysis-report-params 的全部查询；旧可选维度绑定拒绝迁移；筛选谓词顺序回填回归 |
| AT11 权威输入 | browser 冲突 URL 不覆盖已填 value；resolver 非法显式值失败；HTTP 请求逐项无 param，保留原 DQE 拼写与查询粒度 |
| AT12 命名稳定 | report_period 不匹配 report-period；重复提取/label 变化复用 ID；身份不同/取值不同不合并 |
| AT13 确认完整性 | inline-publication 状态测试、browser：选择/输入/文本修正会清预览，来源变化失效；旧 publication 完整性回归仍拒绝篡改 |
| AT14 写入边界 | `java-assets-integration.test.ts` 新用例贯穿 coordinator.publishTemplate→持久队列→createSingleSavePort→Java Adapter；只写一次且 is_draft=false。状态测试区分 queued/unknown/confirmed，取消不写；Python 完整 artifact 不进入 relay_summary |
| AT15 独立交付 | 构建包直接导入、可运行双输入示例、Python→真实 Node 程序、生成的完整输入/输出向量；未新增 MCP 工具或实例存储 |

## 完整向量与浏览器证据

- 具体五查询夹具：`packages/page/fixtures/parameter-extraction/tokens-parameter-source.json`。它是明确的本地仿真基线，不是 `pages/tokens-report.json` 的真实数据改造；后者原为 inline 页面并保持不变。
- 全链路向量：`contracts/metriccanvas/page/conformance/parameter-extraction.json`，含 input/context/candidates/selectedIds/template/originalValues/filled/execution，由作者脚本确定性生成，Python 真实程序回放核对。
- 共同引用向量：`page/conformance/inline-params.json`；共同发布向量：`authoring/publication-conformance.json`。Bundle 通过导出同步，不手改快照。
- 本机截图：`/private/tmp/metriccanvas-inline-params-empty.png`、`/private/tmp/metriccanvas-inline-publication-review.png`。发布入口仅在 dev 的 `/publication?inline` 启用；生产路由输出“仅供开发环境使用”。
- 本轮曾因移动 dev 夹具触发 Vite 旧模块缓存；重启测试服务后最终 browser 通过。并行全测曾出现既有 authoring-language 短延时时序失败；定向 53 测试及最终单 worker 复核通过。

## 保留的全仓基线问题

1. `tests/dev-server-contract.test.ts:27` 仍要求默认端口 5174；基线 HEAD 的 `apps/platform/vite.config.ts` 默认已是 443。两文件本次均未修改，`git show HEAD:apps/platform/vite.config.ts` 可复核。
2. `tests/page-reference.test.ts:25` 的退役冻结清单仍把可继续生成的文件当冻结来源。期望 actions-and-navigation.md 的 SHA256 为 `04cf9991fa10b61facdbe2fc7248349f7877dac061b499e65d200730a8ab0432`；**本轮之前的 HEAD 内容**已经是 `be3deb2654a9d9fc1ec85b08adad438d7572fc1e4e11112b3ff5a6b9fa59376e`（`git show HEAD:metriccanvas-authoring/contract-snapshot/page/reference/actions-and-navigation.md | shasum -a 256`）。本轮合法 6.5 导出继续更新该文件；未篡改冻结清单让门禁转绿。生成内容逐字一致的另一用例已经通过，并将其硬编码旧版本改为 versionPolicy.current。

这两项不影响本轮参数行为的通过证据，但意味着不能宣称“全仓所有门禁全绿”。修复历史冻结归档和开发端口契约不在本轮参数任务内。

## 外部交付边界

`external-integration.md` 给出真实提供方清单。ParameterSourcePort/ParameterProgram 是明确的程序接缝；默认部署没有可信最终验真基线时，不开放模板提取入口。页面协议支持、程序本地验证、真实提供方接通是三件事。E1 尚未完成，特别是生产保存回读、召回值规范化与真实 DQE 权限链路。
