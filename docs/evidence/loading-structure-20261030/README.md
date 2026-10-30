# 加载时保留真实组件结构

原始截图与测量JSON按仓库约定仅保留在本地，本文中的文件名为采集记录，不随Git提交。

本地验证日期：2026-10-30。当前检出 `main`，基准 `d24a41721`，工作区包含其他任务的未提交修改；本批未提交、未推送。

## 行为与对应入口

- 页面：`pages/capabilities/layout/loading-structure-demo.json`，入口 `http://localhost:5173/pages/loading-structure-demo`，Dashboard，DQE Sim 合成字段 `chart_demo_*`。
- 运行时：屏幕专用 `displayDataSnapshot` 提供空行并保留字段契约；原始快照与导出专用 `renderableDataSnapshot` 的 loading 语义保持。组件任一槽加载时清空本组件各槽的显示行，避免混用条件。
- 呈现：WidgetHost 始终挂载真实内容，不再渲染骨架块或临时标题。普通表、可展开父表、子表及详情视图在加载期间保留基础结构；表体显示加载提示。表格刷新时保留分页框架，未知总数显示缺省文案，分页暂时不可操作。
- 文档：`PAGE-METADATA.md`、`docs/page-metadata/data-sources.md`、`docs/page-metadata/reference-map.json`、页面目录 README。无新增页面字段，无 Schema 升级。
- Skill：local-authoring 1.10.2，由同源文档导出；MC 内容同步。为保护并行工作，在 `/tmp/mc-loading-structure/authoring-checkout` 先生成当前工作区基线，再生成本次文档变更，只回填两次生成之间的34个文件差异。

## 直接行为验证

`pnpm --filter playground exec playwright test loading-structure.browser.ts` 通过。测试读取上述页面，以可控合成 HTTP 回执暂停查询，验证首次取数、筛选重查、查询翻页、展开子表、首次激活收入 Tab 和切回已访问 Tab。等待期间断言真实指标卡、图表、父表与子表表头存在，并保存 ElementHandle 确认响应后仍连接原节点；分页刷新同样保持框架节点。1440px 截图为 `initial-loading.png`，390px 截图为 `ready-narrow.png`，窄屏无页面横向溢出。

回退 WidgetHost 至基准实现时，同一测试因加载期间找不到真实 `.metric-card` 而失败；恢复后通过。旧实现的失败证据在本地 `/tmp/mc-loading-structure/red.log`。

`pnpm --filter @metriccanvas/engine check`：0错误、0警告。浏览器测试 TypeScript 检查通过。`pnpm exec tsx packages/page/src/validate-cli.ts pages/capabilities/layout`：16页全部通过。

`pnpm exec vitest run packages/engine/runtime-ui/tests packages/engine/runtime/tests`：102个文件、585项通过，覆盖原始执行状态、取消/过期响应、导出与数据槽错误策略。`pnpm exec vitest run packages/engine/widgets/tests/table-view-state.test.ts`：3项通过。

## 复杂度

口径：仓内 `metriccanvas-ts-ast/1`、TypeScript 5.9.3；Svelte 只提取实例 `<script lang="ts">` 测量，模板分支另行核对，未将模板冒充 TS 函数。完整原始结果见同目录 JSON。

| 本次相关函数 | 修改前 selfCC | 修改后 selfCC |
| --- | ---: | ---: |
| RuntimeSurface.componentData | 12 | 11 |
| DetailContent.data | 7 | 6 |
| ComponentRenderer 数据槽 map 回调 | 2 | 2 |
| renderableDataSnapshot（保留执行/导出边界） | 5 | 5 |
| displayDataSnapshot | 新增 | 2 |
| Table 分页呈现缓存 effect | 新增 | 2 |
| Table 其他函数最大值 | 9 | 9 |
| 新浏览器测试及所有嵌套回调最大值 | 新增 | 3 |
| 新快照测试回调 | 新增 | 1 |

