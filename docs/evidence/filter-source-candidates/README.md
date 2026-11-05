# 数据源候选实施与验收

日期：2026-11-05。工作树基线：`09a7815c965bce921c2ef50202fa727ba9a8e705`。工作目录：`/Users/moon/.codex/worktrees/filter-source-candidates/DataDashboard`。实施阶段基线；主目录的并行变更未带入，交付整合见文末。

## 已实现

- `filters[].candidates` 引用 inline/query 页面数据源及已声明输出。按完整结果的稳定值去重，保持首次出现顺序；分页全部读齐，不使用 query.initial 的局部行代替完整结果。
- 显式父字段构成树，每个节点拥有自身值；父子独立单多选，不推导业务路径，不展开后代值。循环、缺失父、同值显示名/父关系冲突均拒绝。
- 图表卡多个下拉继续使用 filterGroup 和组合卡工具栏；筛选绑定决定查询范围。旧固定 options 的必选单选行为保留。
- 候选来源不能消费自身筛选。依赖其他筛选时显式声明 candidateContext；内部保留完整依赖状态，包括期间 selection、组织 level 与被覆盖前的值，查询执行层负责生效范围。
- 加载、空结果、失败重试、只读、URL、迟到回执与静态导出使用既有状态链。导出冻结标签和值。

## 正式声明与兼容

Schema 为 6.90，local-authoring 为 1.29.0。新增 Page Schema 路径共五个：`candidates` 对象及其 `dataSource/valueField/labelField/parentField` 四个叶字段；删除零个字段。已有 `filterGroup.props.options` 改为条件必填：固定选项保留；数据源候选下拉省略，并引用具有 candidates 的筛选声明。不增加去重、分页、自动展开等页面开关。

