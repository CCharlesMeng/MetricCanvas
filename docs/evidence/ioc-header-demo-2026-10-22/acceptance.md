# IOC Header 独立展示页

目标：仅展示本轮要求的页头选择、指标卡、带 Tab 的表格，以及左上指标按钮和右上类型下拉的趋势图。沿用用户提供的 AGENTS.md 新示例默认 Dashboard 约定；在当前提供5173服务的 `ioc-header-main-delivery/DataDashboard` 检出构造，原工作区并行修改未改动。

页面：`pages/ioc-header-demo.json`；入口 `/pages/ioc-header-demo`，可加 `?back=1` 提供返回目录箭头。使用现有组件和当前6.46协议，无新增或修改页面协议、运行时控件、组件视觉规则；本地创作Skill独立校验器消费现有契约，不需重生成协议知识。

演示路由使用公开 RuntimeSurface/RuntimeSection 组合接口，仅选择呈现 JSON 已声明的柱状图或折线图；两个图共享数据源，展示状态不影响筛选或表格Tab。该宿主控件不作为通用页面协议能力。页头和左上filterGroup仍由统一运行时执行筛选；示例网关只消费其生效查询，无生产访问或网络回退。

## 已执行

- 独立 local-authoring 校验：`node .agents/skills/metriccanvas-local-authoring/scripts/validate-page.mjs --expected-layout dashboard pages/ioc-header-demo.json` 通过；完整生成尝试已分别冻结到 `/tmp/ioc-header-demo-attempt-1/2/3`，第1次字段绑定缺少data、层级绑定误用levels，修为main数据槽及levelQueryFields后第2次通过，第3次调整默认年度并通过。失败字节未覆盖。
- `pnpm --filter playground check`：0错误、0警告。
- `pnpm test apps/playground/tests/page-catalog.test.ts`：9项通过。
- `pnpm build:playground`：生产构建通过。
- 实际5173浏览器：默认全球2026年签约额393,840、收入299,318、机会点8352、赢单率39.3%；选择重点国代与Q1后签约额39,960；选中国地区部变为8,520；客户分类选卓越NA+战略NA变为3,300，收入2,508。
- 左上切收入、右上切折线，明细Tab切代表处后仍保留全部页头条件；切近一年显示2025-10至2026-09，重点中国双分类的北京代表处签约额16,260。
- Region切代表处并搜索“上海”能选中上海；与重点国代交集显示“暂无数据”，取消重点后恢复该代表处，切月后双分类签约额1,270、收入965。
- 返回小箭头点击进入目录；无来源直接进入不提供返回上下文。

数据为合成事实。真实IOC/DQE/Relay、生产字典和权限未接入；没有提交或push。

## 视口与最终复核

- 390×844：页头自然换行，指标卡单列、图表左右控件换行；布局稳定后 `innerWidth=390`、文档 `scrollWidth=390`，没有全页横向溢出，表格沿既有内部滚动呈现。
- 已保存 [默认宽屏全页](overview.jpg)、[390px全页](narrow.jpg)。最终保留默认宽屏 `?back=1` 供用户打开。
- 最终 `git diff --check`、独立页面校验及第3次尝试快照哈希检查通过；Playground检查再次0错误0警告。当前改动仅为新示例及其宿主、合成网关、目录和说明，无既有产品协议或控件改动。

## 2026-10-22 区域选择修正（现行）

按用户反馈，移除Region前置“全球／地区部／代表处”层级按钮，保留一个树形单选下拉。复用既有普通树 `treeSelection:independent` + `selection.mode:single`，显式parentValue建树，全球／地区部／代表处均可直接选择，展开不提交。单一稳定区域码由演示网关映射到样例行域；不改变生产IOC区域谓词契约。

浏览器确认：选择中国地区部后年度签约额92,880；直接改选北京代表处后41,640，明细仅北京；选全球后恢复全量。已保存 [单下拉树形单选](region-tree-single.jpg)。独立校验第4次快照通过，Playground检查0错误0警告，目录9项测试通过，git diff --check通过。此前记录中的“切层级再选值”步骤为历史，当前直接在同一树内选节点。

## main交付复核

交付前fetch并将本批变更rebase到远端main `99440f01aeb2ba22e41d687e95bdf5b5d00d3828`，保留远端图表下拉与表格序号的既有提交。仅目录新增项和README尾部发生文本冲突，按双方新增内容合并。本批仍为10个文件，未改动既有产品协议或控件。

新基线上重跑Playground检查（0错误0警告）、目录9项测试、独立local-authoring页面校验和Playground生产构建，全部通过。远端提交和对应CI结论以交付回复为准。
