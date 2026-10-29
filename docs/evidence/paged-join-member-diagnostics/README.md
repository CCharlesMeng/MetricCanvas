# 组合查询成员错误定位

日期：2026-10-29。基线为隔离检出的 origin/main `6524bcdb3`。只增强诊断，不改变查询、关联、失败分类、结果完整性或页面错误空态。

## 已复现的故障

输入页面 `approval-detail` 以 `zb1971` 为主成员，键为 `biz-code`（DQE `商务编号`）。用户提供的三行成功响应中商务编号与统计日期均为null。原始报错为 `成员行键缺失或类型错误`，后续补列没有发出。

通过真实数据网关的HTTP响应边界回放这三行，新报错为：

```text
DQE_ROW_CONTRACT_ERROR
无法合并表格数据：第 1 行的“商务编号”为空，无法关联其他数据。请检查查询是否返回了有效的“商务编号”。
字段检查：期望非空 string，实际 null
定位详情：组合源 "approval-detail" → 成员 "zb1971"（数据源 "zb1971"，关联字段 "biz-code"，DQE 字段 "商务编号"）；配置 /dataSources/approval-detail/source/members/zb1971/key
```

请求仍只有主成员一次，保留原始失败行为。普通组合成员的空键、空字符串、重复键、额外键、字段契约及范围错误均附成员上下文；重复键与未请求编码分开报错。记录关联共用有效键检查，补列重复/额外键也附来源。日志只含标识、字段、位置、值类别及计数，不回显键值或业务行。

## 场景与验证

- 完整页面：`pages/capabilities/table/paged-join-diagnostics.json`，入口 `/pages/paged-join-diagnostics`。正常页面复用本地DQE Sim；异常通过浏览器测试在HTTP响应边界注入。操作和预期见该目录README。
- 产品语义：`docs/page-metadata/data-sources.md` 的“查询异常与结果总数”，根 `PAGE-METADATA.md` 同步链接。
- 独立本地创作Skill：由 `pnpm authoring:contracts` 同源生成参考、知识和锁，版本1.7.4；MC内容包同步生成。未新增页面协议字段，Schema保持6.71。

执行回归：

```sh
pnpm exec vitest run packages/data-execution/tests/paged-join-diagnostics.test.ts packages/data-execution/tests/paged-join.test.ts packages/data-execution/tests/record-join.test.ts packages/data-execution/tests/object-record-join.test.ts packages/data-execution/tests/rejection-time-pushdown.test.ts packages/data-execution/tests/dqe-object-join.test.ts packages/engine/runtime/tests/paged-join-session.test.ts
pnpm --filter @metriccanvas/data-execution check
pnpm --filter playground check
pnpm --filter playground exec playwright test tests/paged-join-diagnostics.browser.ts --workers=1
pnpm validate
```

结果：执行回归63项通过；两个受影响包类型检查通过；浏览器正常、空键、重复键、截断、超限5项通过并保留截图；132个页面文档全部通过。失败时仅主查询发出，组件为空态，控制台包含来源链及位置。原来的诊断断言在修改前失败，正常关联对照在修改前后均通过。

MC生成漂移检查、独立来源覆盖检查、33项MC内容测试和可观察诊断夹具检查均通过；夹具中的内容哈希由官方生成器同步。独立Skill仓外安装/页面校验、页面参考及导出隔离共72项检查均通过：首次71项通过，校验器生成漂移的一项90秒超时，单独复跑26秒通过。MC及Skill生成检查使用项目已有锁定Python环境，避免系统Python缺少fastmcp/jsonschema。静态、单元、浏览器、捕获响应回放均为本地证据；没有宣称真实服务部署或CI完成。

## 复杂度

使用仓内 `metriccanvas-ts-ast/1`、TypeScript5.9.3的selfCC；包含全部新增辅助函数、测试回调和构造器。测量器自身5项测试通过。

| 函数 | 修改前 | 修改后 |
|---|---:|---:|
| memberRows | 11 | 7 |
| assertMemberRange | 13 | 13 |
| associationKey → 共用memberKey | 8 | 6 |
| collectRecords | 3 | 3 |
| supplementRows | 6 | 6 |
| projectRecordRows的map回调 | 8 | 8 |
| collectRecords的map回调 | 1 | 1 |
| indexMemberRows | 新增 | 5 |
| MemberFailure构造器 | 新增 | 1 |
| memberFailure | 新增 | 2 |
| keyKind | 新增 | 7 |
| pointer | 新增 | 1 |

新增执行回归的所有函数selfCC为1—9；新增浏览器测试及全部回调为1—8。本次没有超过15的新增或修改函数，无未关闭的复杂度项。

## 人类可读错误改写

根据使用反馈，首行改为“哪里有问题、为什么无法继续、该检查什么”，使用页面已有中文字段标签；数据源id、类型和JSON Pointer放在后续字段检查及定位详情。空编号不再用“成员行键缺失或类型错误”作为首行；重复、截断、超限也改用直接说明和处理提示。

首行中文提示与技术信息分行的断言在改写前失败；改写后通过。用户提供的三行响应已再次经过数据网关回放，得到上面的中文首行。

本轮改写按同一AST工具/TypeScript5.9.3实测：构造器1→1、memberKey6→6、indexMemberRows5→5、assertMemberRange13→13、supplementRows6→6；新增memberKeyLabel=2、keyProblem=4。测试中的全部新增回调selfCC=1，其余修改回调不增长；无未关闭项。

人类可读改写后的验证：41项相关执行回归、5个浏览器场景、42项仓外Skill/页面参考检查及受影响包类型检查通过；MC内容包检查同步重跑。
