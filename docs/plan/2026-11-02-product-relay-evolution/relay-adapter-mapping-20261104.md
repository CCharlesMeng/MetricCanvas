# Relay 接入交接：公开入口、旧能力映射与回放

日期：2026-11-04。目标：MC release 0.3.4 / Interface 2.0.0 / Schema 6.84。这是已实现的 MC 接入说明；真实 Relay 包装、DQE 和保存仍由 Relay 验收。

## 入口和旧能力映射

固定入口为 `mc-tools/cli.py`；四项整批安装，不从 `_impl` 或 `mc-content/scripts` 私有路径 import。

| Relay 现有包装 | 正式接入方式 | 必须保留或补齐的边界 |
|---|---|---|
| `tool_mc_query → query_content` | `invoke content.read`，输入 topic/key 及公开读取选项 | 默认 maxBytes 从旧现场 256KB 改为产品 32KiB；程序逐项适配 options，不透传未知字段。保留 partial、continuation 和完整原子语义，不能自动升级预算读取全文 |
| `tool_mc_compile → compile_layout` | **尚无等价的公开操作** | 旧输入是 templateRef/plan/userRequirements/targetVersions/requestId，输出含模板填充、adjustments/gaps、inspectionSpec 和关联摘要。`page.compose.v2` 接收 request/resultRecords 等装配输入，不承诺这些模板检查；不得直接更名替换 |
| `tool_mc_inspect → inspect_assembly` | **尚无等价的公开操作** | 旧检查含 inspectionSpec、内容摘要、强制组件/绑定和可信 compile 关联。`page.validate` 只完成其注册支持的页面检查，不能证明旧 inspectionSpec 已通过 |
| 新建页面 | `page.compose.v2` | Relay 提供显式 request/resultRecords/pageId；程序保存完整候选，工具本身不查询或保存 |
| 编辑已有页 | `page.edit.v2` | 程序供给完整工作副本、稳定 baseline 和执行证据；本轮授权、CAS、取消、迟到及 Java 保存仍在 Relay |
| 旧页读取/升级 | `page.project`、`page.scan`、`page.validate`、`page.upgrade` | 不把读取当升级；升级候选须显式核对目标版本，原件由程序保留 |
| 查询与已有结果 | `query.prepare`、`results.normalize.v2`、`results.check` | 前者只准备查询；DQE 执行、权限与完整性事实来自实际执行。RESULT_SCOPE 匹配不能单独证明全量完整 |

compile/inspect 缺口的处理：Relay 若仍依赖旧模板工作流，应保留原批次处理在途轮次；新公开工作流先接入已有注册操作。需要公开支持模板编译/检视时，另立具有实际输入与验收样本的能力项。本次不假造兼容别名，也不继续调用新包私有实现。

## 可直接执行的样例

包内 `mc-tools/examples/index.json` 列出 35 条冻结请求，标明 operation、request、expectedStatus 和 expectedDiagnostic。请求文件与正式冻结消费向量同源，不是模型生成的伪回执。

```sh
python -B /absolute/references/mc-tools/cli.py check-release
python -B /absolute/references/mc-tools/cli.py self-test
python -B /absolute/references/mc-tools/cli.py invoke page.compose.v2 \
  < /absolute/references/mc-tools/examples/requests/0033.json
python -B /absolute/references/mc-tools/cli.py invoke page.edit.v2 \
  < /absolute/references/mc-tools/examples/requests/0034.json
python -B /absolute/references/mc-tools/cli.py invoke page.compose.v2 \
  < /absolute/references/mc-tools/examples/requests/0035.json
```

0033/0034 为受控多槽成功样本；0035 缺完整性证据，预期 error / TABLE_SLOT_INCOMPLETE，进程退出 2。样例中的时间和查询结果均为合成输入，不能当作真实执行、授权或保存的证据。

其他入口：0004 旧页投影，0006 升级，0008–0013 页面/参数/升级拒绝，0014–0017 分析及换源，0021 呈现 partial，0029 unknown 保存状态拒绝，0032 v2 结果归一化。具体输入以请求文件和 Interface 为准；不手写第二份嵌套 Schema。

多槽真实接入必须补齐：request 的 tableSlots、稳定 rowKey、各槽期间；resultRecords 的实际 rows、totalCount、来源字段、初始快照及请求期间。空结果、失败、未知、缺证据和部分结果分别传递；不要把缺 totalCount 的结果改成完整成功。

时间敏感操作由 Relay 程序按轮次冻结 `input.evaluation={instant,timeZone}`，instant 为明确瞬时值，timeZone 为 IANA 业务时区。不能取模型生成值、分析期间或机器默认时区。缺失预期 EVALUATION_CONTEXT_REQUIRED；非法预期 INVALID_EVALUATION_CONTEXT。固定期间的上述 0033 样例不等同于时间敏感覆盖。

## 精简模型材料

选择操作后调用 `content.read`，输入 `{"topic":"runtime","key":"operation.page.edit.v2","options":{"maxBytes":8192}}` 可取单项输入概览。它只提供必填项和字段指针，**不是完整校验器或 MCP 注册 Schema**。程序从 Interface 执行完整校验；需要某个属性的真实规则时按任务继续读取对应知识。

标题/列宽修改只读编辑概览、目标组件和受影响属性；不强制读取完整用数报告。完整页面、原始结果和完整 Interface 留在程序侧。模型回执保留本轮必要摘要及完整有序诊断，partial/error/unknown 不得被摘要抹去。大页面与多轮成本仍需真实 Relay 轨迹证明；文件字节不换算为 token 或费用。

## Relay 现在需要实际完成的工作

1. 新目录安装整批四项，保留宿主 references；记录 releaseId、contentSha256、Interface 版本并运行自检。原字节校验，不加 CRLF 归一化或强制封存。
2. 将公开消费改为 subprocess，显式 UTF-8 stdin/stdout、受控超时，解析完整结果信封。ok/partial 退出 0；产品拒绝退出 2；环境/发行故障退出 3。失败不能当空数据继续保存。
3. 接好上述 v2 多槽和可信 evaluation；导出实际 MCP 注册定义及模型可见回执。无需先补完历史材料才开始此项。
4. 新建、标题/列宽编辑、多槽和失败续跑各留一份实际请求/回执；保存链另验 CAS、取消/迟到、unknown 恢复及 Java 幂等。预检查通过不能自动视作整批采用。

原始旧包身份矛盾、完整 15+3 包装清单与模型 token 数据用于现场核对和最终验收；不阻塞 MC 本地实现或 Relay 上述接入。
