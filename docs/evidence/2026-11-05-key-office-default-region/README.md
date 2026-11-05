# 重点国代默认覆盖 Region

用户确认：重点国代勾选后默认覆盖 Region，不再依赖每页填写 `overridesFilters:["region"]`。

## 协议与实现

最小筛选声明为 `{"id":"key-office","type":"boolean","label":"仅看重点国代"}`。既有 `key-national-only` 同样采用默认行为；显示文案不参与判定。Schema 字段净增减为 0，保留通用显式覆盖协议及其 6.84 能力下限，默认规则由引擎承担。标准重点国代的显式覆盖目标与默认 Region 取并集。

`packages/page/src/filter-overrides.ts` 统一计算覆盖目标，供查询编排、筛选状态、候选验证与候选缓存、初始快照、完整导出和集成应用名单桥接复用。只在 boolean true 时忽略已声明的 Region 维度；false/缺席恢复 Region；无 Region 不增加覆盖目标。查询固定条件、页面参数、权限、月份、客户级别及表头筛选仍生效。缺少替代绑定时报配置错误；授权名单完整且为空时得到空结果，拒绝/取消/未配置不能当作空名单或全量查询。

7 个业务页和两组来源/目标演示页采用相同默认行为。正式 IOC Header 业务示例也将旧的 `key` 标识统一为 `key-office`，查询绑定与页头引用同步迁移。删除 9 处冗余覆盖声明，旧重点国代联动两页同时移除 Region 对重点国代的候选依赖及必须先选 Region 的启用条件。勾选期间 Region 的完整候选和最新选择保留；取消后恢复最新选择。旧输入若仍把 Region 候选依赖到重点国代，会在原筛选声明处报冲突，需删除该依赖，不能继续清除普通代表处选择。普通 boolean 的候选依赖、条件启用和显式覆盖能力继续可用。

## 场景与知识映射

- `pages/capabilities/filters/key-office-priority-demo.json` / `key-office-priority-target.json`：中文组织、跨地区重点范围、改选与清空、导航/刷新、完整 XLSX、空名单与无权限。
- `pages/capabilities/filters/key-office-filter-demo.json` / `key-office-filter-target.json`：A1/B1 跨地区重点范围、保留普通代表处 A2、恢复最新 Region；宽/窄屏及 XLSX。
- 文档真源：`PAGE-METADATA.md`、`docs/page-metadata/filters.md`、`docs/page-metadata/components/iocHeader.md`。
- `metriccanvas-local-authoring` 版本 1.25.0；产品契约、独立校验器、知识与 MC 内容均从独立工作树的产品真源导出，未复制其他任务的未提交变更。

页面试验场启动：`pnpm --filter playground dev --host 127.0.0.1 --port 5296 --strictPort`。打开 `/pages/key-office-priority-demo?rep-office=南京代表处`；勾选后看到上海/深圳，Region 仍为南京；改选华东时仍为上海/深圳，取消后为上海/南京。空名单入口 `?state=empty&key-office=true`，无权限入口 `?state=denied&key-office=true`。

## 验收

产品全范围 226 个文件、2051 条单元/集成测试通过；正式 IOC Header 示例迁移后定向 39 条通过。Embed 全量 Chrome 273 条通过，覆盖两组来源/目标、全球节点、复制目录 ES/global 和 Webpack development/production。实际页面试验场 Chrome 5 条通过（可重跑 `pnpm --filter playground exec playwright test --config playwright.key-office.config.ts --workers=2`），覆盖查询/导出、勾选期间改选、跨页/刷新、空名单和无权限。候选 Adapter、组织与数据均为合成输入，不是生产 DQE、真实授权名单或 Operation Map 部署验收。

产品类型检查、Embed svelte-check/测试类型检查通过。`authoring:contracts:check`、MC 源覆盖及 52 条 MC 测试通过，诊断夹具重新生成后检查通过。最终 local-authoring 五个定向测试文件共 206 条通过，其中仓外复制/完整向量和页面参考检查 43 条通过；两个来源/目标示例及正式 IOC Header 示例通过生成的独立校验器。Embed 构建及 check:dist 通过：16 个 JS，最大 `chunks/excel~exceljs.min-CSE3Njtv.js` 为 929901 字节，低于 1000000 字节上限。实际 `/tmp/key-office-default-embed-dist.tgz` 归档重新解读确认同样 16 个 JS 及逐文件体积上限。

## 复杂度

同一工具 `metriccanvas-ts-ast/1`、TypeScript 5.9.3，函数自身 CC 独立计数，闭包/回调单列；Svelte 模板不在本次源码修改范围。编码前基线及编码后完整函数记录保存在本地验证回执，关键结果见下表。

| 函数 | 修改前 | 修改后 |
|---|---:|---:|
| filterOverrideTargets | 新增 | 6 |
| filterOverrideTargets 内候选判断回调 | 新增 | 2 |
| overriddenFilterIds | 7 | 6 |
| filterOverrideErrors | 5 | 6 |
| overrideReferenceErrors 的 error 回调 | 1 | 2 |
| overrideReferenceErrors | 7 | 7 |
| validateOverrideBindings | 7 | 7 |
| keyOfficeFilters | 4 | 4 |
| bindKeyOfficeQueries | 6 | 7 |
| bindKeyOfficeQuery | 2 | 2 |
| createKeyOfficeGateway.fetchFilterCandidates | 1 | 3 |
| createKeyOfficeGateway.fetchData 内谓词回调 | 5 | 6 |

所有本次修改/新增函数及辅助函数 CC≤15；全仓 `complexity:check` 通过。未改函数的存量超限仍在原台账：同文件 `parseCalendarValue` 22→22，`ioc-project-overview.test.ts` 两个未改测试回调 22→22、17→17；本次不更改或重建台账。

交付按用户要求快速提交并合入 main，复用上述验收，不追加扩展测试；主工作区的其他未提交内容保持原样。真实服务与部署未验收。

完整 `skills:check` 的扩展隔离套件未通过：两个冷导出子进程返回 `status:null`（测试设置了 90 秒子进程上限），后续因超出本轮 local-authoring 默认验收范围而主动终止，其 Worker 退出错误不计为产品行为失败，也不将整条命令记为绿色。已单独重跑并通过本轮五个 local-authoring 测试文件（206 条）。
