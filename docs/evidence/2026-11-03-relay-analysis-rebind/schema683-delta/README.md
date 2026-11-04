# Schema 6.83 集成后的测试输入修复

只修改 A 独立树，未写主控 `relay-reference-final`。三文件增量见 `delta-manifest.json`，逐项 SHA；`test-only.diff` 展示测试差异。生产代码、旧消费样本、首版操作描述及原 `analysis-parity.json` 期望均保持。

原失败将新的可变产品 Schema 输入与 6.82 冻结 draft 摘要比较。只读差分确认原始页面字节完全相同，完整 draft 只有 `schemaSha256` 改变；有序六项诊断全部相同。旧 Schema 的序列化摘要为 `0072035230bfa1fc85d1318268550c82c91cfd6d61cad835e850154309b0f9b0`，当前 6.83 为 `8cd760585f714749038b7bd386e2e187e7c3c9327c5296476f052e61f0a19ed2`。直接调用当前 6.83 模块的验证结果见 `schema683-readonly-probe.json`。

从实际首版 r6 发行 `55b2c482617005e95c353523b8e8926b8db538e5872bb06362cde28edd00f9ff` 的 `mc-content/product-contracts/page/schema.json` 原字节复制测试输入，不自动重录旧期望。另增当前产品 Schema 的摘要断言，以及除该身份字段以外完整 draft 与有序诊断相等的语义断言。该旧 Schema 仅用于测试，不成为生产 fallback 或第二套引擎。

另外两个跨进程用例全仓分别耗时 9.025/7.440 秒超默认 5 秒，而主控定向重跑均过。按授权只将这两个 `it` 设为 20 秒，所有原断言和每次独立进程自身 20 秒边界保持；无全局超时放宽。

A 6.82 独立树全部 56/56 通过（原 55 加当前 Schema 身份/语义一项），严格定向类型检查通过。`metriccanvas-ts-ast/1`、TS5.9.3：测试函数/回调由 54 增至 55，新增回调自身 CC=1，最大仍为 13，无超限。主控应用增量后应在其当前 6.83 源码跑原失败入口及新增向量，再继续完整回归。writer 策略与发行兼容决策仍待主控处理，此增量不改变版本声明。
