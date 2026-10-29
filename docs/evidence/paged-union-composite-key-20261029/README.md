# pagedUnion 组合行键实施与验收（2026-10-29）

已确认范围：只扩展分页合并源成员；来源内“审批人 × 代表处”组合唯一，各分量保持非空，重复仍失败。保留旧单字段声明及身份编码，不追加排序字段，不改变实时offset分页，也不扩展pagedJoin关联键。

实现位于本聊天附着的干净工作树，分支 `codex/paged-union-composite-key`，基线 `3e7acd3ba`（开始时与origin/main一致）。主工作区的并行修改未接入。本次未提交、推送或部署。

## 声明与兼容

页面能力下限为Schema 6.72。成员声明必须在 `rowKey` 与 `rowKeyFields` 中二选一，后者至少两个不同的原始维度字段；每个字段均需queryField、string/number类型及nullable:false。

用户页面中 `/dataSources/reviewer-rejection-detail/source/members` 的正式声明如下（projection和来源查询保持原内容）：

```json
{
  "commercial": {
    "source": "commercial-app-norm",
    "rowKeyFields": ["commercial-approver", "commercial-office"]
  },
  "contract": {
    "source": "contract-app-norm",
    "rowKeyFields": ["contract-approver", "contract-office"]
  }
}
```

以上为成员身份片段，完整可校验页面见 [region-auth-norms-detail.json](region-auth-norms-detail.json)。该副本仅将schemaVersion更新为6.72，目标合并源两个成员的rowKey改为rowKeyFields，并将两个来源office字段显式声明nullable:false；没有补空值、改查询或更改其他合并源的行身份。

旧编码为 `[来源ID, 单值]`，新组合编码为 `[来源ID, [分量1, 分量2, ...]]` 的JSON字符串。顺序及原始类型保留，不用分隔符拼接、不排序字段、不trim原值；纯空白和非有限数字失败。组合身份的initial按来源、数量、位置类型、非空和组合唯一性校验，JSON空格差异不能绕过重复检查。所有最终行键仍为string，Table和导出接口不变。

## 可观察入口

在本工作树执行 `pnpm --filter playground dev --host 127.0.0.1 --port 5197`，打开 `http://127.0.0.1:5197/pages/multi-source-composite-key`。元数据为 `pages/capabilities/table/multi-source-composite-key.json`，合成数据由 `apps/playground/fixtures/decision-opinion/union-gateway.ts` 与seed/model提供。

- 正常：256条合成记录，合同审批人甲在示例一处、二处分别保留；跨来源相同组合分别保留。
- `?rowFailure=duplicate-composite`：来源第1、2行完整组合相同，整轮失败并定位rowKeyFields。
- `?rowFailure=missing-composite-key`：第2行代表处为null，整轮失败并定位代表处与成员声明。
- 浏览器覆盖翻页、搜索、单列排序、空结果、筛选后的Excel下载与旧multi-source-table回归，见 [browser-result.json](browser-result.json)。导出的Excel含表头及3条匹配记录，通过ZIP/XML检查共4行。

截图：[正常](browser-ready.png)、[重复组合](browser-duplicate.png)、[空分量](browser-null.png)。错误UI保持项目既有空态呈现，详细分类与技术定位在控制台。

## 验收结果

- 修复前反馈：两个新测试文件12项失败，捕获旧协议不支持组合身份；实现后新增契约、运行时与原诊断定向24项通过。
- `pnpm exec vitest run packages/page/tests packages/data-execution/tests`：122文件、1248项通过。
- page与data-execution包类型检查通过；`pnpm --filter playground check`：0错误0警告；工具tests TypeScript检查通过。
- `pnpm validate pages`：132个页面全部通过。
- Chrome实际浏览器：正常、空结果、重复组合、空分量、分页、搜索、排序、Excel及旧单键页面通过。
- 仓外完整复制local-authoring 1.8.0后，独立Node校验器对组合演示页和用户页面均返回ok:true；Schema版本6.72，无仓库依赖。
- `authoring:contracts`：从产品真源生成；新增联合分支、枚举、正反例与索引已进入官方导出。升级示例及MC诊断页面通过各自官方生成/升级期望同步到当前版本。
- local-authoring按需知识仍受原16384字节预算约束；文档将既有“当前序号与固定业务排名”拆成独立可发现主题，未扩大读取预算。data.pagedJoin=15867、data.pagedJoin.rank=7442、data.pagedUnion=16070字节。
- `pnpm authoring:check`：6文件、222项通过，包含仓外安装、知识预算、旧页升级与完整隔离导出。
- `pnpm mc:content:check`：契约导出/MC源覆盖当前、33项Python测试通过、诊断及可观察夹具当前。

维护命令使用已有Python虚拟环境：PATH前置主检出的 `metriccanvas-authoring/tool/.venv/bin`，并以METRICCANVAS_PYTHON指定其中python；未新增或安装依赖。

## 附件数据回放与剩余缺口

[user-response-replay.json](user-response-replay.json) 是附件首批响应经共享SourceProgram的本地回放，不是实时DQE请求：

- 商审首批200行：以审批人×代表处识别后可返回第一页20行，保留原total_count=387，未再出现审批人重复造成的身份冲突。
- 合同：第1行审批人为空，仍返回DQE_ROW_CONTRACT_ERROR，定位contract-app-norm及rowKeyFields；50条空审批人与200条空决策次数仍需数据同事核查。
- 未执行真实DQE/Relay、后续业务数据批次、线上保存或部署。页面其他合并源及跨页目标未作真实服务验收。

## 复杂度

口径为metriccanvas-ts-ast/1、TypeScript 5.9.3，各函数selfCC独立测量，包含新增辅助函数、闭包、测试与浏览器回调；不以外层低分替代内部测量。见 [修改前](complexity-before.json) 与 [修改后](complexity-after.json)。

| 函数 | 修改前 selfCC | 修改后 selfCC |
|---|---:|---:|
| memberInputErrors | 9 | 5 |
| initialIdentityErrors | 10 | 11 |
| initialKeyMatches | 新增 | 4 |
| parsedIdentity | 10 | 6 |
| unionMemberKeyFields | 新增 | 2 |
| validUnionKeyPart | 新增 | 4 |
| unionKeyLabel | 2 | 1 |
| unionMemberError | 4 | 4 |
| unionRow | 9 | 3 |
| memberRowIdentity | 新增 | 2 |
| validateRowOrder | 6 | 7 |
| pageExternalInputs | 14 | 15 |
| injectRowFailure | 6 | 8 |

修改与新增函数（含回调）全部selfCC≤15，无本次超限未关闭项；保留未修改函数原行为。排序/分页规则未新增分支，只调整组合身份及其错误描述。
