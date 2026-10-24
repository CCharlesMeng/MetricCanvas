# local-authoring 上下文与页面用数识别验收

本仓工具、工作流与独立分发已实现。验收基线为 `13a651791cfbe05ed8f6053afce02dbfe4e9999d` / Schema 6.44，检出为 `codex/local-authoring-context`。实际模型 token/费用、完整重复试验及真实业务服务另列未验收。

## 交付能力

- Skill 入口按局部呈现、数据/交互、整页创作和修复分流；保留形态确认、快照、完整校验及数据证据要求。
- `read-knowledge.mjs` 支持主题、多主题和精确 Schema Pointer，返回语义原文、当前节点/祖先条件与显式未展开引用；全部原参考和示例保留。新章节/模块必须登记并复核主题归属，语义未被模型摘要。
- `analyze-data.mjs` 支持 scan/index/find/draft/check/prepare。用数沿产品 Schema 与组件树发现；报告绑定页面、MD、Schema 哈希，检查证据原文、位置覆盖、身份和问题引用。prepare 只输出静态候选，未解决问题、无据 queryField、未验证 initial 不进入候选；不改原页面。
- 两工具都提供 --help；安装包只需 Node.js 22+，不调用外部模型/服务。自然语言语义提取由使用 Skill 的 Agent 完成。

使用说明：[Skill](../../../metriccanvas-authoring/skill/metriccanvas-local-authoring/SKILL.md)、[数据识别流程](../../../metriccanvas-authoring/skill/metriccanvas-local-authoring/references/data-analysis.md)。

## 确定性与分发检查

执行范围仅 local-authoring 及其产品参考/目录集成：

```sh
pnpm authoring:contracts
pnpm authoring:contracts:check
python3 metriccanvas-authoring/scripts/check_bundle.py
pnpm test tests/local-authoring-tools.test.ts tests/local-authoring-skill.test.ts tests/page-reference.test.ts tests/authoring-export-isolation.test.ts apps/playground/tests/page-catalog.test.ts
pnpm exec tsc --noEmit -p tests/tsconfig.json
pnpm --filter playground check
pnpm build:playground
```

已确认类型检查、Playground 检查及生产构建通过；契约生成/漂移检查与 Bundle 哈希检查通过。定向测试包括仓外执行、错误证据/过期输入/遗漏位置/改写身份拒绝、合法静态候选、未知查询字段拒绝、多槽/嵌套/条件/关联数据，以及退役生成文件清理。最终定向测试5个文件、79项全部通过（144.79s）。首轮组合清理场景超时后，按两次独立生成调整组合预算为60s，单次子进程30s上限不变；复测通过。没有把未运行的历史 Skill/真实 DS 专项计入通过数。

skill-creator quick_validate 在默认 Python 缺 PyYAML 后，使用 `uv run --no-project --with pyyaml python …/quick_validate.py <skill>` 通过；没有更改仓库依赖或锁文件。

## 读取量与独立前向试用

Skill 入口由基线12,005 bytes缩为5,458 bytes，完整参考仍保留。[retrieval.json](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/local-authoring-context/retrieval.json) 是13类任务的确定性查阅路径对比，只统计 UTF-8 bytes，没有计入模型可能继续深查/修复的轮次，不能解读为实际总 input、缓存或费用节省。

另以相同冻结页面、相同“区域列宽改为220”请求，在全新上下文分别试用旧/新 Skill。评估只获得 Skill 和原输入，不提供预期输出或此前结论。父级核对两份输出逐字节一致，只改目标属性，原输入未变；各自快照、页面校验和快照完整性检查均通过。

| 单次对照 | 观测 |
|---|---|
| 旧版请求读取的5份文件 | 合计203,374 bytes，table全文工具输出发生截断，随后按字节范围重读 |
| 优化版显式读取文件 | 合计15,282 bytes；另有同冻结命令重放的精确知识响应8,224 bytes |
| 解释边界 | 是文件读取与响应量，非模型可见内容的完整计量；脚本内部加载不计入模型阅读；没有token或费用推算 |
| 统计边界 | 每版1次，不能代替12任务×3次的重复评估或证明普遍成功率 |

上述小改动对照先于 --help 指引修正；原审计与冻结信息见[forward/summary.json](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/local-authoring-context/forward/summary.json)。

独立数据分析试用覆盖全部5个字段位置和3个数据槽，识别金额当期/累计歧义、达成率查询契约缺口、区域维度映射和共享源的粒度/范围问题。报告检查通过，输入哈希未变，执行状态保持 not-run。首次试用打开压缩脚本导致截断，后增加 --help 与入口指引；第二次全新上下文试用未读压缩脚本，通过帮助与精确知识完成任务。保留[最终报告](forward/final-report.md)、[实际命令](forward/final-execution-log.md)、[检查回执](forward/final-check-receipt.json)和[输入完整性](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/local-authoring-context/forward/final-input-integrity.json)；这仍不是完整数据集的识别准确率测量。

## 页面与浏览器

页面：[local-authoring-knowledge-demo.json](../../../pages/local-authoring-knowledge-demo.json)，Playground `/pages/local-authoring-knowledge-demo`。输入为[合成指标说明](../../../tools/fixtures/local-authoring-data/metrics.md)，没有真实查询。

```sh
pnpm --filter playground exec vite dev --host 127.0.0.1 --port 5193
PLAYGROUND_BASE_URL=http://127.0.0.1:5193 node apps/playground/tests/local-authoring-browser.mjs docs/evidence/local-authoring-context/browser
```

1280和390宽度均核对金额4,200.0万、达成率42.0%、表格行；窄屏实际横滚访问右列；目录可搜索发现。页面无运行错误，截图已经人工查看。证据：[浏览器回执](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/local-authoring-context/browser/browser.json)、[宽屏](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/local-authoring-context/browser/page-1280.png)、[窄屏](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/local-authoring-context/browser/page-390.png)。仅修改测试页面元数据，未新增样式方案或修改组件。

## 并行工作与未运行项

用户指定的 `Grill筛选器组件独立方案` 使用独立 standalone-filter 检出。本批未修改该检出、其 Schema/filterGroup 实现或主工作区的并行文件。两批会涉及同名 Skill 入口、参考映射与生成清单；隔离避免了互相覆盖，但合流仍须先合真源，补登记新增语义章节，再重新生成，不能复制整个 Skill 覆盖。

真实业务页面/指标文档、真实 DQE/Relay/CloudIOC/DS、完整重复统计、线上保存/发布、远端 CI 均未在本批验收。未知信息继续在报告中列出；当前交付证明本地工具和相应流程可用。

## 2026-10-22 合流交付

交付检出基于 origin/main `082eabbfa1872326bcf460d9fbe7cb0a56720547`（Schema 6.45）。已合入独立 filterGroup 的产品真源，保留筛选器迁移约束；登记新模块和改名章节，补充 filterGroup.core 主题、专题入口及卡内/正文引用扫描回归。清单、锁、机器知识和校验器重新生成，未手工混合旧产物。

上文6.44基线的读取量和独立前向试用保留为历史证据；它们不代表6.45下重新运行了完整重复模型对照。本次合流复验5个文件、81项测试通过，类型/Playground检查、生产构建、分发与哈希检查、宽窄屏浏览器均通过；回执见[delivery.json](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/local-authoring-context/delivery.json)。相对上述main基线，本批没有 packages/engine、packages/page、packages/ui 或 packages/data-execution 源码改动；按用户明确要求使用 [skip ci]，远端CI记为跳过，不计作通过。
