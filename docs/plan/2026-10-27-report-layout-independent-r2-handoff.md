# Report创作独立评测R2交接

用户已授权“handoff一次，再进行一次独立评测”。本次由无历史上下文的独立创作者执行，不继承此前布局讨论、旧页面或评测答案。使用新业务输入，Report形态已确认。

## 冻结输入

输入根目录：`/tmp/report-layout-independent-20261027-r2/inputs/`。

- `business-brief.md`：唯一业务任务说明。
- `business-data.json`：原始合成事实，SHA256为`c4aad5ebd939b9d6e06b83961a4dc155e651478241e91dc3e6ba0322fc7b9350`。
- `metriccanvas-local-authoring/`：完整冻结Skill，版本1.4.1，writer6.69。
- `mc-content/`及原始归档：MC内容版本`1-972222e3488e9c2c`，内容SHA256为`972222e3488e9c2c16f63073615df55c9b71fe0b617b8fc79a3fd2a5e037e8ac`。
- 归档SHA256：`dba75396826c5ec67399a2a3b034c4b1b5267c14d1da8a80d6b98f1e4cbdd6fc`；所有输入文件摘要记录在根目录`input-sha256.json`。

阅读仓库AGENTS.md，然后只从冻结Skill及MC内容查询入口读取创作知识，按需阅读业务输入。MC CLI入口为`inputs/mc-content/scripts/mc_content.py query --topic layout --key report-composition`；Python运行依赖可用`/tmp/mc-content-runtime-only/bin/python`，缺失时用项目已安装的`metriccanvas-authoring/tool/.venv/bin/python`。

## 独立创作任务

工作目录：`/Users/moon/Documents/Code/公司项目/DataDashboard`，沿用当前5173服务。

创建页面id `operations-october-independent-20261027-r2`，最终文件位置：`pages/temporary/report-layout-independent-20261027-r2/operations-october-independent-20261027-r2.json`。

只根据业务输入创作一张正式Page JSON。章节、表达、容器、组件和比例由创作者自行选择。可以使用冻结Skill合法示例理解协议，不能读取旧临时业务页面、原型、之前的复盘／验收报告、Codex记忆或本次`evaluator-only`目录。冻结Skill本身包含的参考案例属于本轮知识输入，应如实记录；不把本次称为未见过所有布局知识的盲测。

1. 记录实际读取的知识主题、运行模型可见身份及输入版本。
2. 工作文件先生成在根目录`outputs/`。第一次完整JSON输出必须先用冻结Skill的snapshot-attempt.mjs保存至新建`attempt-01/`，再校验；每次修复都产生新快照，不覆盖原始失败版本。
3. 完整校验使用`--expected-layout report`。仅修复自己的页面；不得改产品实现、协议、Skill、MC标准或校验器。
4. 将最终合法页面复制到上述唯一页面目录，写简短README说明入口、数据性质、采用的组织与未验收项。非页面证据JSON留在评测根目录，或使用`.json.txt`后缀。
5. 返回所有快照、校验回执、最终文件、输入／知识读取记录及自评。浏览器的独立复核由交接方在完成后进行；创作阶段不查看现有浏览器标签页或旧页面。

不提交、推送、清理其他工作树，不运行全量导出，不调用外部模型／DQE／Relay。数据完整性、业务计算与布局阅读效果分别判断。首版和修复后结果分别记录；禁止用最终产物回填首版。

## 独立复核与交付

交接方在创作前从原始输入生成验收期望，存于创作者不可消费的`evaluator-only/`。创作结束后核对原始数据、计算、口径、真实组件与布局，并在1440／1280实际CSS视口检查截图、表格、图例、最长原因及控制台。

本次只证明冻结内容对一个新业务案例的创作结果，不构成因果A/B比较或普遍稳定性结论。交付实际页面URL、截图、首版及最终结论、失败项与局限，保留所有上轮页面和证据。
