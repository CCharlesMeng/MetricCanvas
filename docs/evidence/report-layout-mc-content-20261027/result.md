# PC Report 审核结论接入 MC 创作内容

日期：2026-10-27。根据用户最终确认，将11项通过的章节组合及C3-B排除结论纳入创作流程，主要更新mc-content。本轮只更新内容、流程入口与生成覆盖，不新增页面字段、渲染样式或compose_page装配能力。

## 使用入口

单一作者正文：[PC Report章节组合](../../../tools/mc-content/layouts/report-composition.md)。MC可通过 `query_content('layout', 'report-composition')` 或包内CLI读取：

```sh
python mc-content/scripts/mc_content.py query --topic layout --key report-composition
```

Report新建／章节重组按“阅读任务与已有数据 → 组合选型 → 实际工具能力核对 → 装配 → PC实际预览复核”推进。局部字段修改沿用现有结构。指引明确主辅归属、原因就近、分组表头、紧凑构成、概览／明细选择；C1-B本期默认色、变化值完整红绿，C4-A小环图不独占通栏，C3-B排除。

## 真源与消费链

| 位置 | 本轮变化 |
|---|---|
| tools/mc-content/layouts/report-composition.md | 唯一维护正文；11项适用条件、调整边界及PC核对步骤 |
| MC layout/report、layout/reading及两类Report场景 | 指向该正文，不复制规则；新资源进入query索引及完整性覆盖检查 |
| Platform创建流程及兼容参考 | 创建前读取，核对当前工具支持面；取得预览后按阅读效果核对 |
| local-authoring Report范式入口 | 按需读取生成的references/page-patterns/report-composition.md，正文与MC相同 |
| SOURCES与维护说明 | 声明单向投影，维护者在MC作者源修改，不在安装副本另写规则 |
| 审核页及审核来由 | 最终11项通过、C3-B留档；审核过程不再作为另一份持续维护的规则真源 |

四份正文（作者源、MC、Platform兼容参考、本地Skill）的SHA256一致：`c54645a86a9fe52a0ef8b06fd3c1d9f30f10fcee0f901d038e78cdd3b334275b`，正文6233字节。local-authoring为兼容的新增参考／流程升版至 **1.4.0**，页面Schema沿用当前 **6.69**。

## MC内容身份与独立包

- 当前工作目录MC内容版本：`1-82287d016985e73d`。
- 内容SHA256：`82287d016985e73d0179b3135b10f03c4776157c61f3a41ad265ebcd69b72095`。
- 独立包：`/tmp/report-layout-mc-content-20261027/final/mc-content.tar.gz`，相邻`.release.json`记录源码基线、未提交状态及源身份。
- 归档SHA256：`6395a8355554f8315dee029c8149bedcabf86039760145a66fd37edadd4fc72a`。
- Git基线：`9ee7e6ac611e5651046dde16f9b5fc44dc0974b1`，本轮尚未提交／推送，不据此宣称部署完成。

先在隔离检出实施与验证，再对35个本轮文件进行无冲突范围核对并同步到当前目录；当前目录重新生成MC源身份和诊断夹具。隔离检出的MC内容版本为`1-7759ef93d1a14ec3`，与当前目录的输入文件集合不同；两者参考正文及功能代码一致，当前分发以本节最终身份为准。并行Platform服务配置等文件不在同步范围。

## 验证

| 检查 | 结果 |
|---|---|
| authoring:contracts、contracts:check | 当前目录生成成功，1256项产品、4项创作、1项接口文件；漂移检查通过 |
| mc:content:check | 完整通过：源覆盖、33项MC回归、诊断及可见夹具检查 |
| MC覆盖负例 | 7项通过；新增遗漏report-composition时，即使重建自洽索引仍报覆盖缺口 |
| authoring:check | 隔离检出6个测试文件、219项全部通过，含生成漂移、作者参考保留、Schema升级与仓外校验；耗时776秒 |
| 当前目录local-authoring定向复验 | 34项通过，安装内容与隔离检出逐字节一致 |
| tests/tsconfig.json TypeScript检查 | 退出0 |
| check_bundle.py | 当前目录通过6165项摘要检查 |
| 仓外MC运行 | 只用包内声明的jsonschema依赖，解包后verify与新参考查询成功；隔离包纯文本编译ok，未自动补新章节，deploymentAlignment=not_run |
| 仓外local-authoring | 692个文件与当前本地Skill逐字节一致，独立Node校验器验证完整Dashboard示例通过，链接与知识哈希由本地Skill检查覆盖 |
| PC审核页 | 1440／1280最终11保留／1不采用载入，默认值颜色、四个变化值红绿、同排两构成卡、复制／刷新均通过；无页面或图表溢出、无pageerror |

首次mc:content:check中的诊断夹具仍引用旧MC内容哈希，按生成入口更新派生夹具后重跑完整链路通过。未删断言、未放宽检查。

## 复杂度与边界

口径为`metriccanvas-ts-ast/1`、TypeScript5.9.3：mcPlatformFacts自身CC **3→4**（新增投影和相对链接改写），localPagePatternOutputs **3→3**（增加同源MD投影），checkMcCoverage **10→10**（增加必达资源键）。新增TS测试回调均为1；新增Python查询测试使用Radon6.0.1，自身CC=1。没有新增业务算法或修改超限函数，无本轮超限未关闭项。预检发现未修改的export-authoring-contracts.ts/buildSkillProjections=52，属于存量，不扩展到本批重构。

原始日志、前后复杂度、独立安装、查询回执、分发包和截图位于 `/tmp/report-layout-mc-content-20261027`。本轮没有运行新的DeepSeek模型评测、真实DQE／Relay／Java保存或部署验收。

本次保留隔离检出 `/Users/moon/.codex/worktrees/report-layout-mc-content/DataDashboard` 供完整回归与原始生成身份复核；当前工作目录已同步本轮范围。未执行Git提交／推送，也未清理其他任务的分支或工作树。

MC仍提供事实与检查，Skill决定采用、替换、保存与交付。组合卡、页签、跨源同卡、分组表头和颜色属性要按本轮工具Schema分别核对；视觉审核不自动扩展compose_page支持面。中心合计、共享色板及局部尺寸的原型表现不冒充已落地的通用协议能力。缺少预览时记录视觉未验，不增加保存或发布门禁。
