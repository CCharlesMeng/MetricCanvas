# pages/capabilities/navigation

页面由 JSON 自动发现。本文件仅记录使用说明，不参与渲染或注册。

## 多阶段明细点击跳转

来源：`/pages/table-multi-source-navigation`；目标：`/pages/table-multi-source-navigation-detail`（从来源进入会携带必需的 `project-name`、`rep-office-name`、`stage-name`）。启动：`pnpm dev:playground`，无需额外数据服务。

内联合成数据包含四条阶段明细，按两个商务编号关联基础信息和人数。点击合成项目乙三个阶段的人数 `12`，目标页应分别显示当前阶段，项目和代表处保持对应值；点击人数 `1` 应显示合成项目甲。基础信息记录顺序与主表不同，客户名称仍应正确关联。

主表重复商务编号不阻止当前实际行的动作。过期回调遇到歧义、行被移除或缺少有效行键时仍拒绝执行；动作条件与禁用行为由引擎及浏览器回归覆盖。此场景不证明真实 DQE、Operation Map 路由接管或部署已通过。

## 业务路由按 URL 末段自动预览

来源：`/pages/playground-route-source`（[JSON](playground-route-source.json)）；目标：`/pages/playground-route-target?project-id=P001`（[JSON](playground-route-target.json)）。运行 `pnpm dev:playground`，无需 DQE 或其他服务。两个页面都是 Dashboard，使用合成项目编码，不代表真实业务数据。

1. 点击“打开本地目标页”：JSON 中 `/operation-map/playground-route-target` 自动匹配任意子目录内同名 JSON，进入 `/pages/playground-route-target`；正文显示 P001，URL 保留两项 region 和 `#summary`。目标页初始化仍按声明清理未认领的 URL 参数；本例的多值 Region 已在目标页声明。点击“返回”回到来源页。
2. 点击“校验目标输入后打开”：目标公开参数声明由同一个文件索引加载，合法项目编码通过校验后跳转。
3. 在来源页复制链接或用新标签页打开，仍是同一个本地目标；“绝对业务地址预览”也打开本地目标并显示 P002。
4. 点击“查看未收录目标”：留在本地诊断页，展示原 Operation Map 地址、P003、两个 region 与锚点，不访问原业务服务。
5. 将来源 JSON 粘贴到 `/preview`，重复以上操作；编辑器里的 href 始终是业务地址。独立打开目标并刷新，仍显示 URL 中的项目编码。

路由最后一段必须与文件名和页面 id 完全一致，不按标题或相近名称猜测，尾斜杠可省略。重复页面文件名由现有索引拒绝。仅 `#锚点` 不做路由匹配。开启 `validateTargetInputs:true` 的缺目标链接沿用引擎的不可用提示，不跳过输入校验进入诊断页。

此场景只验收 Playground 的地址适配、参数传递和本地呈现。页面协议与引擎导航能力未变，本地创作 Skill 的 Schema、校验器与协议知识不受影响；新增演示通过官方生成器同步 MC 来源指纹及对应锁文件。真实 Operation Map 路由、权限和 DQE 查询另行联调。

## 内容导航与局部状态保留

入口：`/pages/ioc-content-navigation`；[页面 JSON](ioc-content-navigation.json)。

启动：`pnpm dev:playground`。

切换内容分区，再返回原分区，检查明细的局部状态仍然保留。

合成演示

可直接体验

1. 进入分区 A，操作明细表的分页。
2. 切到分区 B 再返回 A，查看原局部状态。

匿名合成行集用于演示内容导航；不作为 IOC 业务页面或真实数据验收。

关键声明：`sectionGroups`, `sectionAnchors`。

关联：[ioc-opportunity-analysis](../../business/dashboard/ioc/opportunity/ioc-opportunity-analysis.json)。

## 指定目标页签的跨页导航｜来源页

入口：`/pages/tab-url-source`；[页面 JSON](tab-url-source.json)。

启动：`pnpm dev:playground`。

通过固定值、页面参数或当前行字段生成链接，进入目标页指定的独立页签。

合成演示

可直接体验

1. 点击固定打开明细与已关闭工单，观察目标页两个 Tab 容器的选中项。
2. 返回后用页面参数或表格行入口再次跳转，对照目标 URL。

跨页参数只携带显式绑定内容；无效、空值或重复值按目标页默认规则回退。

关键声明：`params`, `sections[].components[].props.links`。

关联：[tab-url-initialization](tab-url-initialization.json)。

关联：[demo](../layout/demo.json)。

## URL 初始化独立 Tab 容器｜目标页

入口：`/pages/tab-url-initialization`；[页面 JSON](tab-url-initialization.json)。

启动：`pnpm dev:playground`。

从 URL 初始化两个独立 Tab 容器；手动切换互不影响，刷新后重新应用 URL 初值。

合成演示

可直接体验

1. 建议先从关联来源页进入，核对销售明细和已关闭工单分别选中。
2. 手动切换销售页签，检查工单页签不变、地址不变；刷新重新应用 URL。

URL 仅提供初始化输入；未声明参数不生效，无效或重复值回退默认页签。

关键声明：`sections[].components[].props.initialTabUrlParam`。

关联：[tab-url-source](tab-url-source.json)。

## Embed 自动读取 URL 参数

正式页面：[embed-url-params.json](embed-url-params.json)，入口 `/pages/embed-url-params?account-name=合成账号甲`。启动 `pnpm dev:playground`，正文应显示账号；缺失或重复单值账号时阻止呈现。此页面为纯内联参数演示，不访问真实账号或 DQE。

