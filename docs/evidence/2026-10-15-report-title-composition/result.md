# Report 主标题随时间筛选变化

2026-10-15，本地实现完成，未提交、推送或部署。

页面协议6.23增加 `{parts:[字符串、参数引用或筛选引用]}`，所有既有文本取值位置共用。单层1—64项，按序连接，不自动添加分隔符。参数固定于打开时；筛选读取已应用状态。任一可选参数片段缺值时整段属性/数组项移除，必需标题不能依赖可选参数。组件仍只消费字符串；导出捕获静态文字。既有字符串和整值引用保持原语义。

## 功能与验收入口

| 范围 | 产物 |
|---|---|
| 声明、校验、物化与运行时投影 | packages/page/src/{page-param,filter-text-value,text-value,version}.ts、schema/primitives.ts；复用统一运行时现有筛选订阅与导出路径 |
| Python创作期预检 | metriccanvas-authoring/tool/metriccanvas_authoring/pages/validation/{filter_text_values,page_validation}.py |
| 完整页面 | pages/report-title-filter-example.json，无业务数据、无外部查询；注册于页面试验场功能演示 |
| 既有查询演示 | pages/report-date-filter-example.json，保留原查询与绑定，仅版本和主标题改为组合；数据依赖本地DQE Sim |
| 协议模块 | PAGE-METADATA.md、PAGE-PARAMETERS.md、docs/page-metadata/params-and-text-values.md、components/reportHeader.md、reference-map.json |
| 决策 | ADR-0109；修订0047/0100，更新主题页与索引 |
| 产品契约与Skill | contracts/metriccanvas、contract-snapshot、两个Skill参考、本地独立校验器和知识/Bundle锁，从产品真源生成 |

页面试验场入口：`http://localhost:5173/pages/report-title-filter-example`。

## 已执行的验证

- `pnpm --filter @metriccanvas/page check`、`pnpm exec tsc --noEmit -p tests/tsconfig.json` 通过。
- 页面协议全部测试、筛选文字与组合运行时测试、公开面门禁：59个文件、535项通过。最终公开面与组合专项再次通过。
- `pnpm --filter @metriccanvas/embed build` 通过。
- `pnpm --filter @metriccanvas/embed exec playwright test tests/browser/report-title.spec.ts --output=/tmp/metriccanvas-report-title-browser`：1440与390宽度两项通过；直接加载pages中的完整页面，不在测试中拼接功能配置。覆盖初始标题、未应用草稿、月份变更、范围、同起止、多筛选正文、清空、参数名称不变、导出标题及无横向文字溢出。已查看窄屏截图；见 browser-1440.png、browser-390.png。
- `pnpm authoring:contracts:check` 通过：651 product、4 authoring、1 interface文件。导出在独立源码快照 `/tmp/metriccanvas-report-title-sync` 执行，再同步生成目录；保留工作区其他任务的源文件改动。
- `tests/local-authoring-skill.test.ts`、`tests/page-reference.test.ts` 最终12项通过，包括独立校验器与契约向量一致性、文档链接闭合和产品/Skill投影一致。
- `tests/authoring-export-isolation.test.ts` 首次全量19项中17项通过，另外2项因并行修改产生生成漂移失败；重新同步后这2项定向复验通过，见 export-isolation-recheck.txt。
- 使用Bundle锁定依赖运行Python `test_page_validation.py`：最终14项通过，含全部共享合法/非法向量、6.23版本门禁、空结果、可选参数片段与规范化保存。
- 复制整个本地Skill到仓库外 `/tmp/metriccanvas-report-title-installed-skill`，新标题页面与既有日期查询示例均通过独立Node校验器；见 installed-skill-validation.txt。
- `python3 metriccanvas-authoring/scripts/check_bundle.py`：2412项摘要检查通过。`pnpm adr:index:check` 通过。

契约生成期间补齐一个既有反例所需的显式 `nullable:false` 和一个文档锚点；共享工作区数值容错调整了原始查询行的结构校验位置，相应旧反例匹配已随当前真源同步。没有改动该任务的数值容错逻辑。

## 未通过的其他检查与证据边界

- Embed全量测试类型检查仍在 `packages/embed/tests/browser/paged-join.spec.ts:20` 报TS2769：回调把含string的行标成 `Record<string,number>`。本次浏览器测试没有类型错误，未修改该并行任务的测试。见 parallel-embed-typecheck.txt。
- 系统Python缺少jsonschema/httpx等依赖；已改用 `uv run --no-project --with-requirements metriccanvas-authoring/tool/requirements.lock` 运行。首次全量541项有4个失败，其中本次的2个组合版本门禁问题已修复，当前页面预检14项通过；另外2个查询数值容错反例由并行任务更新为合法结果向量后，当前构建验收26项全部通过，见 python-building.txt。本次没有重跑完整Python套件，不能把定向回归表述为全量绿。
- 本次验证的是页面协议、确定性创作预检和浏览器交互/静态导出；未运行真实DS模型、真实DQE/Relay/Java集成或生产部署。日期查询示例保留DQE Sim入口，主标题变化不作为真实数据变化的证据。
