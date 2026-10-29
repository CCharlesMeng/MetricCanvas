# pagedUnion 成员可选 UUID 行键（2026-10-29）

Schema 6.73、local-authoring 1.9.0。在已实施的组合键能力上增加显式成员选项，每个成员且只能声明一种：`rowKey`、`rowKeyFields`、`rowKeyGeneration: "uuid"`。未声明 UUID 时保持原有严格身份契约，不遇到 null 自动回退。

```json
{
  "commercial": {
    "source": "commercial-app-norm",
    "rowKeyFields": ["commercial-approver", "commercial-office"],
    "projection": { "…": "沿用现有投影" }
  },
  "contract": {
    "source": "contract-app-norm",
    "rowKeyGeneration": "uuid",
    "projection": { "…": "沿用现有投影" }
  }
}
```

以上仅为成员策略示意，完整可校验用户页面见 [region-auth-norms-detail.json](region-auth-norms-detail.json)。相对上批组合键副本，仅更新为6.73、将目标合并源的合同成员改为UUID、将合同来源审批人/代表处显式声明可空；商审仍用组合键，查询、其他合并源及业务值保持。

## 运行语义与架构影响

- 新能力限于分页合并源成员的行身份。安全随机源生成UUID v4，最终字符串编码为 `[来源ID, UUID]`；不补齐业务值、不将UUID投影成审批人，不修改DQE查询、排序或pagedJoin关联键。
- UUID随已取回行、缓冲区、检查点、initial保留；重新取数、刷新、缓存失效和完整导出可变化。详情定位、持久化及跨请求引用仍使用上游业务标识。
- UUID模式逐条保留上游返回行，不能检测业务重复或分页重叠；业务行正确性、稳定无重叠且无漏行的分页由上游保证。原单键、组合键继续拒绝空键及重复键。
- 原始和最终字段类型及可空性仍校验，允许null须声明可空。准确总数、完整批次、排序、取消、扫描和完整导出限制保持；没有安全随机源时报DQE_CONFIG_ERROR。
- Schema严格三选一，版本下限6.73；initial核对来源、UUID格式及重复身份。产品文档、契约向量和官方生成的Skill知识/独立校验器同步。

## 可观察场景

入口 `http://127.0.0.1:5197/pages/multi-source-generated-key`，页面 [JSON](../../../pages/capabilities/table/multi-source-generated-key.json)。启动 `pnpm --filter playground dev --host 127.0.0.1 --port 5197`。使用Playground合成网关，与共享SourceProgram一致执行。

浏览器 [结果](browser/result.json)：默认256行、下一页、搜索3行、排序、完整过滤导出均通过；XLSX实际XML为表头+3行。`?rowFailure=missing-composite-key` 保留空代表处，`?rowFailure=duplicate-composite` 保留重复组合；两者仍为256行。`?rowFailure=order` 继续失败并定位rowKeyGeneration。已查看 [空代表处截图](browser/missing-composite-key.png)。[严格模式回归](strict-browser/result.json) 验证组合空值、组合重复仍失败，旧单字段页面正常。

## 附件回放

[本地回放](user-response-replay.json) 使用用户提供的两份首批200行响应，经共享SourceProgram执行：混合策略首屏ready、总数637；商审筛选ready、总数387；合同筛选ready、总数250，第一页20条审批人仍为null，但不再因行键报错。没有读取未提供的后续批次，也没有实时访问DQE/Relay；不能将本地回放视为真实服务完整验收。

## 验证

详见 [命令结果](verification.txt)：

- page + data-execution：124文件、1258测试通过，包括成员混用、null和重复业务行保留、缓冲翻页、完整导出新身份、initial校验、缺失随机源、排序失败及原模式回归。
- local-authoring相关5文件193测试通过；另单独运行隔离导出“无旧链时可运行”通过，其他29项历史隔离漂移故障注入未在本次重跑。初次全量运行发现新知识主题连带依赖超过原16384字节预算后停止；改为独立可发现主题并重生成，预算回归通过，未提高预算或截断内容。
- 官方authoring:contracts导出与检查通过（1293 product、4 authoring、1 interface）；mc:content:check通过、33项Python测试通过、源覆盖与诊断夹具当前。
- 133个页面文档全部通过；page/data-execution源码及测试、工具及Playground类型检查通过，Svelte检查0错误0警告。
- [独立安装](standalone.json)：复制完整Skill至仓库外，无仓库node_modules依赖，示例与用户页面均通过独立校验。
- 未提交、推送、部署，未验证真实DQE/Relay及模型服务。复用本任务工作树，保留全部未提交实现。

## 复杂度

使用metriccanvas-ts-ast/1、TypeScript5.9.3，分别测量selfCC，覆盖修改函数、新辅助函数、闭包、测试与浏览器脚本，见 [修改前](complexity-before.json)、[修改后](complexity-after.json)。

| 函数 | 此增量前 | 此增量后 |
|---|---:|---:|
| unionMemberKeyFields | 2 | 3 |
| initialIdentityErrors | 11 | 12 |
| initialKeyMatches | 4 | 5 |
| unionKeyLabel | 1 | 2 |
| unionMemberError | 4 | 6 |
| memberRowIdentity | 2 | 3 |
| validateRowOrder | 7 | 8 |
| pageExternalInputs | 15 | 14 |
| validGeneratedUnionKey | 新增 | 2 |
| createUnionUuid | 新增 | 2 |

全部修改/新增函数与回调selfCC≤15；生成器字节回调为1，新增测试回调最高4，浏览器回调最高2，契约向量新增回调为1。[一次性回放脚本](complexity-replay.json) 的辅助函数/回调最高4。无本次超限未关闭项。
