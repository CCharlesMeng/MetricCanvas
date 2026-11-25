# IOC Region 地图与列表联动

运行 `pnpm dev:playground`，打开 `/pages/ioc-region-map-demo`。独立宿主通过 `pnpm --filter @metriccanvas/embed build` 和 `pnpm --filter @metriccanvas/embed preview:examples` 启动，打开 `/examples/ioc-region-map.html`。两处使用同一页面文档、合成候选、合成查询与视口资料。

1. 初次进入显示全球地图和地区部列表。点欧洲散点，或在顶部 Region 选择欧洲地区部。页头显示欧洲地区部，世界底图聚焦欧洲，右表显示德国和法国代表处。
2. 点德国代表处散点。页头显示德国代表处，右表只显示德国。选择全球恢复世界底图默认视角和地区部列表。
3. 选择中国地区部看中国底图。选择拉美地区部看世界底图在缺少视口资料时的默认视角，右表仍按地区部取数。
4. Embed 宿主加 `?viewport=missing` 可比较欧洲缺少视口时的回退，加 `?entry=global` 使用 global 分发入口。

示例使用合成组织与指标数据，验收公开宿主输入、引擎渲染和同页筛选，不验证真实 Operation Map、DQE 或旧子地图资产。
