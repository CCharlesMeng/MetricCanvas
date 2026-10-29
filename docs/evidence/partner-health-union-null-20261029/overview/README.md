# 顶部中国区 / 海外整体记录 Mock

2026-10-29。用户确认顶部按中国区/海外显示后端整体记录，现有地区部查询不包含整体记录，要求先构造一套。本轮构造独立整体记录、完整查询候选和可运行页面，未把组织分数跨行求和。

## 入口与文件

- [Mock页面](http://localhost:5173/pages/partner-health-union-null-probe)，页面文件 `pages/temporary/partner-health-union-null-probe/partner-health-union-null-probe.json`。
- 原始合成值：`apps/playground/fixtures/organization-union/mock.json` 的 `overview`；独立11项子分数，没有预填总分。
- `overview-sources.candidate.json`：11个查询页面数据源、整体并集与关联、四项分类与总分计算、5张指标卡绑定。
- `requests-china.candidate.json` / `requests-overseas.candidate.json`：实际网关编码出的两个范围各11条DQE请求，均为未执行候选；可以交给后端核对。
- `responses-china.mock.json` / `responses-overseas.mock.json`：与各请求顺序一致的合成原始DQE响应；每子项每范围一行、总数1。
- `probe.ts`：`pnpm exec tsx docs/evidence/partner-health-union-null-20261029/overview/probe.ts`，保留计算快照与请求于`result.json`。

## 口径和结果

| 范围/状态 | 总分 | 感知 | 满意度 | 能力与贡献 | 风险 |
|---|---:|---:|---:|---:|---:|
| 中国区 | 35 | 20 | -- | 17 | -2 |
| 海外 | 30 | 4 | 15 | 14 | -3 |
| `state=overviewMissing`，整体记录存在、所有单项缺失 | 0 | -- | -- | -- | -- |
| `state=overviewZero`，单项均为真实0 | 0 | 0 | 0 | 0 | 0 |

分类用`sumFields.onMissing=ignore`，部分缺项参与求和时忽略、全部缺项保持null；总分`onMissing=zero`。原始单项null/空文本经网关归一化为null，真实0、数字字符串0、负数保留。5张卡显式`missingText: --`。地区部和代表处表格保持15行，两个顶部特殊状态不改变组织数据。

整体来源采用同一范围键`china-overseas`形成并集，逐源unique关联，杜绝第一行取值或跨组织相加。查询正常但完全无记录时为空态，不凭空制造零分整体记录；请求失败、重复键或不完整结果保持error，不输出部分总分。现有统一呈现策略可能将error显示为空数据，诊断仍保留错误。

## 待真实DQE核对

`data_site_type`来自目标页已有明细筛选字段，本轮将它用于整体查询的输出与筛选属于候选。真实服务是否支持11项得分按该字段切分、对象源是否存在每范围唯一的整体记录，均未验真。对象查询只投影字段，不因此自动聚合；如果返回多条相同范围记录，计算明确拒绝。

普通指标沿用既有月度聚合和日期绑定；对象查询沿用原有对象定义且没有声明日期字段，不编造日期谓词，需后端补充真实期间约束。区域筛选沿用已有`geo_pc_name_cn`，其实际可执行性同样另验。没有重新加权子项，也没有把旧测试中的虚构指标名接回真实页。

遵循本地创作Skill“新增/修改查询需可信数据上下文，真实执行后才写回目标页”，完整候选仅接入明确标记的Mock页。正式`pages/temporary/partner-health.json`本轮未修改，`health-overview`仍为空；正式入口仍走真实DQE网关。此前组织并集实现不受影响。

## 验证

`tests.log`：4个文件69项通过，覆盖顶部、组织并集、正式网关隔离及既有分类计算。`typecheck.log`：测试类型检查通过。页面目录校验137/137通过；页面试验场类型检查0错误0告警。

真实浏览器验证了中国区35→点击海外30、全缺总分0且分类`--`、真实全0。截图和AX分别为`china`、`overseas`、`missing`、`zero`。正常浏览器console error为空；未执行真实业务DQE、提交或push。

本轮复用现有unionKeys、joinAggregate、sumFields、指标卡缺省值与筛选绑定，没有新增或修改产品协议/引擎行为；因此协议文档和local-authoring生成内容无需新增语义。现行独立local-authoring校验器通过该Mock页，未改变正式数据环境。

复杂度口径`metriccanvas-ts-ast/1`、TypeScript5.9.3：responseRows自身1→1，内部字段映射回调3→4；Mock fetchData10→11，fetchImpl5→5；新增overviewRows2、选择谓词2、行构造回调5；新增回归及诊断辅助函数全部≤15。隔离回归的既有回调因核对正式源子集2→3。本轮无复杂度超限未关闭项，完整数据见complexity-before/after.json。
