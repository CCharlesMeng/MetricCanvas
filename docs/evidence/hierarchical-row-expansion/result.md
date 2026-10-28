# 层级筛选联动父子表格正式验收

2026-10-27。P0–P5 已完成本地产品及 Sim 验收。页面协议6.70，local-authoring Skill1.4.0。实现保存在 `codex/hierarchical-row-expansion`，未推送或合入 main；不存在本批远端 CI 成功的声明。

## 实际版本与入口

- 工作树：`/Users/moon/.codex/worktrees/hierarchical-row-expansion/DataDashboard`。
- 基线及收口时远端 main：`219b5db9233d735c2234f83d4ce7c8062ac57605`；远端协议仍为6.69。
- 正式 Playground：[table-hierarchy-selection](http://127.0.0.1:5210/pages/table-hierarchy-selection)，由上述工作树提供，DQE Sim18229。源检出原有5173服务保持独立。
- [完整 Page 声明](../../../pages/capabilities/table/table-hierarchy-selection.json)、[唯一主方案](../../plan/2026-10-27-hierarchical-row-expansion.md)、[协议](../../page-metadata/components/table.md#hierarchy-selection)、[ADR-0123](../../adr/0123-explicit-hierarchy-selection-and-complete-child-export.md)。
- 已确认原型仅留在本地试验分支 `codex/prototype-hierarchy-selection`，提交 `65fb7ed3cdf3b5056836f1503dfe91bb59f18baa`。正式实现树不含原型HTML、内嵌ExcelJS或模拟定位字典。

## 功能与所有权

| 阶段 | 正式实现与验收 |
|---|---|
| P0 | Schema与三个6.70能力下限；完整合法Page、参数绑定分支、非法向量及独立校验器。selection只在显式单选两层结构树启用，父子层级须按声明顺序；全局导航绑定不扩大。 |
| P1 | 父级定位使用独立SourceProgram，候选合法性与归属分别验证。定位与子表源默认不成为执行根；定位只在子级选中时执行。真实HTTP Sim测试证明首屏父查询一次，层级变化不重查父汇总；取消及迟到回执不发布。 |
| P2 | 完整父结果私有投影在表内搜索/排序/分页前执行，parentField严格匹配，rowKey保持string/number身份；未修改共享raw、compute或结果绑定。子表source:selection明确区分选值与不适用，旧输入缺值仍失败。 |
| P3 | region身份变化恢复默认；共同条件保留展开/收起与合法会话，父页保持，第一笔新子查询前回第一页并恢复搜索/排序/每页条数。同选择不反复自动展开；重新定位改变归属时保留展开/收起意图；过期子响应不回流。权限修订销毁定位、展开和导出。 |
| P4 | 独立冻结任务完整读取所有匹配父子行，不依赖展开DOM或当前子窗口。两个工作表、独立父关联数据槽、可见列规则；并发4、合计10000行、准备60秒、统一取消与严格失败。适配器忽略取消时仍按任务超时结束；空子结果合法，不完整结果失败。 |
| P5 | 正式Dashboard、真实浏览器及实际下载文件；PAGE-METADATA、模块、ADR与主题索引；产品、MC及local-authoring同源生成与仓外安装；属性编辑使用正式Schema派生结构，公共API快照已更新。 |

默认 DQE 候选、代表处明细均不提供 parent。Sim 的归属数据只由显式查询响应提供；示例网关只为该合成场景注入层级候选的level与经过核验的名称搜索编码。正式运行时没有业务名称或页面id分支。

## 浏览器与实际文件

在 Codex 内置真实浏览器完成以下操作，服务通过实际DQE HTTP网关与Sim通信：

| 操作 | 实际观察 |
|---|---|
| 默认首屏 | 地区部4行、本地每页2行；没有展开或目标子请求。 |
| 选华东地区部 | 仅华东1200，默认收起；手动展开后代表处总数5。 |
| 选上海代表处 | 定位O101→R01，仅华东且自动展开；父整体1200，上海360。父行数字键1独立于地区部值R01。 |
| 上海选中改年度 | 仍展开；2025为父960、上海288；候选和定位回执不把父指标缩小为子指标。 |
| 手动收起后改共同条件 | 保持收起，不重新自动打开。 |
| 父表第2页展开欧洲，改年度 | 父表仍第2页，欧洲仍展开。子表第2页再改年度后回第1页，父页仍为2。 |
| 只展开华东，子表搜索上海，导出 | 屏幕子表1行；下载Excel仍包含从未展开的父行与代表处。 |
| 父级选中但从未展开，导出 | 无需先查询屏幕子表，完整文件仍包含全部5个代表处。 |
| 空归属、多归属、定位失败 | 分别显示无法定位、归属不唯一、定位失败；没有退回全部父行。 |
| URL初值选上海 | 候选确认和定位后，仅华东自动展开，没有先展示无约束子表。最终HTTP回执为父1、定位1、目标子查询1；父查询不带层级谓词，子查询同时带R01与O101。 |

下载的三份真实文件通过ZIP/XML回读（单元测试另用ExcelJS回读原始类型和单元格）：

| 文件 | 工作表 | 数据行数 | 父关联列 |
|---|---|---|---|
| `browser-all.xlsx` | 父表汇总 / 子表明细 | 4 / 17 | 地区部 |
| `browser-parent.xlsx` | 父表汇总 / 子表明细 | 1 / 5 | 地区部 |
| `browser-office.xlsx` | 父表汇总 / 子表明细 | 1 / 1 | 地区部；父1200、子360 |

原始截图、下载文件、HTTP摘要及JSON测量留在同目录本地，按仓库规则不将全部原始产物作为正式内容提交。代表截图为 `office-selection.png`、`parent-page-refresh.png`、`complete-export.png`、`ambiguous-parent.png`。

## 验证命令与结果

| 层级 | 命令/检查 | 结果 |
|---|---|---|
| 页面 | `pnpm validate pages` | 121/121通过。 |
| 当前广泛回归 | `pnpm test --exclude tests/authoring-export-isolation.test.ts` | 369文件，3333通过、5项原有跳过。 |
| 补充旧页兼容 | `pnpm test packages/engine/runtime/tests/hierarchy-selection.test.ts` | 13通过；包括旧6.44数字键+远程父分页、首屏仅父查询、展开仅目标子查询、离开父页释放。 |
| 正式能力与导出 | 层级Schema、runtime、hierarchy-export测试 | 定位异常/候选拒绝、取消/迟到、会话、归属改变意图、冻结/总预算/空结果/严格失败/超时均通过。 |
| Local-authoring | tools、row-expansion、skill、upgrade、page-reference及产品回归 | 相关10文件237通过；随后增加的边界与兼容用例单独通过，并纳入当前广泛回归（最后补的旧远程父表和候选门禁缓存用例另由最终41项定向测试覆盖）。 |
| 类型及Svelte | `pnpm check`，最后相关改动再执行engine check | 全工作区及最终engine均零错误、零警告。 |
| 构建 | `pnpm build:packages`、`pnpm build:playground` | 通过；正式包与静态Playground可构建。 |
| 产品分发 | `pnpm authoring:contracts` / `authoring:contracts:check` | 同源生成；1268 product、4 authoring、1 interface输出一致。 |
| MC | `pnpm mc:content:check` | 来源覆盖一致；32项Python检查通过；可观察派生场景及诊断夹具一致。 |
| 独立安装 | 完整697文件复制至仓库外、无软链；仅Node执行 | 新Page合法，6.69携带新能力拒绝；知识新主题可读。 |
| Git输入 | `git diff --check`，远端main/当前协议核对 | 通过；源检出混合工作区未改写、暂存或搬入。 |

维护链使用项目既有虚拟环境 `metriccanvas-authoring/tool/.venv/bin/python`（源检出路径），设置METRICCANVAS_PYTHON并将该bin置于PATH。默认Python缺fastmcp/jsonschema的问题已作为环境问题排除。

早期完整全量运行有3354项通过及两项配套失败：知识主题超出16KB、升级演示仍写旧版本。已按职责拆分搜索/导出原文和主题、更新升级演示，并在最终369文件回归中全部通过。那次完整运行中的export-isolation文件通过；最终未重复整份其他Skill/历史Bundle漂移场景，按仓库默认范围验收local-authoring，当前生成一致性、独立安装及MC链路均重新通过。不把早期全量失败描述成最终全量全绿。

## 仓外安装与复杂度

最终仓外副本：`/var/folders/_7/p5v7g8bs6kb8jy5sm02lbw4h0000gn/T/metriccanvas-hierarchy-final-9cqaz9rc/metriccanvas-local-authoring`。697文件、0软链、Skill1.4.0、Schema6.70；合法退出0，旧版本新字段退出1；`table.hierarchy-selection`输出12628字节。完整链接闭合与哈希检查由独立安装测试覆盖。

[复杂度完整实测](complexity.md)使用metriccanvas-ts-ast/1及TypeScript5.9.3；Svelte仅测script，模板由实际浏览器检查。新增函数/回调selfCC≤15，新增超限0。主要既有函数：rowExpansionErrors21→4、旧逐组件校验回调65→65、展开open7→6/retain9→12、表格reset6→8、orchestrate.start26→26、RuntimeSurface.run48→48。保留的相关存量超限及理由逐项写入复杂度报告，不以工厂低分替代内部回调。

## 验收边界与保留项

真实 DQE、真实office→region服务、Relay、生产权限、后端实时变更下的性能与服务级排序/总数一致性：**NOT_RUN**。接入时必须由数据服务提供并真实验真定位查询、独立父整体指标及目标代表处筛选；不得用候选parent、编码前缀或逐个父行试查代替。Sim不证明生产授权或后端事务快照。

本批未开放页面PDF/PNG或迁移旧业务页面；仅同步当前写出版本的升级演示与MC派生场景。普通Excel、recordList和旧query父子表继续走原分支。原始混合工作区及5173服务保留；本批实现工作树和原型试验分支均未合入main且仍有审阅/证据用途，保留而不清理。没有推送、PR或远端CI；Git main交付不属于已完成声明。
