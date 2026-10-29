# 父子表零总数兼容修复（2026-10-29）

初始实施基线 `d24a417210041a3c057e06dd0012e07d0bcc6c76`，独立工作树 `hierarchy-zero-total`。主工作区的并行 Schema 6.74 和 Skill 1.10.0 改动未带入；本批保持产品 Schema 6.73，local-authoring 从基线1.9.0修订为1.9.1。此段为实施期状态；本次main交付基线与复验见末节。工作树和5191预览服务用于当前回放。

## 根因与范围

查询执行层已允许对象查询的 `total_count: 0` 与非空返回行用于显示。层级表格控制器 `createTableController.hierarchySnapshot` 又用总数与父行条数严格相等进行显示校验，导致已ready的父结果被转为 `DQE_QUERY_REJECTED / 父汇总结果不完整`。

只在该显示检查中排除零总数。保留原始父行和totalCount，不改写为可信完整结果；父级选择、本地分页和展开消费已返回父行。父行键缺失/重复、父级匹配歧义、定位等待/失败、非零计数矛盾仍失败。完整归属查询、完整结果绑定、跨源计算、完整父子导出的规则保持。

## 验收映射

- Playground：`pages/capabilities/query/query-zero-total-hierarchy.json`，入口 `http://127.0.0.1:5191/pages/query-zero-total-hierarchy`；合成响应和候选在 `apps/playground/fixtures/zero-total-gateway.ts`，原有零总数示例仍可使用。
- 协议说明：`PAGE-METADATA.md`、`docs/page-metadata/components/table.md`、`docs/page-metadata/data-sources.md`；不新增页面属性、不升级Schema。
- local-authoring：从产品真源重新生成协议知识、校验器及清单；`table.hierarchy-selection`主题已包含本次显示边界。安装实体由独立目录测试验证。
- MC：同源生成并更新受文档影响的诊断夹具，不手改派生知识。

## 复现与验证

修复前执行 `pnpm exec vitest run tests/hierarchy-zero-total-rendering.test.ts`，8项中2项失败，均命中“父汇总结果不完整”；修复后8项通过。

相关回归 `tests/hierarchy-zero-total-rendering.test.ts`、`tests/zero-total-rendering.test.ts`、`packages/engine/runtime/tests/hierarchy-selection.test.ts`、`packages/engine/runtime-ui/tests/hierarchy-export.test.ts` 共4文件39项通过，覆盖已返回行、本地翻页、父级选择、重复/缺失行键、非零计数矛盾与完整父子导出拒绝。现有层级回归同时覆盖取消、过期查找和导出失败。

`pnpm validate`：135/135页面通过。根tests TypeScript、engine check、Playground check均通过；两个Svelte检查均0错误0警告。local-authoring五个定向文件193项通过，包含完整目录仓外复制、链接和哈希检查、合法/非法文档及升级。新合成页面经独立validate-page脚本验证通过。生成一致性检查和MC覆盖检查通过；MC Python 33项通过，诊断夹具已重新生成。

该基线不存在 `skills:check`脚本，且既有repair诊断CLI引用未导出的fileNameErrors；本批不承接该并行修复，页面校验使用产品 `pnpm validate` 和独立local-authoring校验器，未放宽任何规则。

MC最终完整检查已通过：生成一致性、源覆盖、33项Python测试和更新后的诊断夹具全部通过。

本机Node同步子进程的标准输入管道偶发未结束，采样确认Python停在readall；原生顺序生成一致性检查已通过。最终检查使用本机临时 `METRICCANVAS_PYTHON` 适配器，按导出器既定格式读取一份完整JSON对象并经json.loads严格校验，再以StringIO交给原始mc-contracts.py；使用相同锁定Python3.12环境、原始生成器和完整断言，不修改产品代码或生成内容。导出隔离按本次修改范围定向复验“结构不变的语义修复使旧MC失效，重新生成后同源主题更新”：1项通过，29项未运行。之前的完整隔离测试尝试因本机管道等待被中断，不记为通过；协议升级、工具参数等其他隔离场景未作为本次验收结论。

