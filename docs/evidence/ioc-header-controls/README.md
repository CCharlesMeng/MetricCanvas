# IOC Header 子控件与 RegionFilter

状态：实现与本地必要验收完成。范围仅限页头组合和稳定 Operation Map 接入；交付目标为 main，真实 Operation Map 与 DQE 未验收。

## 已确认声明

首 section 首组件仍为 iocHeader，使用 props.components 顺序排列 filterControl 与 regionFilter。filterControl 引用原 filters 声明；regionFilter 内部提供公共筛选 region，组织树固定为 geo / region-dept / office，候选路由固定为 geo-pc-code / region-dept-code / rep-office-code。不再在页面复制完整 Region 定义。应用级安装一次 Operation Map Adapter；候选与选择仍进入原统一筛选状态。

```json
{"id":"header","type":"iocHeader","layout":{"span":12},"props":{"identity":{"title":"伙伴健康度"},"components":[{"id":"year-control","type":"filterControl","props":{"filterId":"stat-year"}},{"id":"region-control","type":"regionFilter"}]}}
```

## 保持的行为

不默认增加 Region；原 filterIds 页头继续读取，新旧排列声明不能同时出现。时间筛选、业务查询 filterBindings.region、查询参与范围、URL 与现有宿主初始化/回写保持。不新增实时同步机制，不强制选择全球，不改变组织中文 value 的现行约定。候选能力缺失、拒绝或无效时沿用原门禁。

## 实现与必要验收

- Schema 6.89：新增两个仅限页头的子控件分支及 components 顺序声明；复用现有筛选状态，不增加页面查询选项。
- 在产品归一化入口展开隐式 Region；解析、导航输入、Node 执行及导出使用同一声明。保留简写源文档，不原地修改输入。
- 应用级 Region Gateway Adapter：集中路由标准 Region 请求、规范全球节点、透传取消与已有失败状态，其他候选和查询继续委托原网关。
- 必要测试：新旧声明/冲突/版本/输入不变；候选路由与取消/失败；中文查询字段与作用范围保持；页面浏览器选择/清空与 URL。
- 更新 Playground、协议文档并从产品真源生成 local-authoring；只执行受影响测试与独立安装校验，不跑全仓、真实模型或生产服务验收。
- 编码前后按 metriccanvas-ts-ast/1 测修改及新增函数，新增 selfCC≤15；生成物不手写哈希。

## 本地验收

- 工作树：`ioc-region-filter-component/DataDashboard`，起点 `44adb1df2`；保留主工作区的并行修改。
- Schema 6.89：净增页头 `components` 与 filterControl/regionFilter 两个闭合子分支；不增加查询字段或同步开关。伙伴健康度删除一份完整 Region 声明，年份及全部原查询定义、绑定和正文保持。
- `pnpm test packages/page/tests/ioc-header-controls.test.ts packages/page/tests/ioc-header.test.ts packages/data-execution/tests/operation-map-region.test.ts packages/page/tests/version.test.ts`：45/45。
- Page / data-execution / embed / Playground 定向类型检查通过，Playground 与 embed 均零 Svelte 错误或警告。
- `pnpm authoring:contracts` 与 `authoring:contracts:check`：通过。生成同源契约、示例、8 个新增反例及 local-authoring 1.28.0；不手改派生摘要。系统 Python 缺 fastmcp，改用仓库现有锁定解释器后通过。
- local-authoring 仓外两个定向测试：知识链接/版本/哈希闭合、打包校验器与全部产品契约向量一致，2/2；不运行其他 Skill 或真实模型专项。
- `pnpm skills:repair:check`：定向工具类型检查及入口/独立分发回归 16/16 通过。
- `pnpm mc:content:coverage`：通过，MC 来源覆盖同步；未扩大为全套 MC 行为测试。
- embed build 含 check:dist：3/3，16 个 JS，最大 `excel~exceljs.min` 929901 字节，公共入口及包内引用闭合。
- 浏览器 `/pages/ioc-header-controls`：初始只有年份和一个空 Region；搜索上海并选上海代表处，表格回显及 URL `rep-office` 正确；清空移除组织值且保留 `region.level=office` 和年份，不默认选全球。
- 浏览器 `/examples/ioc-header-controls.html` 与 `?entry=global`：真实构建公共 API 均成功挂载；global 候选树、代表处选择及查询回显通过。
- 以上数据均为明确的本地合成输入，不证明真实 Operation Map、权限名单、DQE、Relay、远端 CI 或部署。

## 复杂度与未关闭项

口径 `metriccanvas-ts-ast/1`、TypeScript 5.9.3，逐函数 selfCC，闭包单独计数；Svelte 仅测真实 script，不宣称覆盖模板。新增产品函数最大 9：`expandIocHeaderRegion` 8、`iocHeaderControlErrors` 9、Adapter 的 `fetchFilterCandidates` 5。页头读取 `iocHeaderDeclaration` 1→2；预览 `tablePreview` 10→11，独立路由 `queryTableGateway` 11→12；新增辅助函数与测试回调均≤15。存量 `parsePage` 23→23，仅接入同一归一化边界，避免扩大为既有校验流水线重构；该存量债务保留。原始前后测量与浏览器截图在 `artifacts/ioc-region-filter/`。

交付使用独立工作树，不回填主工作区的并行修改；活动预览仍使用该工作树，暂予保留。真实服务接线需集成应用将已有组织桥接安装进 `withOperationMapRegion`，这是应用级动作，不写入每份页面 JSON。

## main 交付复核（2026-11-05）

远端 main 已推进至 `9b00a3875beb75e52ed81381f18c4711803562e3`，新增系列条件显隐和数据源候选。将本批源修改重放在此基线，保留两边入口及能力；原定 6.89 已被并行功能占用，本次正式版本调整为 **Schema 6.91 / local-authoring 1.30.0**。上方 6.89/1.28 为原实现基线的验收记录，不作为最终发布版本。

- 重定位后定向产品回归：原四文件加 `packages/page/tests/source-candidates.test.ts`，56/56 通过。
- 重跑 page / data-execution / Playground 定向类型检查：通过，Svelte 零错误和警告。
- 重新生成产品契约（1516 product / 5 authoring / 1 interface）并运行一致性检查：通过。
- 重跑 local-authoring 仓外知识链接/哈希闭合与全契约向量一致性两个测试：2/2 通过。
- 当前基线 embed 重建含分发门禁：3/3，16 个 JS，最大 929901 字节。
- 同口径重新测量：`parsePage` 23→23，`iocHeaderDeclaration` 1→2，`tablePreview` 11→12，`queryTableGateway` 13→14。新增产品函数最大9；保留既有 parsePage 复杂度债务，不扩展重构。
- 沿用本会话已授权的 `[skip ci]`，推送后只核对远端 SHA，不能将跳过 CI 视为通过；真实服务与部署不在本次验收范围。

- 交付基线浏览器复核：重定位期间 Vite 缓存过渡入口，重启本任务 5213 服务后，年份、完整 Region 候选树和不限范围结果正常；无产品代码额外修改。