WidgetHost 无新增脚本函数；展开父表删除原有2分支的缓存 effect，其他回调不变。ScopedTableContent 脚本回调不变。模板移除整块替换和加载专用工具栏，保留原组件分发；Table 的空行/总数仅切换文案，分页加载期间使用 inert，不新增页面布局分支。

本批修改与新增函数均 ≤15，无未关闭的本次超限。扫描发现 RuntimeSurface 未修改的存量超限：run 48、529行 effect 20、refreshPeriodFacts 17、openDetailFor 18、handleChartClick 24；均不在本批重构范围，未宣称全文件复杂度清零。

## 证据边界

以上为本地源码、确定性测试和 Chromium 合成 HTTP 响应证据；不代表真实 DQE、Relay、CI 或部署验证。Skill 检查及 MC 完整检查结果在下方补记。


## 分发复核与并行工作区边界

冻结副本的 `export-authoring-contracts.ts --check` 通过（1295 product／4 authoring／1 interface）；`mc-content-fixtures.py --check` 通过。新增语义主题使诊断页主题数203→204，按生成器同步该页面及三个诊断回执，再刷新内容包来源摘要。独立 local-authoring 与页面参考测试在冻结副本全部42项通过，包含仓外复制安装、知识摘要、示例及校验器执行；repair/归档常规检查16项通过。MC Python 内容测试33项通过。

共享工作区在执行过程中又出现并行图表变更（barChart、lineChart、field-bindings-and-formats 文档及 chart-number-format 页面，修改时间晚于冻结副本）。因此共享工作区全量 `mc:content:check` 和参考逐字一致检查未通过：具体为图表默认数字格式变更尚未与对应分发参考一致；同批 local-authoring 行为41项通过。没有覆盖这些并行真源或把这些全量检查标记为通过；长时间的混合快照 `skills:check` 已中止，不把中止算作成功。产品加载修复、冻结副本文档/Skill 和共享目录全量一致性分别报告。

浏览器最终复测日志：`/tmp/mc-loading-structure/browser-final.log`。未执行真实服务、CI、提交或 push。


## 5173 入口复核与模拟接口补齐

用户报告“页面不存在:loading-structure-demo”后在其当前 IAB 标签页复现。`lsof -a -p 80016 -d cwd` 确认5173原为 `partner-health-zero-total` 工作树；先前的自动浏览器测试实际在5183当前工作区运行，不能证明5173入口可用。停止该旧Vite进程，将5173切换到当前工作区，启动独立DQE Sim（18228），保留5183既有服务。

真实Sim随后暴露原演示查询分页不受旧chart-local-filter模拟接口支持。新增限定 `schema_id: MC_LOADING_STRUCTURE_DEMO` 的专用模拟处理器，提供区域筛选、父行筛选、有界分页及既有排序规则；原图表模拟签名和限制保持。本次仅调整开发用模拟场景，不新增页面协议或作者配置能力，无需新增Skill知识规则。独立处理器的所有查询来自演示页面完整JSON。

测试先红后绿：`tools/dqe-sim/tests/loading-structure.test.ts` 修复前 entries 返回 DQE_SIM_UNSUPPORTED_QUERY；修复后与原chart-local-filter、row-expansion回归共9项通过；Sim类型检查通过。页面布局目录16页校验通过；原可控加载浏览器测试通过。用户实际5173浏览器中确认订单数据、下一页类别3/4、展开类别3子表返回30、收入Tab返回100/200/300/400。

复杂度口径仍为 metriccanvas-ts-ast/1、TypeScript5.9.3。executeLocalDemo 3→3（仅扩展处理器列表）；新增 executeLoadingStructure 15、filteredRows 12、record 3、rejected 1，所有生成/投影/筛选回调1；新增测试回调4/1，均≤15。未修改execute.ts其他存量函数，原有超限不扩为本次重构范围。完整测量位于 `entry-fix-complexity-before.json`、`entry-fix-complexity-after.json`。未新增权限、真实DQE或部署结论。


## 临时三秒加载测试

