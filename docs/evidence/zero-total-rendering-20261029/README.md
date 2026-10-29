# 对象查询零总数兼容显示

用户确认：total count为0但有返回行时，支持渲染并给出合适告警。沿用既有“技术错误打印控制台、页面不显示技术错误”的约定，本次使用console.warn，未新增页面协议字段或升级Schema。

实现位于隔离工作树 `/Users/moon/.codex/worktrees/zero-total-rendering/DataDashboard`，基线9ee7e6ac6。主工作目录中的并行改动未复制、覆盖或混入生成物。未提交、push或合并main；工作树保留用于审阅和继续交付。

## 行为与边界

对象查询声明 `resultScope: "complete"`，普通显示读取遇到非空返回行、total_count=0：

- 保留收到的全部有效行、零值、负值、原始总数0；停止按矛盾总数继续读页，不以行数修造准确业务总数。
- checkOrdinaryRange输出一次TOTAL_COUNT_MISMATCH，包含pageId、dataSourceIds、dataSourcePath、引用组件与bindingPath、rowCount、totalCount、completeness=unverified。日志不带业务行、筛选值、凭据或查询体。
- 主槽或辅助槽均可显示，辅助列沿已有rowKey对齐。0行/总数0是正常空结果，不告警。
- 对象查询的矛盾结果不采集为可信initial；普通指标查询沿用已有显示与initial规则。
- 完整导出仍拒绝矛盾对象结果；结果绑定、跨源计算与组合源不将该显示回执认作完整输入。字段映射、结构、非法总数、请求上限、取消与授权规则保持；非零对象完整总数矛盾未放宽。

最小声明沿用普通页面数据源：`source:{type:"query",resultScope:"complete",query:{language:"dqe",body:{dsl_list:[{query_type:"object",object_type:"Demo/Zero Total/zero",output_fields:["地区部","得分"]}]}}}`，配套结果字段与组件声明见完整验收页面；没有增加onError或其他局部补丁字段。

## 场景、文档与Skill

| 项目 | 位置 |
|---|---|
| 完整Dashboard场景 | pages/capabilities/query/query-zero-total-demo.json |
| 本地浏览器入口 | http://127.0.0.1:5194/pages/query-zero-total-demo |
| 操作及数据性质 | pages/capabilities/query/README.md“零总数与已有行” |
| 产品语义 | PAGE-METADATA.md、docs/page-metadata/data-sources.md“有返回行但总数为零” |
| 生成同步 | pnpm authoring:contracts；MC、local-authoring、契约快照和分发锁均从隔离产品真源生成 |
| local-authoring | 隔离基线1.3.0修订为1.3.1；不覆盖主目录未交付的其他Skill修订 |

## 验证结果

- 修复前用户响应重放：声音主源10行成功，扣分、客户评价、收入、合作意愿各13行/总数0，均抛EXPORT_INCOMPLETE_DATA。
- 修复后同一批11项真实捕获响应重放：11项均ready，四个对象源各保留13行及原始totalCount=0，并输出组件/源定位告警。重放结果不等于重新连接真实DQE、Relay或线上部署。
- 浏览器：主源异常仍显示甲地区部0.0、乙地区部-2.0；辅助异常表两行按region对齐；第三表正常空态。干净页面无运行时错误，异常源产生预期warn。截图在 `.scratch/evidence-runtime-attachments-20261029/zero-total-rendering/final.png`。
- 数据执行回归：25文件206测试通过；record-join单独重跑20测试通过，合计26文件226测试。首轮压力用例有超时记录，重跑已通过；首轮发现普通指标initial兼容回归，已将不采集策略限定到对象查询，最终相关测试通过。
- local-authoring/page-reference相关：3文件73测试通过，含仓外复制、链接与生成一致性检查。
- MC：authoring:contracts:check、来源覆盖、32项Python测试、诊断页面/夹具漂移检查通过。初次新增语义主题引起诊断夹具漂移，已用官方mc:content:fixtures生成，不手改哈希/计数。
- 页面目录120页全部校验通过。根tests、data-execution、Playground类型/Svelte检查通过，Svelte诊断0错误0警告。
- 独立安装目录位于 `/tmp/partner-health-zero-total-work/installed-skill`，无软链接，独立Node校验新场景与用户partner-health页面均通过。
- 未执行真实服务重查、真实模型、线上保存/发布、CI或Git交付。生成使用已安装的Python依赖环境；最初系统Python缺fastmcp属于环境错误，未作为产品失败。

## 复杂度

口径：metriccanvas-ts-ast/1、TypeScript5.9.3，自身CC不包含嵌套函数；新增闭包逐个测量。Svelte仅抽取本次脚本比较，模板未修改。

| 函数 | 修改前 → 修改后 |
|---|---:|
| checkOrdinaryRange | 14 → 14 |
| fetchComplete | 13 → 13 |
| excessRows | 5 → 7 |
| incompleteObjectSource | 5 → 8 |
| finishQueryRead | 14 → 12 |
| captureConsistentInitial | 新增6 |
| completeDependency / canRenderZeroTotal | 各新增2 |
| pageExternalInputs | 11 → 12 |
| scenarioEnvironment | 8 → 9 |
| viewer.loadPage | 13 → 13 |
| 预览适配器全部函数/闭包 | 最高3 |
| 新增测试全部回调/辅助函数 | 最高2 |
| computedSnapshots.visit（存量） | 27 → 27 |

新增函数无超限。存量visit仍为27，本次只替换依赖校验入口并提取新策略，未重排递归和错误优先级，避免将计数兼容扩大为整个计算图重构；后续处理入口为该函数的依赖遍历与计算投影职责。本次未降低门禁或改变测量口径。

原始日志、捕获响应重放和AST结果位于 `/tmp/partner-health-zero-total-work/`；这些本地证据没有复制用户响应内的无关账号元数据到仓库。

## main交付复验（2026-10-29）

以上为原隔离基线的实现期记录；本节覆盖前文“未交付、工作树保留”的阶段状态。按用户授权，只将本次修复接入最新origin/main基线577255129；原工作区的并行改动及暂存区保持原样。冲突处理中保留main的层级表格、伙伴预览路由与rejectionPreviewRowCount，新增零总数路由独立接入，不回退其他能力。

local-authoring采用远端1.7.1为基线，修订到1.7.2，并从最新产品真源重新生成契约、MC与Skill产物及诊断夹具。未带入旧隔离基线的旧版本快照。

换基线后复验：pnpm test运行数据执行与本次回归、local-authoring/page-reference相关测试，共30文件308项通过；data-execution、Playground与根tests类型检查通过；MC完整检查及32项Python测试通过；浏览器再次验证主槽/辅助槽保留行及正常空结果。原始回执在/tmp/zero-total-delivery-*.txt，提交、远端SHA及CI最终结论以本次交付回复为准。

复杂度仍采用同一AST口径；远端新增路由后，pageExternalInputs为13→14，scenarioEnvironment为10→11，viewer.loadPage仍13→13。三个核心执行文件与原基线相同，其前后测量维持上表；存量visit=27保持不变，无本次新增超限函数。CI通过后按仓库标准归档本任务工作树与忽略的验收产物。
