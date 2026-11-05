# pages/capabilities/navigation

页面由 JSON 自动发现。本文件仅记录使用说明，不参与渲染或注册。

## 业务路由按 URL 末段自动预览

来源：`/pages/playground-route-source`（[JSON](playground-route-source.json)）；目标：`/pages/playground-route-target?project-id=P001`（[JSON](playground-route-target.json)）。运行 `pnpm dev:playground`，无需 DQE 或其他服务。两个页面都是 Dashboard，使用合成项目编码，不代表真实业务数据。

1. 点击“打开本地目标页”：JSON 中 `/operation-map/playground-route-target` 自动匹配任意子目录内同名 JSON，进入 `/pages/playground-route-target`；正文显示 P001，URL 保留两项 region 和 `#summary`。点击“返回”回到来源页。
2. 点击“校验目标输入后打开”：目标公开参数声明由同一个文件索引加载，合法项目编码通过校验后跳转。
3. 在来源页复制链接或用新标签页打开，仍是同一个本地目标；“绝对业务地址预览”也打开本地目标并显示 P002。
4. 点击“查看未收录目标”：留在本地诊断页，展示原 Operation Map 地址、P003、两个 region 与锚点，不访问原业务服务。
5. 将来源 JSON 粘贴到 `/preview`，重复以上操作；编辑器里的 href 始终是业务地址。独立打开目标并刷新，仍显示 URL 中的项目编码。

路由最后一段必须与文件名和页面 id 完全一致，不按标题或相近名称猜测，尾斜杠可省略。重复页面文件名由现有索引拒绝。仅 `#锚点` 不做路由匹配。开启 `validateTargetInputs:true` 的缺目标链接沿用引擎的不可用提示，不跳过输入校验进入诊断页。

此场景只验收 Playground 的地址适配、参数传递和本地呈现。页面协议与引擎导航能力未变，本地创作 Skill 的 Schema、校验器与协议知识不受影响，不重新生成分发副本。真实 Operation Map 路由、权限和 DQE 查询另行联调。

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