按用户要求，为当前DQE Sim进程设置 `DQE_LOADING_DEMO_DELAY_MS=3000`。`server.ts` 仅对包含 `schema_id: MC_LOADING_STRUCTURE_DEMO` 的查询批次异步等待，默认未设置环境变量时不等待；其他场景与健康检查保持原速度。该开关是开发调试用途，不改变页面协议或Skill创作语义。去掉该环境变量并重启Sim即可恢复。

实测演示HTTP请求耗时3.002265秒，健康检查0.001021秒。用户当前5173标签页中，翻到未请求页显示“正在加载…”，首次切换到海外时指标显示“—”，图表保留标题和容器、表头仍在；3秒后返回数据。运行时缓存命中的条件不发请求，重新刷新页面可重测首屏与首次切换。加载截图：`loading-3s-test.png`。

Sim类型检查通过。复杂度使用相同 metriccanvas-ts-ast/1 / TypeScript5.9.3：route selfCC 11→14；新增some谓词回调selfCC2；复用既有delay，无新增超限函数。原始测量为 `delay-complexity-before.json`、`delay-complexity-after.json`。


## 局部加载小转圈

按用户反馈补充16px局部加载指示：指标和图表右上角显示共享小圆圈，表格及展开子表在“正在加载…”旁显示。加载结束后移除，布局外框、标题、表头及工具栏持续挂载；不生成遮罩。动画仅用CSS，遵循prefers-reduced-motion。现有3秒演示延迟继续保留。

改动属于加载态的呈现样式，无新增页面协议、查询行为或作者配置，不改变Skill创作知识。LoadingSpinner仅在engine内部复用，不增加公共导出。未新增或修改脚本函数，无函数CC前后变化；新增模板仅按既有loading状态与内部showLoadingIndicator开关显示圆圈，CSS处理旋转及减少动态效果偏好，无复杂度未关闭项。

`pnpm --filter @metriccanvas/engine check`：0错误、0警告；原loading-structure浏览器测试通过（保持原节点、筛选、翻页、展开子表、Tab及390px无横向溢出）。实际5173收入Tab首次激活时，图表标题、表头均可见，出现两个“正在加载”可访问状态；截图为 `loading-spinner.png`。


## 加载圈位置修正

按用户指出的实际位置问题，将WidgetHost小圆圈从右上角固定8px改为内容框内50%/50%居中，并以translate(-50%,-50%)消除自身尺寸偏移。表格继续在表体加载提示旁显示圆圈。仅修改CSS定位与对应样式类名，无新增/修改脚本函数，复杂度无变化；不改变页面协议或Skill知识。已有loading-structure浏览器回归通过。实际5173收入Tab切到CN时确认图表中央出现圆圈，标题与表头仍可见，截图为 `loading-spinner-centered.png`。


## 全部组件统一总览

用户反馈组件不齐、加载不一致后，新增 `/loading-components-review`，同时渲染两份通过独立 local-authoring 校验的6.74文档：Dashboard `loading-structure-demo.json` 覆盖18种类型，Report `loading-ai-summary-demo.json` 覆盖AI总结。与 `componentCatalog` 真源逐项对账，19种类型全部存在，另含IOC页头。保留原 `/pages/loading-structure-demo` 入口。

所有数据组件绑定显式命名的Sim查询；新增合成数据文件 `tools/dqe-sim/fixtures/loading-structure-gallery.json`。模拟器环境变量仍仅延迟本场景3秒。静态组件不显示假的加载状态，缓存命中也直接展示；“重新播放全部加载”通过重建本页两个运行时重新请求。AI使用现有云宝助手本地Mock，在相关查询完成后生成；无真实模型或服务调用。AI展示使用共享圆圈并保留正文框架。

筛选轮次使用filterGroup本地枚举；展开明细保留自己的父行筛选，子类目声明封闭合成枚举，避免私有表格作用域依赖外部候选服务。Report另有一个指标卡实际消费AI所依赖的数据源，AI位于Report页头后首个正文位置。

