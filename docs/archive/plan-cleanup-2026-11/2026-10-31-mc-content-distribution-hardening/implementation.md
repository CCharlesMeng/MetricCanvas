# MC 分发防护实施与验收

日期：2026-10-31。对应[唯一实施方案](../2026-10-31-mc-content-distribution-hardening.md)。本地实施与验收完成；用户已授权提交与推送，远端 CI、Windows 实机或 Relay 部署证据分别记录。

## 已实现

| 问题 | 实现与恢复边界 |
|---|---|
| 换行、BOM、缺失或额外资源 | 原字节 SHA256 保持；diagnose 给有界样例、总数、truncated、摘要及 action，提示保真整包重装；不修改 digest 或安装清单 |
| 编码与依赖 | CLI 与 Python↔Node 显式 UTF-8；按操作预检 Python、编译依赖与 Node；环境故障使用结构化错误，upgrade 60 秒、检查/知识读取 30 秒超时 |
| 缓存和加载来源 | 公共入口在导入资源前拒绝 pyc 和来自其他目录的同名模块；损坏的资源入口返回安装恢复诊断；API 必须在首次 import 前禁用字节码写入 |
| 安装与恢复 | 独立归档 verify；安装只创建新版本目录，验证后同文件系统落位，POSIX 目录设为只读；Windows ACL 和服务切换由部署方负责；旧目录保留 |
| 同步中断 | 保留原锁与临时文件，报告已完成/待完成项和原锁摘要；重试仍执行原冲突保护，不自动回写锁或删除未知数据；只有实际完成后才输出 applied=true |
| 归档与来源 | 归档/回执均拒绝覆盖；写出异常清理本次新建输出；回读实际归档与完整目录摘要，身份从暂存树读取；CI 拒绝 dirty/SHA 错配 |
| 二进制构建来源 | sourceIdentity 改为原字节 Buffer 哈希，新增真实导出链路的红/绿回归；原有图片和二进制附件不改动 |
| Git 与 CI | MC 作者文本 LF；摘要固定资源 -text 保真；新增 Ubuntu/Windows 实际下载、归档验证、中文路径安装和边界回归，加入总 CI 必需依赖 |
| 业务状态 | 保持旧计算命令退出码语义；样例检查 status、readable、truncated、correlation，不将退出 0 当业务成功 |

公开新增入口为 `mc_content.diagnose_package`、`mc_content.preflight` 与 CLI `diagnose`/`preflight --capability`，不新增 Relay Tool 或保存/发布 API。Node 环境错误统一使用 CONTENT_RUNTIME_UNAVAILABLE、CONTENT_RUNTIME_TIMEOUT、CONTENT_RUNTIME_OUTPUT_INVALID；编译依赖错误为 CONTENT_DEPENDENCY_UNAVAILABLE。调用方升级整包时应同步处理这些诊断。

