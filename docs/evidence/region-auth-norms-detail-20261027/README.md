# region-auth-norms-detail：分页合并排序诊断

本次仅同步脱敏诊断正文。原始业务响应、页面备份、脚本快照及下述历史命令输入继续本地保留，不随此次提交分发。排序编码修复现已进入main的1955324fe；真实来源身份与完整性问题仍待内部验证。

后续修改：按用户“修改json数据”的要求，`region-auth-norms-detail.json` 已仅修改 commercial-app-norm、contract-app-norm 两个查询的 order，分别使用对应审批次数指标的 `order_by_field` + `type: "desc"`。页面成员未写死分页窗口，继续由合并源管理。未修改运行时代码。原始页面备份为 `region-auth-norms-detail.original.json`；修改后静态校验通过，见 `page-validation.modified.json`。下文原件和未修改描述是首次诊断时的历史状态。

2026-10-27 用户提供页面、一次批量请求及两段响应。仅本地保存和诊断，未修改原始页面、运行时或服务，未提交/push。

## 用户纠正后的修复范围

用户明确：只需要商务按“商审审批人决策次数”降序、合同按“销售合同评审决策任务数量”降序；不认可 `order.by`，不要求新增 DQE 多字段语法。此前建议后端补齐多字段能力不适用于这个需求，应撤回。

已保存 `request.single-sort.json`，两个 order 分别采用现有 `order_by_field` 与 `type: "desc"`，保留 offset=0、limit=200；原始失败请求仍在 `request.json`。该修正请求尚未发送真实服务。

根因链包括前端两处未经需求支持的转换：`compileMember` 自动追加成员行键升序（此页为姓名）；`encodedMetricItem` 把排序编码成 `order.by`。ADR-0086 将中间层 GraphQL 字段指令的 type/priority 语义推成对象 DSL 的 by 数组，但没有证明对象 DSL 支持这个结构。不能把这项前端适配缺陷要求成后端必须新增语法。

运行时修复应使用已有单字段排序格式，不自动要求姓名次序；同时核对合并器对主指标相等行的比较，不能删掉姓名请求后仍按姓名升序拒绝等值行。来源唯一身份和服务跨批稳定性是独立检查，不等于业务要求多字段排序。仅改页面 query.body.order 不足：现有运行时仍会根据合并视图追加并重编排序。生产实现尚未修改。

## 文件与复原

- `region-auth-norms-detail.json`：页面原件，Schema 6.61，保持原字节。
- `request.json`：用户消息中的请求，按 JSON 格式化保存。
- `response-batch.original.txt`：第一份响应原件；结尾停在第一个 result 后的逗号处，缺第二项和闭合结构。
- `response-contract.original.txt`：第二份响应原件；单个 result 后多出批量包装的闭合括号。
- `response-commercial.json`、`response-contract.json`：分别提取完整 result 对象。
- `response-batch.reconstructed.json`：将这两个 result 重新包装，属于本地重建，不冒充完整网络原包。
- `source/`：本地 origin/main `54021ab6776c37c8e7e5f669e6c76cc88a3d7a48` 的诊断相关源码快照。

原始响应包含业务数据，仅本地保留；问题索引使用脱敏数值证据。

## 已证实结论

1. **当前错误来自商务源未按请求排序。** 请求要求审批次数 desc，再按审批人 asc；前两行审批次数为 2、99。仅这两行即可触发源码 `validateRowOrder` 的同一错误。200 行中有 89 处相邻主排序逆序，已排除“只是中文姓名比较规则不同”作为本次最早失败原因。
2. **排序没有体现在返回的执行描述中。** 两份结果 `dqe.orders=[]`，`dqe.offset=-1`，尽管请求 `order.by` 非空、offset=0。offset=-1 的具体服务语义未知，不能单凭它认定分页实现错误。源码 `encodedMetricItem` 生成 `order.by`；ADR-0086 明确这条指标排序编码尚未真实环境复验。已证实排序结果不满足契约；究竟是服务不支持此结构、字段解析失败，还是转换流程丢失排序，需服务解析结果或实际执行 SQL 才能继续区分。
3. **商务源行键不唯一。** 当前 `members.commercial.rowKey=commercial-approver`，但查询粒度为“商务审批人 × 代表处”。200 行只有 103 个不同审批人键；第 4 与第 8 行已出现同人不同代表处。排序修好后仍可能遇到重复行键错误。
4. **合同源无法提供所声明的身份和审批次数。** 49/49 行 `审批人姓名=null`、`销售合同评审决策任务数量=null`。当前 rowKey 指向审批人姓名；源码 `unionRow` 拒绝 null 行键。响应列元数据亦存在空项。只能确认字段结果缺失，不能从 SUCCESS 推断所选字段/模型匹配成功。
5. **单页结构合法不等于服务能力满足。** 在上述 6.66 源码快照执行 `parsePage`，原页通过；查询行归一化亦通过（当前查询标量允许缺失），但合并身份仍不可空。这与排序和行键错误并不矛盾。用户实际加载的构建版本未知；当前工作目录版本较旧，不能用于验证 6.61 页面。