验证实际 embed：先 `pnpm --filter @metriccanvas/embed build`，再 `pnpm --filter @metriccanvas/embed preview:examples`，打开 `http://127.0.0.1:4175/examples/url-params.html?account-name=合成账号甲`；省略 initialSearch 的 ES mount 自动读取账号。改为 `#/detail?account-name=合成账号乙` 同样显示乙；外层与 hash 同键时 hash 优先。显式传 `initialSearch: ''` 阻止自动继承。地址变化本身不重查；调用完整 update 且省略 initialSearch 才重新读取当前 URL。

浏览器回归使用同一完整页面，覆盖 ES/global、显式覆盖/空串、更新、重复值校验；参数绑定查询另用既有 dimension-params-page 夹具验证有效条件及缺值不查数。真实 Operation Map 路由和账号权限另验。

## IOC 页头默认返回

入口：`/pages/ioc-default-back-source` → `/pages/ioc-default-back-target`，无需 URL 参数。

启动：`pnpm dev:playground`。两个页面均为静态合成演示，不访问 DQE。点击来源页的“打开默认返回页”，目标页声明 `props.back:true`，点击页头返回后回到来源地址；刷新目标页后仍可返回。来源页未声明 back，不显示按钮。在支持 Navigation API 的全新浏览上下文直接打开目标页，按钮隐藏。

Embed 原生 HTML 示例不提供返回适配器，用于验证运行时默认动作。Playground 保留已有应用级自定义返回，验证可选覆盖兼容。浏览器回归另验证只传 navigation.back、不传 returnContext 的覆盖，以及完整 update 移除回调后恢复默认行为。不承诺分页、排序、滚动或完整视图恢复。

## URL 参数清理与地址同步

完整页面：[url-input-cleanup.json](url-input-cleanup.json)。启动 `pnpm dev:playground`，打开 `/pages/url-input-cleanup?account=合成账号&active=true&view=detail&unused=删除#main`。

1. 正文显示“合成账号”和已应用筛选 `true`，初始选中“明细”。地址保留 `account`、`active`、`view` 和锚点，自动删除 `unused`，不刷新页面。
2. 切换“概况”，地址新增 `tab.views=overview`，不会重新带回 `unused`；刷新仍显示该页签和原账号。
3. 改用 `/pages/url-input-cleanup?account=合成账号&active=invalid&unused=删除`，应显示“页面输入不完整或无效”，保留完整地址以便诊断。
4. Playground 自己的 `state=ready` 等预览控制键会保留，不被当作页面未知输入清理。

实际 Embed 验证：构建后启动 `pnpm --filter @metriccanvas/embed preview:examples`，打开 `http://127.0.0.1:4175/pages/url-input-cleanup?account=合成账号&active=true&view=detail&unused=删除`。ES/global 回归直接读取同一 JSON；覆盖 hash 路由、重复键、宿主保留键、自定义回调优先、更新移除覆盖恢复默认、回写异常和历史状态。查询夹具另验证清理地址时只有一次初始 DQE 请求。

此页只有合成内联文字，无真实业务数据。Angular 接入示例见 `packages/embed/examples/angular-navigation.ts`，真实 Operation Map 的路由订阅、守卫、部署与权限仍需在其环境验收。


## 下钻详情页自动返回

<!-- example-guide: task=browser-back; page=ioc-auto-back-detail; components=page-header -->
<!-- example-guide: task=hidden-back; page=ioc-back-hidden; components=page-header -->

复用用途：IOC 页头统一按浏览器后退能力显示，旧 auto 与 true 等价。静态合成演示，不访问 DQE。启动 `pnpm dev:playground`。

可观察预期与环境：

1. 打开 `/pages/ioc-auto-back-source?region=north`，点击“下钻项目 1”，进入 `/pages/ioc-auto-back-detail?project=1`。详情页正式声明 `props.back:true`；浏览器可以后退时显示，点击后退一条记录。
2. 详情刷新、修改“仅有效”不会增加返回来源要求；同页手改查询参数后，返回遵循浏览器历史，不跳过这些记录。
3. 先访问 `/pages/ioc-auto-back-unrelated` 再进入详情，返回仍显示并退回上一页。新标签页没有可后退记录时隐藏；若已有浏览历史则按实际后退能力显示。
4. 点击“继续下钻”进入 `/pages/ioc-auto-back-subdetail`，原生后退先回详情再回清单。无需下钻来源存储；不支持 Navigation API 时使用 `history.length>1` 回退判断。
5. 访问 `/pages/ioc-back-hidden`，即使已有历史记录，`back:false` 仍隐藏。静态导出同样隐藏。旧 `auto` 的等价行为由历史契约夹具与浏览器测试动态挂载验证，新页面不再写 auto。

参考对象：首分区首个 `iocHeader` 的 `props.back`，保留现有标题、参数与筛选声明。

移植边界：用 `true` 启用；自定义集成返回通过 `navigation.back`，不需要 `returnContext.entryId`，旧 `returnContext.back` 不再作为页头动作。浏览器自身返回不保证恢复分页、排序、Tab 和滚动。真实门户的路由、导航守卫及权限另外验收。

## URL 缺参空态

入口 `/pages/missing-url-inputs`，[完整页面](missing-url-inputs.json)。新建页面显式使用 Dashboard；无需 URL 参数即可观察页头、统计期间、空表、缺值标题和无关静态内容。带 `?entity=合成对象` 后恢复相关查询，页头期间可切换年、季、月。使用 `pnpm dev:playground` 启动，真实结果需要 DQE 数据网关；页面内旧 initial 仅用于验证缺参时不复用，不代表真实业务数据。

清除 entity 或传空值后，不出现整页参数错误，不查询相关数据、不显示旧数据；月季年切换和候选、导出继续使用空结果。补齐 entity 并重新加载后，查询必须携带对象条件。浏览器合成响应仅验证渲染与请求映射，真实 DQE 的字段、口径与权限另验。
