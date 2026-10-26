# 表格原文容错、本地尾排和独立置顶汇总验收

日期：2026-10-26。Schema：6.60。实现位于独立工作树，开发基线 `7834fbc5bc2534209e9358c2252bc9bd50e1eec8`，交付时整合 `bf66b1caf6e35cd34b237c15aafe0fb797eb0017`（图表常量取值 6.59）；按本批清单向 main 交付，原工作区的并行内容保持原样。提交与远端 CI 状态以交付回执为准。

## 实施结果

| 能力 | 可观察入口 | 产品协议与创作 |
|---|---|---|
| 查询异常标量保留原文并聚合告警 | `/pages/table-value-tolerance` | fields、table 文档；序列化 `cellFallbacks`；有效值继续为 null，不进入计算、行键或查询输入 |
| 本地升降序缺失尾排 | `/pages/table-missing-sort` | table 文档；真正缺失、空白及纯 `-–—` 文本始终尾排；0、false、负数正常 |
| 独立查询的中国区置顶汇总 | `/pages/table-pinned-summary` | 组件及叶列 `pinnedTop`；独立完整 query；每页第一行、无序号、不占明细计数；属性面板原子编辑槽和列绑定 |

对应文档：[table](../../page-metadata/components/table.md)、[fields](../../page-metadata/fields.md)、[data-sources](../../page-metadata/data-sources.md)、[ADR-0120](../../adr/0120-table-scalar-fallback-and-independent-pinned-row.md)、[实施设计](../../plan/2026-10-26-table-tolerance-and-pinned-row.md)。具体页面及启动步骤见 [pages/capabilities/table/README.md](../../../pages/capabilities/table/README.md)。

查询标量的类型失配原文与有效类型值分开；快照、网关返回、计算投影、pagedJoin、初始行往返、行筛选及分页均携带对应证据。行数或顺序改变时重新建立证据索引，不能把上一个行号的原文附到另一条记录。仅格式不兼容时保留有效值，表格显示原文并聚合诊断。诊断不记录原始业务值。

汇总沿用现有独立查询执行链和权限上下文，前端不求和。用户地区条件仅绑定明细，共同时间及产品分别绑定两源。汇总零行省略，多行、失败或总数不一致只影响汇总；Excel 则拒绝下载不完整表格。置顶行只读，不继承行选择、单元格动作、跨行合并及展开。报告静态呈现使用相同行投影，保留原有部分失败策略。

## 本地验证

| 层次 | 实际命令或入口 | 结果 |
|---|---|---|
| 类型与 Svelte | `pnpm check` | 通过，Svelte 0 errors / 0 warnings |
| 运行时与协议回归 | `pnpm test packages/page/tests packages/data-execution/tests packages/engine/runtime/tests packages/engine/widgets/tests packages/engine/runtime-ui/tests apps/platform/tests/workbench/table-pinned-edit.test.ts`，整合主干后扩展为 `apps/platform/tests/workbench` | 整合主干后合计 258 文件、2255 项通过（覆盖完整 workbench 套件） |
| local-authoring | `pnpm test tests/local-authoring-tools.test.ts tests/local-authoring-skill.test.ts tests/local-authoring-upgrade.test.ts tests/page-reference.test.ts` | 4 文件、149 项通过（使用 `--maxWorkers=1` 顺序执行文件，保留原有每项时限），包含仓外复制安装、知识引用闭合及独立校验器 |
| 文档与派生契约 | `pnpm authoring:contracts`、`pnpm authoring:contracts:check` | 1186 product、4 authoring、1 interface 文件生成及一致性检查通过 |
| 页面校验 | `pnpm validate pages/capabilities/table` | 99 页面通过（交付前执行全量 `pnpm validate`） |
| 构建 | `pnpm build:packages`、`pnpm build:playground`、`pnpm packages:check` | 全部通过 |
| 实际 npm 包安装 | 打包当前 page 与 data-execution，仓外 `npm install --ignore-scripts` 后只从包入口运行 | Schema 6.60；序列化网关证据、SourceProgram、本地排序、重新投影以及 executor 原文初始行往返通过 |
| 浏览器 | `node apps/playground/tests/table-enhancements-browser.mjs`，Playground 5180 + DQE Sim 18229 | 三个路由、桌面及 390px 窄屏；页面运行错误 0；下载 Excel 单元格原文核对通过 |

契约生成及独立安装测试使用项目 Python：`METRICCANVAS_PYTHON=<原项目>/metriccanvas-authoring/tool/.venv/bin/python`。未把系统 Python 缺少 fastmcp 当成产品失败。其他历史 Skill 与真实模型不在本次验收范围。