## 如何修复

推荐先修接数契约，再改页面中有证据支持的字段：

1. **按用户确认的单字段需求修正编码。** 使用 `request.single-sort.json` 的 `order_by_field/type`，修改 `packages/data-execution/src/dqe/dqe.ts::encodedMetricItem` 的排序编码，并同步消除合并计划和等值比较中对未请求姓名排序的要求。对照真实返回验证两个主指标均降序；不新增 by 数组，也不要求后端新增多字段排序协议。
2. **按实际行粒度提供稳定唯一键。** 若保留“审批人 × 代表处”粒度，上游需要提供该粒度的稳定、非空唯一标识，再通过 queryField 映射到成员的 rowKey。不要只用姓名、当前页下标或前端分页后拼接的临时编号。若业务确实要“一人一行”，则应由查询按人正确聚合，并明确代表处如何呈现，不能悄悄删除代表处维度来通过检查。当前协议 rowKey 是单个字段，不能直接填数组模拟复合键。
3. **修合同字段与指标的数据上下文匹配。** 独立验证审批人维度和决策次数指标，在当前模型、权限、期间下是否可同时返回，再逐步加入代表处和驳回指标。修正已确认的 queryField/查询输出，或补齐上游字段；不能把空姓名转空串或虚构身份。不要用 0 替代未知次数。
4. **验证稳定分页。** 主键、排序字段、中文比较规则与 null-last 均须与合并器一致；读取商务 offset=0/200 的完整 318 行，确认跨批单调、键不重叠、总数准确，再验证两来源全局排序和翻页。现有附件不包含剩余 118 行，也没有服务访问凭据，故未做实时重查。

不应删除排序检查、吞掉错误或只重排当前 200 行。318 条商务记录只取得 200 条，剩余记录可能应出现在全局首屏；局部排序不能修正全局窗口。若服务暂不支持有序流，可以另设计有明确预算且证明读取完整的全量合并，再统一排序分页；当前 pagedUnion 没有一个页面 JSON 开关能安全获得该替代执行方式。

## 验证与边界

```sh
node docs/evidence/region-auth-norms-detail-20261027/replay.mjs
node tools/scripts/measure-ts-complexity.mjs docs/evidence/region-auth-norms-detail-20261027/replay.mjs
```

回放直接抽取源码快照中的 `validateRowOrder`、`compareMemberOrder`、`compareUnionRows`、`unionRow`，不重写判断逻辑。断言：完整商务样本与最小二行样本复现同一排序错误；仅交换最小样本顺序通过；重复键触发身份错误；合同 null 键触发缺失/类型错误。交换两行只是反例验证，并非生产修复。

`page-validation.json`：原页 parsePage 通过。`row-validation.json`：两个响应普通字段归一化通过，不能据此证明合并键合法。`replay-result.json`：回放和统计；`complexity.json`：TypeScript 5.9.3、metriccanvas-ts-ast/1，新增诊断脚本全部函数及回调 selfCC 为 1–2（新增无旧值），guard=2，其余具名函数=1。源码快照未修改可执行分支；无本次复杂度超限。

未执行：真实服务重查、全 318 行完整性、浏览器呈现、生产修复与部署。没有声称已提供可运行的修复版页面。