页面完整声明：[filter-source-candidates.json](../../../pages/capabilities/filters/filter-source-candidates.json)。协议：[filters.md](../../page-metadata/filters.md#source-candidates)、[filterGroup.md](../../page-metadata/components/filterGroup.md)。计划：[实施计划](../../plan/2026-11-05-filter-source-candidates.md)。

## 页面与浏览器

日常入口：`http://127.0.0.1:5193/pages/filter-source-candidates`。启动其他端口时使用对应 `/pages/filter-source-candidates`。页面目录 README 提供完整操作。

人工浏览器验证：跨 3 页的 5 行渠道去重为直营/伙伴/线上；选 north 仅筛选北区自身，选 shanghai 后才加入上海；刷新重复 URL 键恢复两个节点；失败和空结果保持独立状态。不完整后续页不会展示已取得的部分选项。

![父子独立选择](tree.png)

![390px 窄屏](narrow.png)

![不完整结果失败](incomplete.png)

最终分发浏览器以独立端口 5293 的当前 dist 为准：source-candidates、distribution、webpack-consumer 共 11 项通过。覆盖 1440/390、分页去重、父子独立选择、失败/空/不完整、只读、复制完整目录的原生 ES/global 与 Webpack development/production。默认 4175 曾被并行任务复用并中途关闭，相关失败不用于当前分发结论。

## 工程验证

运行环境：Node 24.11.1、pnpm 11.13.0；Python 环境的 FastMCP 3.4.7、httpx 0.28.1、jsonschema 4.26.0、Pydantic 2.13.5、typing-extensions 4.16.0 与仓库直接依赖锁一致；复杂度使用 Radon 6.0.1。

- 产品协议、数据执行、运行时和运行时 UI：277 文件、2,314 项测试全部通过。
- 数据源依赖状态针对性回归：4 文件、52 项通过，包含期间查询策略、组织层级和布尔覆盖状态保留。
- authoring 数据扫描/裁剪识别候选字段及其数据源；先前 79 项定向回归通过。
- page/data-execution、根 tests、Embed 和 Playground 类型检查通过；Svelte 检查为 0 errors / 0 warnings。
- 五个基础包构建通过；Embed build/check:dist 通过。16 个 JS，最大 929,901 字节。Python tarfile 生成的纯文件归档已回读检查，无 macOS AppleDouble 附加项。见 [归档回执](embed-archive.json)。
- `mc:content:check` 最终整链通过（含 52 项 MC 测试及诊断夹具）；authoring:contracts 从真源生成 1,478 product、5 authoring、1 interface 文件；生成一致性、MC 来源覆盖、52 项 MC 测试和可观察诊断夹具分别检查。MC 诊断中的内容摘要通过生成器更新，未手改 hash。
- local-authoring 整目录复制至仓外，无仓库依赖地运行版本、合法页面和非法数据源引用检查，退出码分别为 0/0/1。见 [独立安装回执](standalone-skill.json)。旧页面继续开发回归 120 项通过。
- `skills:check` 首轮 authoring 回归为 224 通过、14 失败：旧页面示例仍写 6.85 的一项已修复并以 120 项升级回归全部通过关闭；其余 13 项为导出子进程触及 90 秒限时。控制 esbuild 并发并完全串行后，1 项单测及剩余 12 项全部在原限时内通过，未修改功能代码或提高限时。连同首轮的 18 项，31 项导出隔离场景均有通过证据。这里是分阶段复验结果，不将首轮命令退出 1 描述为单轮全绿。日志：[单项](skill-isolation-single.log)、[12 项串行](skill-isolation-serial.log)。

## 复杂度

工具：`metriccanvas-ts-ast/1`、TypeScript 5.9.3；Python Radon 6.0.1。TS/JS 逐函数 selfCC，Svelte 仅脚本，不宣称模板分支覆盖。编码前 HEAD 审计与编码后审计同口径；完整相关文件函数清单见 [complexity.json](complexity.json)。

| 函数 | 前 | 后 |
| --- | ---: | ---: |
| createCandidateValidator/verify/verifyFilter | 15 | 11 |
| filterGroupErrors 中逐控件回调 | 11 | 13 |
| fetchComplete | 13 | 14 |
| buildFilterTree | 10 | 11 |
| RuntimeSurface/loadDimensionCandidates | 13 | 14 |
| needsCandidateReceipt | 新增 | 6 |
| projectSourceCandidates | 新增 | 10 |

本次新增函数最高 selfCC 为 13，复杂度门禁无新增/增长超限。维护范围函数加权均值：TS/JS 约 2.224，Python 约 4.217，均严格小于 5。全仓仍有历史存量超限：TS/JS 114、Python 63；本次未扩大或掩盖，台账保持原状。

## 证据边界

功能声明、静态校验、合成网关、浏览器、仓外安装和分发闭合分别验证。查询候选的测试网关为本地合成数据，不证明真实 DQE、Relay、组织权限服务、生产部署或远端 CI。实施阶段未运行远端 CI；交付结果以最终提交和对应 CI 为准。

## 交付整合（2026-11-05）

整合已发布 main `44adb1df22bfdcf9eb4630cecf74820669ac3318`，保留季度查询、同比及金额格式能力。本功能顺延至 Schema 6.89，独立 Skill 顺延至 1.28.0；旧版本拒绝用例同步到 6.88。所有派生契约均从整合后的产品真源重生。上文的实施阶段测试数据对应原始基线与 6.86/1.25.0；此节记录最终版本复验。

整合后：基础包构建、Embed 构建/分发门禁、11 项浏览器用例、166 项 local-authoring/旧页升级/参考文档回归、全部包类型检查及复杂度门禁通过。复杂度仍为逐函数 selfCC，新增能力回调仅调整能力版本，无运行分支增长。生成器导出 1,490 product、5 authoring、1 interface 文件。

已知 main 基线问题：`tests/partner-health-http.test.ts` 和 `tests/partner-health-scope.test.ts` 仍引用已被 `799a297ad` 移走的 `pages/temporary/partner-health.json`，根 `pnpm check` 因这两处 TS2307 失败。尝试改成新路径还暴露旧 HTTP 断言与新业务页面不兼容，已撤回临时改动；本次提交不含这两个测试的修改。全部包 `pnpm -r check` 单独验证，此历史失败不描述为新功能通过证据。

最终整合 main `2d422286f` 的图表系列显隐及测试夹具修复，本功能正式版本为 6.90 / 1.29.0；上节所述合作伙伴测试旧路径已由该 main 基线修复。6.89 阶段核心与创作扫描回归 279 文件、2,347 项通过，MC 整链通过。最终基线只变动并行图表能力及本功能版本声明，补验合并接缝与生成一致性。

最终基线复验：`pnpm check` 全链通过；10 文件/92 项候选与并行图表接缝、合作伙伴测试通过；167 项独立 Skill/旧页升级/参考文档回归通过；13 项候选/系列显隐/分发与 Webpack 浏览器回归通过；基础包与 Embed 构建、体积及复杂度门禁通过。原实现阶段 31 项隔离场景通过证据继续保留，未重新执行完整耗时隔离矩阵。Relay 消费基线仍固定 6.89；本次未采集新正式消费基线，远端发行兼容检查结果另行报告，未绕过迁移判定。
