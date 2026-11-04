# Relay 发行工程第二轮 C 线证据

本目录只报告 MC 侧源码和离线发行检查；无提交、推送、真实 Relay 或部署。

## 冻结源码

`source-manifest-v3.json` 列出 27 个 ownedFiles 的 SHA、六项 package.json scripts 局部更新及旧 C 依赖。父会话拥有全局生成器、依赖/锁、协议/ADR 和统一候选。v3 相对 v2 仅修资源保留测试并补 tools/relay-reference/README.md；v2 相对 v1 仅增加两项核心测试配置。

## 结果

- 46 项定向测试通过：归档 11、消费者 10、后处理桥 4、资源 2、发行结构 19。CI 结构测试 8 项通过，原生 CI 尚未运行。
- 真实 r1 开发候选默认 Schema 6.82：旧 13 项操作完整描述预检查和 23 条实际调用通过。见 completion-r1-consumer.json。
- 仅六项依赖、仓外无关 cwd、Python -I -S：35 项实际产品自检、9 项缺项/禁网负例、23 条冻结回放通过。见 completion-r1-probe.json。
- 实际 compose.v2/edit.v2 经固定 CLI 返回 Node 呈现审计 findings/scope；原始行值保留、输入不变、edit 手工正文保留。见 completion-r1-postprocess.json。桥单测不作为此实际能力证据。
- 新资源元数据追加保留所有旧资源字节（index/manifest 除外）和全部旧 ID/path，重复发布同字节，reader 能按新增诊断查资源。新 summary 指向唯一 Interface Schema；runtime:coverage 明确保持旧 MC/source graph 范围。
- 修正资源索引测试：逐原 topic/key 比较 ID/path，逐资源比较 annotate 后真源字节，允许新增路由；index 自身和 manifest 允许变化。对真实 r1 candidate/ready 真源定向执行 1 项通过。
- 实际旧 r6 归档及来源核对成功，仓外 probe 通过：actual-pack.json、actual-archive-probe.json。r1 再按 ready 当前真源打包时，因构建后指南改变，来源门禁正确拒绝 ARCHIVE_SOURCE_DRIFT；completion-r1-package.json 记录具体文件。没有修改来源或候选来消除漂移。

## 复杂度

Radon6.0.1 测量 Python 自身函数 CC，另逐 AST lambda 测量，共 233 项，前次最大 11，本次最大 12，无超过15；修改的资源测试从2到5。TS 用 metriccanvas-ts-ast/1 / TypeScript5.9.3 测量，CI 测试回调最大3。逐项结果见 complexity-before/after 文件。

## 未关闭层级

主线已进 Schema6.83。旧0.1.0/6.82冻结样本 SHA f7df720d08a8334a1d976cc7f1c28c7a9f4a3dec1612da204dd59b420ac886e1 不变；6.83 首次采用还是兼容 writer 的语义由父会话等待人类决定。C 未增加默认放行、force 或重新录制。最终统一候选、来源匹配的归档、原生 Ubuntu/Windows Python3.12 Node22 CI、真实 Relay/部署均不能以 r1 的通过替代。

## 2026-11-04 用户决定后的首次基线收口

用户已确认6.83作为首次正式消费基线。source-manifest-adoption-v1.json仅列相对C v3的17文件精确delta及父旧SHA；旧f7、原compare_states/consumer.replay算法、真实四项字节未改。新固定consumer有35条（原23请求+新增6操作12正负样本），SHA9e0f9d...；中文/机器逐值审查与版本化记录均在fixtures/schema683-*，由config逐级固定SHA，无record/force功能。

实际新gate返回ok/initial-adoption，正式35/35通过；历史报告保留needs_migration/23中8差异/3契约原因，必须精确匹配审查才能打包。真实旧r6四项作为--current，实际CLI返回exit2，优先拒绝迁移，不运行初次聚合回放。见schema683-adoption-gate.json和schema683-adoption-reject-current682.json。

adoption-tests.log记录带实际候选的57/57测试，无skip；包含真实CLI对已验证6.82默认值current夹具的拒绝，归档回执完整保留历史失败及删除/变绿/其他候选反例。CI结构8/8通过；Ubuntu构建与Ubuntu/Windows最小依赖作业显式执行相同测试。实际r6历史实现验证与current结构夹具验证分开记录。

复杂度259个Python函数/lambda，max12（前233个max12），新policy最大12，CI回调max3；修改函数及全部新增函数前后值见complexity-adoption-delta.json。没有超15未关闭项。

正式来源匹配归档、归档仓外复验和可用性/本地测试报告由主控完成；原生CI、真实Relay与部署仍未由本地证据证明。详细汇总见adoption-verification.json。
