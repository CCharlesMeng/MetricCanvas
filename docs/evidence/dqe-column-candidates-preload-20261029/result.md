# 表头候选懒加载、空闲预加载与主查询优先

2026-10-29。接续同一独立工作树的完整查询与前端去重实现，尚未提交、推送或合入main。数据范围与DQE业务参数保持此前约定。

## 行为与组织

1. 表格主数据先加载和呈现。候选快照独立于主数据快照，候选等待和错误不进入整表loading门禁。
2. 原表格根节点以IntersectionObserver确认可见，经过两次requestAnimationFrame，再由requestIdleCallback空闲预加载；没有该API时延后50ms。未显示、未激活、隐藏或销毁的表格不预加载。没有增加表格布局容器，保留固定高度、滚动和固定列的DOM结构；静态导出不触发。
3. 可见表格逐列预加载select候选。后台请求串行且让位于所有交互查询；点击菜单复用当前作用域已完成的候选页或在途请求，未预热时按需获取，仅菜单等待。显式另一列菜单请求可抢占后台预加载。
4. 主查询可取消在途候选或其他后台读取，并立即释放执行位置；不等忽略AbortSignal的迟到结果。缓存命中的主查询直接返回。后台优先级不进入查询身份或DQE参数；原有结果去重和条件语义不变。
5. 完整结果每批500行，批次间让出事件循环。上下文改变使候选失效，离开视口取消后台工作，重新可见可继续预热；错误不自动无限重试，打开菜单或重试按钮恢复。候选搜索和更多页未命中页缓存时仍可能重新完整读取，网络成本没有消失。

核心模块：widgets/src/shared/visible-after-paint.ts仅发布可见与绘制后事件；runtime/src/table/candidate-preload.ts管理空闲生命周期；column-candidates.ts管理候选状态；data-execution/query-runner.ts管理优先级、抢占、资源与缓存；source-program/candidate-priority.ts向普通、完整及组合读取传递后台优先级。

## 可观察场景与证据

入口：`http://127.0.0.1:5183/pages/table-column-candidates-query`。页面JSON：`pages/capabilities/table/table-column-candidates-query.json`；合成数据及受阻传输：`apps/playground/fixtures/full-query-candidates.ts`。运行`pnpm dev:playground`，与此前同一页面，页面声明没有变化。

`?state=blocked-candidates`使候选始终不返回：首屏仍显示20行，空闲后才发起候选；点击下一页显示第21行，后台候选被取消。打开另一列菜单也抢占旧预加载，表格继续显示20行。合成请求事件仅验时序和取消，不是实际服务HTTP证据。截图nonblocking-preload.png已人工查看。

| 验收 | 结果 |
|---|---|
| 查询、运行时、候选、可见性回归 | 99文件、666项通过，包含无视取消的迟到响应和并发为1时抢占 |
| 实际Chrome浏览器 | 4项通过：首屏/翻页不受挂起候选阻塞、另一列菜单抢占、跨批与联动、截断失败 |
| 本地创作检查 | 5文件、194项通过；生成器算法未改，本轮未重复上一阶段已通过的完整导出隔离回归 |
| MC内容检查 | 33项通过；契约生成一致性、覆盖、诊断和可见夹具一致性通过 |
| local-authoring | 1.11.3，官方导出生成协议知识；仓外完整复制、零外部链接、新页面校验通过，见standalone-skill.json |
| 类型与构建 | data-execution、engine、Playground及根tests类型检查通过；svelte-check为0错误0警告；data-execution与engine包构建通过 |
| 真实服务 / 远端 | 真实DQE、Relay、真实模型、CI与生产部署未执行 |

页面说明、PAGE-METADATA.md、docs/page-metadata/components/table.md、docs/host-contract.md及DQE对接说明已同步。Skill无新增页面字段，维护内容说明渲染期调度与证据边界。基线缺少skills:check组合脚本及repair既有导出问题沿用上一阶段记录，未混入本批修复。

## 复杂度与未关闭项

使用仓内metriccanvas-ts-ast/1、TypeScript5.9.3逐函数selfCC，嵌套回调单独测量。测量原始数据见complexity.json。Svelte的新增部分为已有Table属性透传及一个可见性门控布尔表达式；未将Svelte模板当TypeScript函数进行虚假测量。新增DOM事件处理均在独立TS模块测量。

| 函数 | 前 | 后 |
|---|---:|---:|
| createQueryRunner/pump | 6 | 8 |
| createQueryRunner/run（请求排队内部函数） | 11 | 13 |
| createColumnCandidatesSession/start | 5 | 5 |
| createColumnCandidatesSession/sync | 4 | 4 |
| createTableController/candidateSession | 2 | 2 |
| fullQueryColumnCandidates（批次让出事件循环） | 7 | 9 |
| 新可见性、空闲预加载与优先级辅助函数 | 新增 | 最高7 |
| createColumnCandidatesReader返回的编排函数 | 44 | 44 |

新增函数均≤15。存量44的编排函数本轮只传递执行优先级，未增加分支；它混合普通、完整与组合候选语义，全面拆分会扩大本次调度修复的行为风险，保留为未关闭项。后续处理入口为packages/data-execution/src/source-program/column-candidates.ts，见complexity-exceptions.json。另有未触及的gatewayNormalizationError=16沿用上阶段记录。
