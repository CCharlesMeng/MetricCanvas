# local-authoring 旧页面继续开发

2026-10-23；隔离工作树 `schema-skill-upgrade`，起点 `ea40f664`。本批是创作期显式升级，不改变运行时的可读版本、Schema字段或能力下限。

## 行为

Skill编辑已有页面前先检查upgrade-page回执。可升级时写入全新目录，保留原文件精确字节、SHA256、升级结果和迁移报告，再接回工作文件完成原任务；当前合法文件直接继续。整页升级被阻止而原件有效时，原版本支持的局部需求保留原版本继续开发。CLI默认只检查，只有显式指定out-dir才写文件，不覆盖原件或已有尝试。

初始基线的候选版本为5.0—5.4、6.0—6.51，仅写6.51；交付同步后按产品当前版本6.55生成，候选范围相应扩展至6.55，仅写6.55。覆盖旧布局、5.x导航与四类旧图表筛选。完整目标校验前检查原始能力下限。图表身份、筛选器、默认值、查询绑定、数据及initial不被替换为演示值；组合卡内旧图表筛选、语义缺口和非法配置明确拒绝，不输出半成品。

## 交付同步

提交前同步origin/main至`db88ab9411cac5726aa41c86620fe5ca9c325457`。仅生成索引和哈希发生冲突，保留双方产品与流程真源，再完整生成1116项产品契约。新Skill与示例写出6.55；新增对象查询保留与旧版本能力下限回归，确认不会用旧分发覆盖最新对象查询能力。

同步后按项目命令`pnpm test`运行7个相关文件，184项通过；`authoring:contracts:check`、TypeScript及3825项Bundle摘要检查通过。实际Playground重启并复测标题、原数据及升降序，console无error/warn，截图更新为同步后的页面。

## 验证

- `tests/local-authoring-upgrade.test.ts`及version/layout/filter-group回归：128项通过。覆盖原始字节、哈希、不写输入、输出目录冲突、未知/未来版本、降级、非法字段、能力下限、四类图表、生成id冲突、显隐、语义断点、保留合法旧版继续局部开发，以及升级后继续修改再运行仓外校验器。
- TypeScript：`pnpm exec tsc --noEmit -p tests/tsconfig.json`通过。
- 独立安装：完整Skill复制到仓库外，只用Node运行升级及validate-page；不依赖源码、npm、Python或在线工具。
- 生成脚本篡改检查：`tests/authoring-export-isolation.test.ts -t upgrade-page`通过，损坏生成脚本会被契约漂移检查拒绝。
- 完整authoring:check初跑148项通过、2项在30秒子进程上限超时（同机同时有其他隔离工作树运行导出）；没有放宽上限，单独重跑这2项及新增脚本漂移场景，3项全部通过。最终local-authoring工具、安装、升级、参考文档及相关协议边界共7个测试文件178项通过；最终authoring:contracts:check通过。
- 分发：同版生成知识、脚本及哈希；`check_bundle.py`通过3747项摘要检查；Skill quick_validate通过。
- 浏览器：实际服务cwd为此工作树的apps/playground，端口5191。访问`/pages/schema-upgrade-demo`，显示后续修改的页级标题和“继续开发：GMV”，原金额为6,323.0亿。升序为华南、华北、华东，降序相反；无console error/warn。截图见[Playground](playground.png)。

## 复杂度

使用仓内`metriccanvas-ts-ast/1`、TypeScript5.9.3，测量每个函数自身CC，排除嵌套函数体并单独测量闭包。完整数据见[实测](complexity.json)。

新增代码无原函数基线：upgradePageDocument=12，sourceVersionErrors=6，semanticMigrationErrors=5，convertChart=7，upgradeChartFilters=1；CLI options=11、runUpgrade=8、main=6。全部新增辅助函数及测试回调不超过15。

修改的存量buildSkillProjections为53→53，仅向既有生成脚本数组与排除清单增加成员，没有新增可执行分支。为避免扩大分发生成器行为变更，本批不拆分此存量超限函数；后续入口为既有复杂度治理计划。生成器隔离回归约束作者文件保留、生成漂移和锁一致性。修改的既有测试回调CC保持。

## 保留的边界

- 6.5/6.6非空数组参数仍需显式迁移旧写入语义；6.13/6.14页头filterIds自动期间文字仍需明确等价引用和无值文案。工具报告字段路径，不自行改变这些行为。
- 原6.0页面仍不直接进入运行时；只有显式升级的新页面可读。现有历史修订与发布身份不原地改写。
- 静态与内联浏览器验证不证明真实DQE/Relay、业务数据、部署路径或真实模型表现。未执行线上发布、push或CI。
