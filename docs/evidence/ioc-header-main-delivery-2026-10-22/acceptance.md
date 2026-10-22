# IOC 页头主线契约迁移验收

日期：2026-10-22。交付检出 `/Users/moon/.codex/worktrees/ioc-header-main-delivery/DataDashboard`，基线 `f9a5e77ce5ee7f2b01cda6b21868ba5a3e66576a`（主线6.45），恢复来源快照 `86334b05d2f0b1c2499d8043cfd6cb77aab053bd`（本批6.33）。用户明确选择“以主线契约为准，迁移本批已确认行为后再 push”。隔离迁移，没有覆盖原混合工作区或直接合入旧归档快照。

## 交付范围

| 已确认行为 | 主线实现与可观察入口 |
|---|---|
| `<`、标题、灰色标签、全部筛选横排自然换行 | 唯一 IocHeader 的普通 inline/normal/none；`ioc-header-standard/dense/detail`，1440/1024/390宽度 |
| 地区部/代表处单选、稳定码、选择替换并关闭 | 显式 selection.mode=single；新增四份区域页及主线地区部/代表处示例同步，展开仍不提交 |
| 模型只随日期范围变化、重试和迟到隔离 | `candidateContext.filterIds:[range]`，`ioc-header-models`；区域/重点/客户分类不进入候选约束 |
| 业务字典、协同小组、激励预拉 | 主线 FilterCandidatesGateway；显式无依赖 candidateContext 空数组；完整合成权限对象加工，不完整归一 unconfigured |
| RMB五档/USD四档、草稿取消、严格双边、换币原子清金额 | 一个 numberRange、units.cases内各币种presets、metricByFilter，与主线 RangePicker/协调器共用 |
| 固定12个月和离散YYYYMM多选 | 显式2026-10锚点生成，multiple+required保持非空，不填中间月，拒绝最后一项清空 |
| 缺配置局部门禁、统一只读 | `ioc-header-unconfigured` 保留无关 inline；filterEditing 统一只读 |
| Platform通用端口 | 可选 filterCandidates合入dataGateway，复用displayInputs；合并平台会话取消信号，身份变化拒绝迟到结果 |

协议版本6.46仅承载必选多选、显式无依赖V2候选及units.cases内封闭预设三个增量；主线原有能力、字段、版本门禁保留。未恢复旧 inputResources、multiple、presetGroups、RuntimeInputs 或 embed.updateInputs 协议。每筛选只读演示迁移到主线全局filterEditing；没有私有逐项readOnly字段。目录保留主线原15场景集合；新增批量验收组及 `/ioc-header-review`，合成代码位于 Playground fixtures。

## 验证

所有浏览器自动验收直接消费正式 pages JSON。七主题可单独从 `/pages/<id>` 打开，不依赖业务服务；正常、慢请求、首次失败重试、空、拒绝、未配置、不完整及只读通过统一入口切换。

- `pnpm validate`：75/75合法。
- `pnpm --filter playground test:ioc`：9项Chrome通过，覆盖七页渲染、宽窄换行、地区部/代表处单选、日期保持/重试、慢请求迟到隔离、独立候选、策略月份不重取、币种新旧档位/确认/取消/相等边界/切换后恢复查询、月份增删和局部门禁。
- `pnpm --filter @metriccanvas/embed exec playwright test ioc-header.spec.ts ioc-header-business.spec.ts`：11项通过，既有结构树、候选交集、折叠/窄屏、返回、只读、两实例和导出门禁回归。
- UI浏览器：Chrome35项通过；本机没有Microsoft Edge，Edge项目因缺少可执行程序未运行，交由CI安装浏览器后验证。
- `pnpm check`：通过，Svelte检查均0错误0警告。
- `pnpm build`、`pnpm build:playground`：通过，含Svelte生产SSR生成。
- `pnpm authoring:contracts`：从当前真源重新生成1006 product、4 authoring、1 interface文件；未复制旧版生成物。
- `pnpm test --exclude tests/authoring-export-isolation.test.ts`：305文件、2628项通过、5项跳过；额外两项证明普通可选空单选仍能复用初始行，显式无依赖候选缺配置仍不能绕过门禁。
- `pnpm authoring:check`：4文件72项通过（含23项独立导出隔离）；最终重新生成后，local-authoring工具、仓外安装、引用和本批页面4文件62项再次通过。另有Platform候选组合/会话端口6项通过。
- `pnpm authoring:contracts:check`：1006/4/1文件一致；最终远端SHA与CI在本次交付回复报告。

元数据同步：`PAGE-METADATA.md`、`PAGE-PARAMETERS.md`、`docs/page-metadata/{page,filters,README,reference-map}.md/json`及示例路由；本地创作Skill从上述真源生成协议知识、完整页面、独立校验器与摘要。新增版本和非法输入已登记契约向量，包括旧版本拒绝、空必选、币种case预设缺失/公共预设混用/非法边界。

## 边界

仅完成组件与合成业务场景迁移。产业/行业/档位仍为demo字典；完整真实组织payload、IOC/DQE/Relay、逐源查询和导出、真实货币单位与数据未验收。激励仍固定日历月预拉；生产月份清空10/12个月差异未裁决。区域父节点生产谓词、重点国代特殊规则、私有周与其它C组保持暂缓。这里的合成响应不证明真实业务已接通。

命令原始输出见 [logs](logs/)，宽窄页头截图见 [1440px](batch-1440.png) / [390px](batch-390.png)。5173已从恢复来源切换到本交付检出，当前页面已实际打开确认；保留该检出供用户继续预览。
