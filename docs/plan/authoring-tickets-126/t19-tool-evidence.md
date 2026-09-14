# T19 / #145 发布工具消费证据（S4）

## 提交与所有权

- 正式共同基线：`b3261ae94888775efaeb4420b8a953507f57c78a`，包含 #138、#146、双 Platform Skill 及 S2 最终 publication/1。
- S2 共同作者初始提交 `5a4e44ea63aa1f22326bceb37a874b0d869c1514`，修正后完整消费提交 `669412823d97aa899db85997bb6e5088c0bb38a4`。
- S4 工具作者：`7c9d80250af253b7152b2a7f8ca4a40e18505981`；15 文件均位于 S0 冻结窗口。
- S2 唯一生成/最终代码组合：`a15730fd954f61e51cea59ddeee281e2d69f85a4`，直接父提交为 S4 作者；仅导出器登记及 contracts manifest、contract-lock、bundle.lock。
- 最终工作树只追加本证据并收尾契约文档，分发代码与 a15730f 完全一致。

S4 不修改 S1 工作台/页面资产客户端或 S2 共同作者、导出器、生成文件；不推送远端、不代替 S1/S0 完成 #145 整票验收。

## 本仓工具行为

独立 lifecycle MCP 保留原四项草稿工具，并新增五项发布工具；公共组合入口兼容三个位置参数，仅通过 `publication=` 注入明确的可信服务及人工事件边界。生产固定注册九工具，新五项默认 `CAPABILITY_UNAVAILABLE`，没有拟新增 HTTP 地址、能力环境开关或默认摘要算法。内容 MCP 不注册这些工具。

发布请求 Schema 仅引用共同 `publication/1#/$defs/Request`；候选字段和闭合 Page Schema 从 S2 生成文件加载，不依赖 TypeScript 运行时。应用独立检查精确引用、参数声明/绑定/保留值、等值与多值提取类型、共享范围、差异和错误引用，并消费相同向量验证关联一致性。null 既有参数须额外读取可信精确源、验证原文 hash 和完整页面，再核对原声明与绑定；缺边界即关闭该路径。

模型只见引用、操作状态、摘要、计数和程序令牌；完整候选、参数值、差异与回执进入身份作用域程序输出。人工证明来自独立 HumanConfirmationPort，模型无法通过工具创建证明或把任意 proof 写进请求。发布前比较身份、候选/source、原文与十一字段审阅摘要、算法身份、保留选择和租约。最终权限/head/版本/期限/证明撤销/租约原子消费由服务权威完成。

每类写入均先查询完整原命令指纹，仅权威 not-applied 且 retrySafe 才提交。回执丢失、格式/关联不符、程序输出失败保持 unknown 与原 operationId；原 token 查询可恢复。已完成重放不重新人工确认、不再消费租约或写模板，但仍需当前结果读取权限。取消或身份切换不授予新身份读取旧结果的权限。

## 实际自动化结果

运行环境：`/private/tmp/metriccanvas-126-delivery-python/bin/python`，Python 3.12、依赖沿锁定版本；共享环境只读。

| 检查 | 最终实际结果 | 日志 |
|---|---|---|
| 全部 Python test-harness | 280 tests，全部通过 | `/private/tmp/s4-publication-evidence/final-python-280.log` |
| 新发布应用/共同向量 | 18 tests，全部通过；69 个结构向量、其中 48 个关联向量全部与 S2 expected 一致 | `/private/tmp/s4-publication-evidence/application-18.log` |
| 新公开 MCP/真实 stdio | 3 tests，全部通过 | `/private/tmp/s4-publication-evidence/stdio-3.log` |
| 最终 Bundle | 1,919 项摘要通过 | `/private/tmp/s4-publication-evidence/bundle.log` |
| 隔离安装后发布工具 | 3 tests，全部通过，含安装后的真实 stdio/生产 CLI | `/private/tmp/s4-publication-evidence/installed-publish-stdio.log` |
| 隔离安装后原草稿工具 | 2 tests，全部通过 | `/private/tmp/s4-publication-evidence/installed-lifecycle-stdio.log` |

回归命令：

```sh
/private/tmp/metriccanvas-126-delivery-python/bin/python -m unittest discover -s metriccanvas-authoring/test-harness/tests
```

关键覆盖：prepare→读取完整候选→人工 H1→修正保留选择/取消 segment→新版本→旧 H1 拒绝→人工 H2→发布→原操作重放；未确认/伪证明/跨身份/审阅改变/算法降级/旧源/租约及期限拒绝；三类写入的回执丢失；输出写失败；pending/unknown/不安全 not-applied 零提交；同键换载荷冲突；原成功结果在草稿前进/候选过期后仍不可变且受当前权限保护；未知选择/任意补丁/非法页面/不支持提取拒绝；独立生产进程无发布依赖时明确关闭。

测试替身 `test-harness/publish_stdio_server.py` 仅承载外部边界模拟：固定非空合法候选、登记式人工事件、完整命令指纹、明确测试摘要算法和服务结果。它不是参数提取算法或 Java 发布事务交付，不进入生产包。

## 分发与隔离安装

`uv build --offline --sdist metriccanvas-authoring/tool --out-dir /private/tmp/s4-publication-evidence/dist` 成功；使用锁定依赖环境，通过 `uv pip install --offline --no-deps --target /private/tmp/s4-publication-evidence/installed` 安装该源码包，没有修改共享环境或访问包注册表。

- 包：`metriccanvas_authoring-0.2.0.tar.gz`，116,277 bytes。
- SHA-256：`f2a0fe845e6b2d653f97fc4a5984d1ac11249f070a0c657f693160ad3bb7e549`。
- 51 个 Python 源文件与最终工作树逐字节相同；自有请求 Schema、共同闭合 Schema、最终 contract-lock 与包内文件逐字节相同。
- 源码包不含 test-harness 或测试服务；生产 CLI 在独立 cwd 启动，所有九工具存在，未配置发布端口返回 CAPABILITY_UNAVAILABLE。
- 机器记录 `/private/tmp/s4-publication-evidence/package.json`；构建/安装日志位于同目录 `build.log`、`install.log`。
- S2 对 a15730f 实测 91 TS tests（publication 72、reference/isolation 19）、类型检查、export --check 471/4/1 通过；S4 本树独立运行 Python、Bundle、打包和隔离安装检查。没有把 S2 结果描述成 S4 重跑结果。

## 三类证据边界

1. **本仓消费实现**：上述工具、程序通道、共享契约、最终生成及隔离安装检查已经运行。
2. **外部提供方确认**：没有新增 Java/Relay SDK 或 HTTP 协议的提供方确认，测试不证明外部契约已保证强幂等、可信人工证明或原子发布。
3. **真实 Java/Relay/盘古联调**：未运行。S1 的界面验收和整票汇合另行交 S0；本证据不声称 #145 整票完成。
