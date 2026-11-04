# Relay 发行契约首批实施回执

2026-11-03。仅覆盖 [Spec](../../plan/2026-11-02-product-relay-evolution/relay-reference-spec.md) 的 S03 发行工程；推进状态见[执行台账](../../plan/2026-11-02-product-relay-evolution/relay-reference-execution.md)。实现位于当前隔离工作树，未提交、push 或部署。主目录的其他并行工作未纳入代码批次。

## 实现与职责

新增 `tools/relay-reference/release.py` 生成/校验规范清单与原始字节摘要，`compatibility.py` 做保守兼容预检查，`cli.py` 提供 seal/verify/compare。只用标准库，verify/compare 只读，seal 仅写候选清单且拒绝覆盖不同内容的既有清单。所有回执 `automaticPromotion: false`；兼容预检查成功仅表示可以进入真实包装的冒烟。

已支持旧操作/资源/公开路径删除、既有输入输出及错误契约变化、运行依赖变化、默认页面版本变化、主版/倒退/同版本换内容、混批或摘要损坏的明确拒绝。内容可重新分片，内部文件可重排而保持资源 ID/公共契约；这只是结构兼容证明，不验证任意新实现语义。

## 实际检查

[最终测试日志](tests.log)：锁定 Python 3.12 环境运行 19 个测试方法通过，覆盖独立旧消费契约、正反兼容、完整性、符号链接、大小写歧义、UTF-8/重复键/非有限值、仓外 `-S` 关闭第三方包发现、禁 socket 及读取前后文件不变。标准库复制测试只复制检查器三文件，不代表产品四项闭包。初轮一项用例因 macOS 大小写不敏感而无法制造预期双文件，已改为跨文件系统均可验证的公开路径歧义检查。

[复杂度逐项结果](complexity.json)：Radon 6.0.1 测量全部新增 53 个函数/方法/闭包，另以 AST 核对 9 个无分支 lambda，各自 CC=1。最大自身 CC=7，均 ≤15；新增文件无存量前值，没有修改既有可执行函数，无未关闭超限项。Radon 命名函数与 AST lambda 的口径分别记录，没有把类聚合分值当作方法分值。

源码/README 原始摘要见 [source-files.json](source-files.json)，环境与范围见 [verification.json](verification.json)。ADR 索引生成/检查及文档新增链接检查另在文档批次执行。此次没有移动现有产品工具、改页面协议、引擎或安装 Skill，因此不将历史页面/Skill 测试计作本批新验收；后续 S04/S05 仍须补实际产品/页面/生成/独立安装。

## 基线与未完成项

当前工作树基于 `552ef5c1228ce292ad9a2ec66673fa82e1c67ba4`，fetch 观察到 origin/main 为 `7ccb3431693398d6347a02abbe07798943e8dbbb`、Schema 6.82。发行检查器不依赖产品源码；这不关闭后续产品基线集成。远端 ADR-0128 已占用，本决策使用 ADR-0129；未引入其他批次代码或历史生成包。

测试夹具的 mc-tool/cli.py 是结构占位，不执行页面操作。实际 facade、四项产品导出、compose/edit/参数闭包、Relay 包装/自动更新、真实 Java/DQE/前端、真实模型、CI 和部署均未验。不得将本回执称为“Relay 自动升级完成”或“拆分完成”。
