# IOC公共页头 B0+B1 实施结果

2026-10-19。唯一主计划为 `docs/plan/2026-10-16-ioc-header-feature-plan.md`，按已批准§17实施。Schema6.32，基线952b3a273f0f4f8be5820f5af1bb76c2f5afa513。本批没有提交、暂存或推送。

## 交付范围

- B0：筛选共用协调、整组合法性/只读校验、递归清理和显式确认；相关数据源、下游与导出门禁；候选控件/层级/完整依赖隔离，代次拒绝旧成功及旧失败，当前依赖重试。writeMany和restore同时改祖先时，也不得由其他候选快照复活旧子孙回执。
- B1：根iocHeader声明与独立resolved呈现Interface，身份TextValue、缺值省略、事实项、唯一筛选归属、自然回流、按实际首行折叠、隐藏inert、合法来源返回。静态Adapter保留身份、全部声明筛选及已应用范围/搜索值。旧页面保留原行为。
- 年季月保留月份锚点，近一年保持之前12个完整月；详情仍为独立单月，筛选不回改参数；离散月份保持集合。四个pages直接消费新协议。
- 文档、字段映射、能力版本、契约向量、生成Bundle、受控set_ioc_header编辑和本地authoring Skill已同步；创建/编辑/重开及整体失败回滚验证通过。

B2–B6继续保留规划，88项编号及落点没有删减。本批未交付动态候选窗口、USD、完整viewstate、共享Condition或HeaderFactReference，不默认启用可选页头操作，不迁移既有业务页。返回验证限于合法returnContext与back意图。

## 交互预览

预览进程在隔离工作树中运行：`MC_EMBED_EXAMPLE_PORT=4196 node packages/embed/tests/serve.mjs`。本地合成HTTP服务回显实际声明产生的条件，响应标识1不是业务指标。

- [普通看板](http://127.0.0.1:4196/pages/ioc-header-overview-demo)
- [密集筛选看板](http://127.0.0.1:4196/pages/ioc-header-dense-filter-demo)
- [详情单月报表](http://127.0.0.1:4196/pages/ioc-header-detail-demo)
- [无标题离散月份](http://127.0.0.1:4196/pages/ioc-header-month-set-demo)

## 本地验证

| 验证 | 结果 | 原始证据 |
| --- | --- | --- |
| 全量Vitest | 257文件、2235通过、5跳过 | evidence/vitest-final.log |
| 修复后候选整组时序 | 3文件15通过；先复现RED，再GREEN；另覆盖restore | evidence/candidate-context-red.log、candidate-context-green.log |
| pnpm check | 全工作区0错误0警告 | evidence/check-final.log |
| pnpm build | 通过；保留构建器体积提示 | evidence/build-final.log |
| pnpm validate pages | 33页面通过 | evidence/pages-final.log |
| Python完整测试 | 542项执行成功，其中1项跳过；仅无模型脚本流程 | evidence/python-full.log |
| Python规则复验 | 158通过 | evidence/python-rules-final.log |
| 固定radon6.0.1 | CC最高15，零超限 | evidence/complexity-final.log |
| authoring生成物/Bundle | 765产品、4创作、1接口契约当前；2760摘要核对 | evidence/authoring-current.log、bundle-current.log |
| 本地Skill/导出隔离 | 46测试通过；仓外无软链Skill四页校验通过 | evidence/authoring-isolation.log |
| 静态呈现 | 身份、八筛选、10～20与搜索已应用值；无返回/折叠 | evidence/static-final.log、static-header.html、static-applied.html |

完整测试随后补充的restore回执断言以候选15项定向回归为最终证据；其他代码未继续改动。未提前采集完整编辑起点，不声称历史质量无回归。

## 浏览器与安装消费者

Chrome：源码15项通过，独立安装包10项通过。包括年份/季度/月锚点、详情单月、离散集合、无关查询不刷新、候选503及重试、门禁/导出、只读、来源返回、双实例销毁，以及1440/1024/390布局。390密集展开、候选层不越界及收起关闭已开弹层均有实际断言和截图。

六个包打成tarball并装入仓库外全新消费者，使用已安装产品协议和Embed；四页Node ESM解析及浏览器均通过。静态还原契约五项GREEN只证明主计划文字尺寸/内容/溢出规则，不代表与未知原系统截图像素等价。

浏览器及安装日志：`evidence/browser-final.log`、`evidence/installed-final.log`。本地独立Skill安装副本不含仓库软链；没有调用DS真实模型。

## 验证边界与工作区保护

真实DQE、CloudIOC、Relay、DS模型、门户/权限接线、CI及部署均未执行。本地合成HTTP契约、组件测试和安装消费者不替代这些验收。

实施仅在 `/Users/moon/.codex/worktrees/ioc-header-b0-b1/DataDashboard`。原工作区HEAD仍为952b3a273f0f4f8be5820f5af1bb76c2f5afa513，并行ADR/文档/原型及内部材料未写入或清理。worktree复制的 `packages/ui/prototypes/ioc-header/`、`docs/plan/2026-10-19-ioc-header-handoff.md`仅作上下文，不属于本批产品改动；未来交付范围以 `evidence/code-manifest.json`为依据，不应批量暂存工作树。

最终独立检视和证据投影见[acceptance.md](acceptance.md)。两个质量阻断已通过修复与独立复判关闭；未采用对应工程范式的C1/C4只保留规范性检视限制，不冒充已判定。
