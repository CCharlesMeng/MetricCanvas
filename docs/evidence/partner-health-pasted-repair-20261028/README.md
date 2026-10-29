# 伙伴健康度附件替换与预览修复

2026-10-28，按用户要求将两段粘贴内容直接拼接为完整JSON，替换 `pages/temporary/partner-health.json`。保留附件Schema6.58、全部查询、queryField、筛选与列绑定；当前文件与拼接输入语义及格式一致，没有修改业务查询。修改前工作副本保留在 `/tmp/partner-health-repair-20261028/workspace-before.json`。

## 错误台账

| 现象 / 路径 | 根因层 | 修复或结论 | 回归证据 | 剩余缺口 |
|---|---|---|---|---|
| `/pages/partner-health` 主查询可出数，整表暂无数据 | Playground模拟适配器 | object查询没有output_metrics，原适配器读取length抛TypeError；按固定object_type/输出字段分别模拟；保留原始DQE字段名 | 新增测试先复现失败再通过；浏览器地区部4行、代表处8行 | 仅证明本地模拟；真实失败查询尚未确认 |
| 代表处声音查询不被模拟器识别 | Playground组织字典 | 增加附件使用的“代表处”别名，与object输出同键 | 两类查询按同一个region对齐 | 真实名称/唯一性待响应验证 |
| 任一辅助查询失败导致整表为空 | 已有统一运行时规则 | `hostRenderSnapshot`任一槽报错后，`ComponentRenderer`清空全部槽；本批保留现有策略 | 现有widget-host-state测试 | 真正业务环境需定位具体失败槽 |
| “伙伴健康度得分”全为“—” | 页面数据绑定 | 两表总分均来自空inline的pending.total-score；未擅自改变业务口径 | 浏览器核对；页面校验通过 | 需要接通总分查询或确认计算规则 |
| 客户评价响应columns:null是否影响显示 | 数据网关 | 当前代码不读取columns；按data每行属性与queryField映射 | 新增测试：columns:null且data合法成功；错误别名仍报DQE_FIELD_MAPPING_ERROR | 未收到真实code/data/total_count |

## 验证

- 产品CLI：单页复制到独立目录后 `pnpm validate` 通过；local-authoring独立校验器对原文件通过。repair技能inspect脚本因当前产品不再导出fileNameErrors而无法启动，已保存原始失败并用产品CLI替代，没有把脚本故障归因于页面。
- `pnpm exec vitest run tests/partner-health-object-preview.test.ts tests/partner-health-preview.test.ts tests/partner-health-scores.test.ts packages/engine/data-gateway/tests/dqe.test.ts packages/engine/runtime-ui/tests/widget-host-state.test.ts`：5文件57测试通过。旧得分计算测试依赖被覆盖的旧业务页面，初跑16项失败；改为冻结原修订的五个得分源与概览分区到 `tests/fixtures/partner-health-scoring.json` 后保留旧能力回归。未将旧分数或计算接回用户新页面。
- `pnpm exec tsc --noEmit -p tests/tsconfig.json`通过。
- 浏览器：`http://localhost:5173/pages/partner-health`，地区部4行，华东声音4.4/扣分-1；切下方代表处Tab显示8行，上海声音4.7/合作意愿23；缺项为“—”。总分尚未接通，未宣称计算成功。
- 圈复杂度采用 `metriccanvas-ts-ast/1`、TypeScript5.9.3：partnerHealthResult自身CC8→9；organizationFields1→1；新增objectResult5、全部新增回调最高2、测试回调均1，无本次相关超限。产品Schema、协议、生成器、Skill分发未变，因此未重新生成共享协议内容。
- 完整JSON检查无initial。当前概览/图表仍为inline，不能声称是真实业务汇总；相同的中国区/海外queryModes未增加站点条件，默认level绑定的业务语义未验证。
- 未执行真实DQE、Relay、线上保存/发布、Git提交或push。截图和原始命令回执保存在 `/tmp/partner-health-repair-20261028/`；代表处截图另存 `.scratch/evidence-runtime-attachments-20261028/partner-health-pasted-repair/representative.png`。

## columns:null的最小可消费结果（合成）

```json
{"code":"SUCCESS","columns":null,"data":[{"地区部":"华东地区部","客户对伙伴的评价得分":27}],"total_count":1}
```

客户评价地区部源需要 `地区部` 与 `客户对伙伴的评价得分`；代表处源需要 `代表处` 与同一得分字段。返回空数组只说明该源没有匹配行；返回对象缺失queryField会造成字段映射错误。HTTP成功不等于每个results项成功。当前数据网关还要求total_count为非负整数，缺失/null/字符串会报DQE_ITEM_ERROR。真实响应应保留这些字段后再诊断，不能从columns:null推断根因。
