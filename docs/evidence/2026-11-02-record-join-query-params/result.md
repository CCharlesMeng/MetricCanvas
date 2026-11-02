# 审批人下钻查询参数修复验收

最新验收见 [DQE Sim HTTP 链路](http/result.md)。以下保留第一阶段内存网关的原始记录；该页面专用网关现已删除，当前页面通过标准 execute HTTP 请求，旧记录中的0次HTTP不能作为当前链路证据。

日期：2026-11-02。基线：`2133241a6b4f259fc19ff54bfdd9a0dcb9c96e06`。在独立工作树实施，未合入主工作区、未提交或推送、未部署内网。

## 根因与最终改动

上一版把审批人改成动态维度筛选器。`visible:false` 不停止候选值加载；运行时按 `dimension:approver-name` 发起独立维度查询，候选未就绪又阻塞关联源。只验证请求编码和标题解析漏掉了完整运行时门禁。

最终不创建审批人筛选器。业务页 `approver-name` 从 `params.display` 移至 `params.query.dimensions`，仅主表声明 `paramBindings`，目标为“审批人姓名”；原 URL、标题的 param 引用、区域和期间筛选、补列、关联键、排序及分页保持。可选审批人缺值时不注入条件，整个动态标题属性按既有规则省略。

产品仅调整 `packages/page/src/validate-paged-join.ts` 的查询参数消费校验：`source.records` 存在时各成员按自己的查询定义消费参数，包括 paramBindings 和原位引用；非记录模式保留全员消费同组参数的约束。查询执行、候选加载、关联与筛选豁免算法未改。无新增 JSON 字段，无 Schema 升版；旧引擎仍会拒绝新的成员参数范围，必须更新包含本修复的页面协议校验器/运行时。

补列参数只限制补列查询，不改变主表行域；无匹配时补列为空。权限、参数声明和类型、固定条件冲突、业务筛选消费规则以及取数预算保持。

## 场景与证据

| 范围 | 结果 |
| --- | --- |
| 结构与协议 | 修改前新合法用例因全员参数要求失败；修改后合法、非记录模式约束、未声明参数、业务筛选约束、原位引用共6项通过 |
| 完整运行时 | 新增6项通过：主表人名条件、补列键、重复商务记录、缺匹配、翻页、换人/无参数、补列独立参数、空结果、传输失败及显式记录查询分页；候选值接口调用0次 |
| 原业务页合成回放 | `business-page-runtime.json`：ready、1条记录、主表与补列各1次查询、候选0次、无数据整理告警，动态标题和审批时间条件保留 |
| 浏览器 | `browser.json` 的7个场景全部通过；主表人名切换、无参数、补列独立参数、重复URL键、无匹配及上游失败。主表首屏和下一页均验证；截图 `main-a.png` |
| 既有回归 | 组合源/参数9文件66项通过，记录关联/预算/超时5文件47项通过；本轮新增显式查询分页测试另通过 |
| 页面目录 | `pnpm validate`：153页通过、0失败 |
| 类型与构建 | page类型检查、engine测试类型检查、Playground检查（0错误0警告）、tools和tests类型检查通过；page及engine包构建通过 |
| 生成与MC | `authoring:contracts` 已生成；最终生成一致性检查通过。MC覆盖检查、33项Python测试和诊断夹具检查通过；示例注册后再次检查生成一致性，夹具已重生成 |
| 独立安装 | Skill复制到仓外，独立校验器版本6.77；业务页及安装目录内完整示例均通过，按需知识含新成员参数规则 |
| 核心Skill完整回归 | `pnpm skills:check` 全部通过：repair/release 2文件16项，authoring 6文件228项（包含完整导出隔离回归，1070.68秒） |

浏览器入口：[合成审批人甲](http://127.0.0.1:5187/pages/record-join-query-params?approver-name=合成审批人甲)。确认5187监听进程来自此工作树，启动命令为 `pnpm --filter playground dev --host 127.0.0.1 --port 5187 --strictPort`。

浏览器命令：`node apps/playground/tests/record-join-query-params-browser.mjs docs/evidence/2026-11-02-record-join-query-params`。页面日常预览和测试共用 `pages/capabilities/table/record-join-query-params.json` 及合成网关，不访问真实DQE。网关候选接口若被调用会抛错；单元运行时另用spy明确断言候选调用次数。

主协议文档为 `docs/page-metadata/data-sources.md` 和 `params-and-text-values.md`，同步 `PAGE-METADATA.md`、`PAGE-PARAMETERS.md`、页面说明与导出例子索引。Skill版本1.14.13（主工作区并行1.14.12不覆盖），知识、脚本、契约向量及MC产物由独立工作树产品真源生成。

生成器使用已安装依赖的 `METRICCANVAS_PYTHON`；MC组合检查同时把该虚拟环境的bin放入PATH，避免系统Python缺少fastmcp/jsonschema。首次诊断夹具哈希漂移已由 `mc:content:fixtures` 重生成。

补齐独立安装的完整示例后，最终 `authoring:contracts:check` 和独立安装再次通过；全部 authoringTopics 的按需读取输出均在16384字节预算内，本次 records 主题15693字节，引用闭合无 unresolvedRefs。业务JSON已在最初交付路径替换为查询参数版；与工作树文件SHA256一致：`aded23ddb1ef19549c9dbd65ee47f2d8d2cddf511f739ea4a5eba5028b01f52c`。

## 复杂度

实测工具 `metriccanvas-ts-ast/1`，TypeScript 5.9.3，口径为各函数selfCC，排除后代函数体、逐个测量回调。完整结果见 `complexity.json`。

| 修改函数 | 前 | 后 |
| --- | ---: | ---: |
| memberErrors | 14 | 15 |
| pageExternalInputs | 8 | 8 |
| tablePreview | 5 | 6 |
| queryTableGateway | 5 | 7 |
| buildProductOutputs | 15 | 15 |

新增合成网关及所有辅助函数最大8，协议测试回调最大1，运行时测试函数/回调最大4，浏览器回调最大3。Svelte仅提取实际script测量本次修改函数，未声称覆盖模板复杂度。扫描发现未修改的 `buildSkillProjections` 为52，属于存量问题，不纳入本批重构；本次修改函数与新增函数无超15未关闭项。

## 验收边界

本地静态、运行时、合成网关和真实浏览器证据不等同于真实DQE验收。未执行内网DQE/Relay、真实业务数据、CI或部署；不声称内网已修复。需先部署本修复的运行时/页面协议校验器，再替换业务JSON，复验主表请求条件、补列返回和页面显示。

工作树保留，原因是本轮改动尚待交付，且主工作区有其他任务未提交改动。