Windows 版本目录落位使用 rename，利用其拒绝已存在目标的规则，不预先创建目标目录；POSIX 使用独占预留目录后替换。依据为 [Python 3.12 os.rename 文档](https://docs.python.org/3.12/library/os.html#os.rename)。Windows 分支模拟回归已完成红→绿；这不等于 Windows 实机验收。

## 场景、文档与 Skill

复用 `/pages/mc-content-layout-demo`：实际本地 diagnose/preflight 和临时副本 CRLF 注入生成三条诊断。浏览器只展示生成时快照；Python 回归和独立包探针验证真实文件/进程边界，二者分别报告。

页面元数据文档同步 `PAGE-METADATA.md` 与 `docs/page-metadata/validation.md` 的证据边界，没有新增页面字段或改变 Schema。local-authoring 的生成参考/知识/清单从同一真源刷新，完整安装目录版本 1.14.11 → 1.14.12；没有手改派生正文、追加其他 Skill 专项或调用真实模型。

## 本地验收

原始日志与截图位于工作树的 `artifacts/mc-distribution-hardening-20261031/`，不作为产品运行依赖。

- 已通过：同步中断、CLI 成功回执时机与内部 Adapter 保留回归 8 项。
- 已通过：MC 覆盖与 CI 门禁配置回归 12 项。
- 已通过：Chrome 三个产品场景；新增诊断行可见，表格排序和 1440/390px 页面滚动检查通过；390px 截图已用图像工具检查。
- 已通过：最终 MC 51 项，含损坏入口、写出故障、Git autocrlf 保真、缓存与编码边界、Windows 目录落位分支模拟；47.733s。
- 已通过：repair 类型检查与两个核心入口定向回归 16 项；完整 local-authoring 回归 6 文件、228 项，1375.92s。
- 已通过：二进制来源摘要真实导出链路追加定向回归 1 项（其余 30 项由 -t 跳过，不当作本次定向执行全部通过）。完整 Skill 命令在该增量前启动；最终增量以红/绿回归、生成一致性与最终包回验单独核对。
- 已通过：最终生成一致性、MC 覆盖、fixture --check、tests/tsconfig 类型检查与 git diff --check。
- 已通过：独立归档 pack/verify、只读新目录 install，以及安装副本 program-call 的 compile/inspect=ok、correlation=checked；均为本地合成证据。
- 已通过：最终 authoring Bundle 6462 项摘要；全部 748 个构建输入的原文件字节 SHA256 与 sourceIdentity 一致。

本地验证包 contentVersion 为 `1-06d7a9a91078169e`，2001 项资源，contentSha256=`06d7a9a91078169ee7157e0c709f580fc73c419da4995560a079460242216787`；归档 SHA256=`a04f2f05f6ab4dd3bc4a913373d1af1ee2d3a9a1111e0cc42e5df658f27a9ef2`。最终归档位于 `artifacts/mc-distribution-hardening-20261031/release/`。回执 sourceRevision 为本工作树基线，uncommitted=true，不能作为已提交正式发行或 CI 产物。Schema 仍为 6.77；基线包为 `1-7b108a9a50ef3d21`、1995 项，先前探查记录中的 1955 项属于其明确记载的更早基线。

曾发生一次生成器重写目录与夹具检查重叠，检查按预期拒绝了不完整目录。已等待生成结束后重跑并通过；构建/夹具消费需串行，运行进程不得使用正在重写的构建目录。

## 复杂度

使用 Radon 6.0.1，函数/方法及闭包独立测量，不含类聚合值。编码前保存作者源基线，并与同一工作树 HEAD 的原始版本对照；[逐函数完整前后结果](complexity.md)与 `complexity-after.json` 对应。修改函数与全部新增辅助函数均需 ≤15；未改函数不自动扩张为本批重构范围。

| 函数 | 编码前 | 编码后 |
|---|---:|---:|
| mc_resources.verify_package | 15 | 2 |
| mc_resources.manifest_files | 10 | 11 |
| mc_resources.node_content | 3 | 1 |
| mc_content.main | 10 | 13 |
| mc_content.upgrade_page | 4 | 3 |
| mc_inspection.inspect_schema | 3 | 1 |
| sync_upstream.plan | 20 | 5 |
| sync_upstream.apply | 6 | 8 |
| sync_upstream.main | 7 | 7 |
| mc-content-pack.pack | 3 | 5 |

新增辅助函数包括文件集合、变化提示、加载前检查、依赖探针、UTF-8 子进程、归档解包/校验/写出及版本落位，分别测量。Python 当前最大 15，新增最大 12。TypeScript 按 metriccanvas-ts-ast/1、TypeScript 5.9.3 测量，浏览器/CI/隔离测试/MC 生成器的文件最大 selfCC 分别为 2→2、2→3、4→4、9→9；修改的 hash/sourceIdentity 均为 1→1。原公共 Python 固定门禁 371 个函数、最大 15、0 超限已通过。本批未关闭超限项：无。

## 外部待验与恢复要求

- 当前工作基于独立工作树的提交 2133241a6b4f259fc19ff54bfdd9a0dcb9c96e06，包含本批未提交修改。原主检出及其并行修改保留。
- Windows CI 已配置，尚未运行；本机 GBK 编码模拟和 Git autocrlf 探针不能替代 Windows 实机。
- Relay 的真实包身份、Python/Node 路径、模块缓存、并发轮次、取消与切换恢复仍由现场验收。MC 不决定服务启用、业务保存或发布。
- source sync 仍是逐文件源码同步；中断树不得作为运行目录。恢复用备份或新目录，不宣称本批将其改成跨目录事务。
- 用户已授权提交与推送；交付使用 scoped-main-delivery，并重新核对远端与同 SHA CI。Relay 部署仍属于外部集成范围。