浏览器直接读取页面声明。已验证：原文文本与 Excel 一致；升降序横杠尾排；置顶行每页重复且没有序号；第二页明细序号从 3 开始；地区改变不新增汇总请求，产品和时间改变重读；多行和查询失败时明细继续显示，导出给出明确错误，恢复正常后汇总重新出现。机器结果保存为本地验收产物 `results.json`。交付前再次通过完整浏览器脚本、构建和 engine Svelte 检查。MC 内容检查使用同一项目虚拟环境补跑；来源覆盖、30 项 Python 检查和生成示例漂移检查均通过。

截图 `tolerance.png`、`missing-sort.png`、`pinned-summary.png`、`pinned-summary-mobile.png` 随机器结果外置保留。按仓库 `.gitignore`，原始截图及 JSON 不随仓提交。置顶行使用普通表格行的白底黑字，并按用户反馈将整行字重设为 600；明细保持 400。此次只调整模板样式绑定与 CSS，未改变 script 函数或复杂度。浏览器 computed style 已逐格核对背景、文字颜色及字重。窄屏截图保留了先前一次导出失败的反馈状态。

## 复杂度

工具 `metriccanvas-ts-ast/1`，TypeScript 5.9.3；统计每个函数的 selfCC，包括测试闭包、脚本及新增辅助函数。Svelte 单独提取 script 测量，模板通过 Svelte check 和浏览器验证。扫描 58 份当前脚本、48 份基线脚本；新增函数最高 13，无新增超过 15。完整原始结果 `complexity-before.json`、`complexity-after.json` 按仓库规则留在本地验收归档，交付结论如下。

| 相关函数 | 修改前 → 后 | 说明 |
|---|---|---|
| `editExistingProperty` | 15 → 14 | 特殊属性分派独立，置顶源和绑定原子提交 |
| `normalizeQueryRows/numericValue` | 13 → 移除 | 提取 `finiteNumeric` 6、`normalizeNumeric` 6、`normalizeScalar` 11，原文与有效值分类 |
| `sortTableRows` 比较回调 | 10 → 3 | `compareTableCells` 6，明确方向不反转缺失分组 |
| `pinnedBindingErrors`、`editPinnedTable` | 新增 → 13、13 | 新增函数最高值 |
| `DetailContent.data` | 7 → 7 | 行投影重建证据，导出克隆同时保留可序列化证据 |
| `computedSnapshots/visit` | 27 → 27 | 仅增加证据恢复与序列化，不拆现有遍历流程以免扩大回执行为风险 |
| `timeFill` | 19 → 19 | 仅复制已有行的展示证据，保留插值/补行语义 |
| `exportComponentData` | 23 → 23 | 本批的槽状态检查已提到独立 helper，保留现有组件导出分派 |
| `parsePage` | 31 → 31 | 校验后无条件调用证据附加，不增加主校验分支 |
| `rowExpansionErrors` 及组件回调 | 21 / 65 → 21 / 65 | 仅把槽数量判断改为明细槽判断，避免在本批改变既有子表格错误顺序 |

上表存量超限函数仍是未关闭项，后续入口为 [复杂度治理计划](../../plan/2026-10-22-code-complexity.md)。同文件扫描到但未修改的旧分支（如 RuntimeSurface 的 run、图表点击和既有 Sim 场景）不作为本批新增问题，数值保留在完整结果中。

## 验收边界

上述页面数据均为显式标识的合成数据，浏览器实际调用本工作树的 DQE Sim。未连接真实 DQE / Relay，未验收指标表中国区实际口径及真实服务权限结果。两源权限上下文的保留及无关地区条件不重查已由本地执行测试覆盖。

未连接生产或执行生产发布。提交、push、精确 SHA 的远端 CI 和本任务工作树清理结果由交付回执分别记录。默认历史 HEAD 兼容矩阵不作为本批证据，仓外安装本批源码的真实包 smoke 已单独通过。

## CI 后续收口

首次远端全量测试发现两条旧数据网关断言仍要求异常标量/null 阻断查询，以及 page/internal 导出快照遗漏。已将隐私断言保留为结构错误案例，将 nullable=false 的查询标量改为成功缺失与脱值告警断言，并按实际导出重新生成公开面快照。针对完整 data-gateway 套件及公开 API 的 8 文件、75 项回归通过；测试函数 AST selfCC 最高 2 → 2，生产代码未变化。最终远端 CI 状态见交付回执。
