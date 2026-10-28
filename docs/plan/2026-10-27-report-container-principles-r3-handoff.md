# 容器原则与完整创作流程独立评测R3

用户已授权新开会话进行评测。请在新会话直接执行：从原始业务需求生成一张Report，自行完成浏览器预览、修复和复验，并在本会话正常交付结果。Report形态已确认，不再询问形态。

## 只消费这些输入

根目录：`/tmp/report-layout-independent-20261027-r3`。

- `inputs/business-brief.md`：业务任务。
- `inputs/business-data.json`：唯一原始合成事实，SHA256为`1a471be298cc92fe05617aec3d53843188ab5a4ce151a78cf53a72771dd84308`。
- `inputs/metriccanvas-local-authoring/`：冻结完整Skill **1.5.0**，writer **6.69**。读取其SKILL.md并按任务路由执行。
- `inputs/mc-content/`：冻结MC **1-26a9a3b99149e272**；内容SHA256为`26a9a3b99149e27236a1f4c47ec3f8c302a05c453224c4e53f1589d33b1f9a14`。
- 原归档`inputs/mc-content.tar.gz`的SHA256为`63902cca3b3d803655134dc0c8d24c734fa32d89e770106720d6e2695fb90aaf`。
- `identity.json`及`input-sha256.json`记录版本与全部文件摘要。

仓库AGENTS.md仍适用。除运行环境与仓库必需工作约定外，创作知识仅从冻结Skill与MC消费；不读取旧临时页面、原型、此前复盘或验收报告、Codex记忆、父会话或`evaluator-only`目录。知识自带的参考案例是允许输入，应如实记录，并非未接触任何设计案例的盲测。

MC入口：`/tmp/mc-content-runtime-only/bin/python inputs/mc-content/scripts/mc_content.py query --topic layout --key report-composition`，路径按评测根目录解析。Skill提供独立Node校验器与知识查询脚本，无需另行安装依赖。只读需要的模块，保留实际知识读取记录与模型可见身份。

## 工作位置与授权

当前工作区：`/Users/moon/Documents/Code/公司项目/DataDashboard`；Playground服务：`http://localhost:5173`，由该工作区apps/playground提供，Git基线`9ee7e6ac611e5651046dde16f9b5fc44dc0974b1`，有并行未提交改动。沿用服务，不重启或改写并行配置。

页面id：`field-maintenance-report-202611-r3`。

页面文件：`pages/temporary/report-container-principles-20261027-r3/field-maintenance-report-202611-r3.json`。

浏览器地址：`http://localhost:5173/pages/field-maintenance-report-202611-r3`。

仅可新增／修改本次临时页面目录及评测根目录中的自己的outputs、knowledge、screenshots、attempt-*等证据。不得改产品实现、协议、Skill、MC正文、校验器或旧页面，不提交推送、全量导出、调用外部模型API／DQE／Relay。非Page证据JSON放评测根目录，或使用`.json.txt`后缀，避免进入页面发现。

## 完整执行

从业务输入开始自行规划、创作；不指定章节数、卡片数、组件排布或预期布局答案。遵循冻结Skill的创作、快照、校验和预览修复流程。

第一次完整JSON必须先原样快照至新的attempt-01，再完整校验。后续每次完整输出修复均另建attempt-02等快照，保留前一版与问题原因，禁止最终产物回填首版。最终页面允许更新为最新版本，但所有原始证据保留。

本轮允许并要求创作者自行查看、操作自己页面，检查并修复自身声明可解决的呈现问题。新开浏览器标签只访问本次地址，不查看其他业务页面；使用支持的浏览器工具。按1440、1280实际CSS视口预览，读取实际innerWidth核实，不仅记录viewport调用参数。保存首版及最终截图、控制台和相关交互证据；无本次业务交互需求时不新增交互凑场景。

数据期望需从原始输入独立计算，不从生成结果反推。核对原始事实、变化、比例刻度、范围与原因文字，数据与视觉结论分别报告。可以迭代页面，但不能用修改标准、编造事实或删掉需求来关闭问题；能力或环境不足时明确未关闭项，继续完成其他可验证部分。

## 正常交付

在新会话给出实际页面链接并展示最终截图；报告首版与最终的静态、数据、视觉结论，以及修复次数、原因和剩余问题。页面目录README写清服务工作区／端口、inline性质、操作及证据边界；附可读机器验收，保留输入版本、知识记录及所有尝试快照。

首版质量、自助修复能力、最终结果分别记录，不用无溢出代替视觉判断。单个新业务案例不构成泛化或因果A/B证明。无需向其他聊天发送消息，在本会话正常结束即可。
