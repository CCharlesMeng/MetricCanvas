# pages/capabilities/navigation

页面由 JSON 自动发现。本文件仅记录使用说明，不参与渲染或注册。

## 多阶段明细点击跳转

来源：`/pages/table-multi-source-navigation`；目标：`/pages/table-multi-source-navigation-detail`（从来源进入会携带必需的 `project-name`、`rep-office-name`、`stage-name`）。启动：`pnpm dev:playground`，无需额外数据服务。

内联合成数据包含四条阶段明细，按两个商务编号关联基础信息和人数。点击合成项目乙三个阶段的人数 `12`，目标页应分别显示当前阶段，项目和代表处保持对应值；点击人数 `1` 应显示合成项目甲。基础信息记录顺序与主表不同，客户名称仍应正确关联。

主表重复商务编号不阻止当前实际行的动作。过期回调遇到歧义、行被移除或缺少有效行键时仍拒绝执行；动作条件与禁用行为由引擎及浏览器回归覆盖。此场景不证明真实 DQE、Operation Map 路由接管或部署已通过。

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