本次检查：两份页面独立校验通过；Sim/相关AI回归6文件35项通过；Playground Svelte与测试类型检查0错误0警告；Playwright两项通过，检查14个gallery数据组件实例和原订单3实例均有圆圈、AI圆圈、重播、原节点持续连接、分页/子表/Tab与390px无页面横向溢出。宽屏和窄屏图保存为 `all-components-loading-wide.png`、`all-components-ready-wide.png`、`all-components-ready-narrow.png`。用户实际5173入口另用IAB复核并截图 `all-components-loading.png`。

复杂度：同一 `metriccanvas-ts-ast/1`、TypeScript5.9.3口径，`executeLoadingStructure`15→8、`filteredRows`12→9；新增 `queryFixture`1、`dimensionInput`9、`queryWindow`8，全部回调≤2。AI `summaryBody`5→5（含4个非default case），仅改变loading正文。新浏览器回执辅助函数6，原浏览器测试回调1→1、新总览测试回调5，Sim新增测试回调最高4。总览脚本无函数，模板重播回调1；Svelte模板和纯CSS另行核对，不计入TS脚本测量。所有本次修改/新增函数自身CC≤15，无本次未关闭项。详细测量位于本地 `/tmp/mc-loading-gallery/complexity-final.json`。

本次只扩展示例和加载呈现，无新增页面协议；不重生成其他并行工作的协议及Skill产物。两份JSON通过当前local-authoring独立校验；未执行真实服务、CI、提交或push。


## main 交付复测（独立检出）

交付基线 `4308f6862ed5b521923c54690d2b0146a81d06ad`，检出位置 `/Users/moon/.codex/worktrees/loading-structure-delivery/DataDashboard`。仅迁入加载功能、模拟器、总览示例、测试和语义文档；原主工作区及其他任务未提交修改保持。最新 main 的列候选与数据诊断信息一并保留，两处表格重叠按各自职责合并。IOC `region` 已是保留输入，本场景为普通合成枚举，改用 `demo-region`，数据维度不变。

交付基线实测：运行时/界面、表格及Sim相关111文件630项通过；独立5190端口两项浏览器回归通过；148页元数据全部通过；Playground、Engine、Sim及测试类型检查通过。依赖由 `pnpm install --frozen-lockfile --offline` 安装，锁文件不改。浏览器截图使用当前检出重新生成，HTTP回执仍是可控本地合成。

local-authoring版本1.14.3→1.14.4；从当前main真源重新导出1317 product／4 authoring／1 interface文件，同步MC知识和诊断夹具，不复制混合工作区的旧版分发物。首次MC检查因诊断主题数215→216后的来源摘要需要刷新，按生成器完成再生成并重查。当前main没有 `skills:check` 命令，使用已有 local-authoring 测试入口和MC完整检查；导出隔离全链路另由本次提交CI核对。早期并行启动的冻结旧快照authoring全链路已中止，不记作通过。

复杂度沿用metriccanvas-ts-ast/1、TypeScript5.9.3，在交付基线重新测量全部相关Svelte实例脚本、快照投影、Sim分发和server：`componentData`12→11、详情`data`7→6、`renderableDataSnapshot`5→5、新增`displayDataSnapshot`2、`executeLocalDemo`3→3、`route`11→14。新增Sim辅助最高9、浏览器辅助最高6；AI `summaryBody`5→5。模板新增诊断快照的缺省表达式与转圈分支单独核对，不冒充脚本测量。原未改函数的超限不在本批处理，相关清单见前文；本次无新增超限。原始报告：delivery-complexity-before.json / delivery-complexity-after.json。

稳定生成后，local-authoring与页面参考5文件197项通过；MC完整检查结果见本次交付说明，未运行真实DQE/Relay/模型。

首次交付CI的完整测试为411文件3734项通过、1项页面id中立性失败；原因是总览路由直接导入示例JSON。示例引用移入 `apps/playground/fixtures/loading-review-documents.ts`，路由只使用该fixture模块，保留原总览及重播行为；不放宽中立性检查。该修复没有新增函数或分支，TS函数复杂度不变。随后定向复测中立性、浏览器和类型，再推送补交并按新SHA等待CI。