## 浏览器证据

使用实际Playground与统一运行时手动核验：合成场景首屏甲地区部0.0、展开甲代表处得分7；选择乙地区部后仅显示该行-2.0；选择甲代表处后完整查找定位甲地区部并自动展开。点击完整导出报“object 完整结果行数超过 totalCount”，不下载部分工作簿。

用户原始页面及捕获响应仅在忽略目录 `.scratch/authorization-norms-replay/` 回放，未纳入示例、测试、分发知识或本记录。原始响应仍保持11行/总数0，在修复后显示10行第一页，并能翻到第二页的第11行。截图 `.scratch/authorization-norms-replay/fixed-original.png` 显示“原始响应：总数0”已选；未使用“更正为11”的对照来证明修复。未提供真实子表响应，不声称完成真实子表、DQE或Relay联调。

## 复杂度

同一工具 `metriccanvas-ts-ast/1`，TypeScript5.9.3，独立函数selfCC，排除嵌套函数体并分别测量闭包；测量覆盖修改函数和全部新增辅助函数。

| 函数 | 修改前 | 修改后 |
| --- | ---: | ---: |
| createTableController/hierarchySnapshot | 10 | 11 |
| pageExternalInputs | 13 | 14 |
| zeroTotalPreviewGateway | 2 | 3 |
| createZeroTotalPreview / fetchImpl | 1 / 1 | 1 / 1 |
| replayResult / find回调 | 新增 | 6 / 1 |
| fetchFilterCandidates | 新增 | 1 |
| 新测试全部辅助函数和回调 | 新增 | 最高4 |

原匿名回执映射回调selfCC为3，现按职责拆到replayResult中。没有本次新增或修改函数超15；本文件扫描未发现额外超限项。未修改生产网关、查询执行或完整导出算法。

最终执行：`METRICCANVAS_PYTHON=/tmp/mc-hierarchy-python-input pnpm exec vitest run tests/authoring-export-isolation.test.ts -t "结构不变的语义修复" --reporter=verbose`（1通过、29未运行，64.90秒）；相同输入适配下 `pnpm mc:content:check` 整链退出0。`git diff --check`通过。

## main交付复验（2026-10-29）

按用户授权提交并推送main；交付基线为最新远端 `4128c2b5941a282a328016f2b7ff255f22dc7baf`。保留main已有的组织并集和组合表格恢复能力，仅接入本次父子表显示修复、合成场景、测试和说明。两个冲突保留main的伙伴健康度/表格恢复入口及目录说明，再添加本次示例。Schema保持6.74，local-authoring从main的1.11.0修订为1.11.1，知识、清单及MC诊断夹具全部从新基线重新生成。

换基线后执行 `pnpm test` 指定10文件，235项通过；包含本次39项回归、193项local-authoring检查和3项表格恢复导出回归。根tests TypeScript、engine check和Playground check通过；`pnpm validate` 138/138通过。完整 `pnpm mc:content:check`通过（生成一致性1295产品文件、源覆盖、33项Python测试、诊断夹具）。原始11行/总数0响应在最新基线的浏览器回放再次显示完整第一页与11条本地计数。未追加真实DQE或Relay验收。

同一AST口径复测：hierarchySnapshot为10→11；main新增两个示例入口后pageExternalInputs基线为15，本批使用Set管理两个零总数示例，修改后仍为15。其余修改/新增函数维持前表数值，无本批超限项。

仅暂存显式39文件清单；用户捕获响应、截图和本机输入适配器均留在忽略目录或临时目录，未交付原始业务数据。提交、远端SHA与CI最终结论以交付回复为准。收口保留本任务工作树及5191服务，因为当前聊天的浏览器仍在查看该回放；本任务不创建GitHub分支或PR，其他任务工作树不在本批清理范围。
