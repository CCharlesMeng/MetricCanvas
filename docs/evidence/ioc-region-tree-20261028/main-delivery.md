# IOC Header Region 修复的 main 交付

日期：2026-10-28。交付检出：`/Users/moon/.codex/worktrees/ioc-region-main/DataDashboard`，基线 `9b5706086bc6b0630c5c45ea7a1465d5a6034ad3`。

## 范围

共享 FilterBar 和 HierarchyFilter 曾把未声明的 hierarchyPicker 填成 tabs，导致地区部／代表处按钮出现在区域下拉前面。现在显式单选层级筛选省略 hierarchyPicker 且 display 为 select/tree 时使用一个树形下拉；一次提交原始业务值和所属层级。候选完整性、同码跨层、禁用与过期值分别校验。真实结构树沿用显式父子关系，旧候选按声明层级分组，不虚构业务归属。显式 tabs/hidden、多选及原有 leaf 等选择策略保留。

同步五张存量页面遗漏的单选声明、两个既有浏览器用例、页面元数据文档与 local-authoring 作者说明。安装包从 main 当前 1.5.0 升为 1.5.1，从本检出真源重新生成产品契约、MC 内容、Skill 知识和分发锁；诊断夹具由生成器更新内容身份。

5210 服务工作树 `hierarchical-row-expansion` 的基线 `8a1332ad0` 含尚未合入 main 的表格层级功能。本次只交付共享 IOC Region 修复；该分支专属的 hierarchy-gateway、HTTP 表格用例和表格 README 修复保留在原服务工作树，未把整批表格功能混入 main。main 的正式验收页面使用已有 `ioc-header-standard` 和 `ioc-header-business-tree-demo`。

## 当前基线验证

- `pnpm test` 指定区域树、筛选栏、地图、普通树、Selection、运行时构建和 IOC 批量声明七个文件：51 项通过。
- `pnpm test` 指定 local-authoring 工具、表格创作、Skill、升级和参考五个文件：189 项通过。
- 导出隔离检查的旧单入口和包版本重生成两项通过（80.41 秒，原 90 秒子进程门限）。首次遗漏 Python 环境变量而缺依赖，使用锁定环境复跑后通过；全量隔离场景交由本提交 CI 验证。
- Engine、Playground 的 check 及根 tests/tsconfig.json 类型检查通过；Svelte 为零错误、零警告。
- `pnpm validate`：126 张完整页面通过。
- `authoring:contracts:check`：1256 product / 4 authoring / 1 interface 文件一致。MC 覆盖检查、33 项 MC Python 测试、诊断夹具检查通过。
- local-authoring 1.5.1 整目录复制到仓外 `ioc-region-main-skill-u6foyge3/metriccanvas-local-authoring`，六张受影响完整页面校验通过；189 项测试同时覆盖安装目录闭合和哈希。
- 生成与 MC Python 检查使用主工作区锁定虚拟环境。初次 MC 覆盖探测遗漏环境变量，系统 Python 缺少 fastmcp；补全 METRICCANVAS_PYTHON 后相同检查通过，没有改产品代码。

## main 浏览器复验

临时端口 5212 仅服务上述 main 交付检出。打开 `/pages/ioc-header-business-tree-demo`：外部没有层级按钮；展开北部地区部、直接选择北京代表处后，URL 为 `region=same&region.level=office`，表格收到 `office_code=same`，弹层关闭。初始为 `department_code=same`，同一业务代码的层级和查询字段正确切换。截图为 [main-region-selected.png](main-region-selected.png)。本场景使用内置合成数据，不代表真实 DQE、Relay 或 DS 验收。

## 复杂度

实测口径 metriccanvas-ts-ast/1、TypeScript 5.9.3，逐函数 selfCC。Svelte 仅提取脚本测量，模板另外审阅。完整结果见 [complexity.json](complexity.json)。

- HierarchyFilter.chooseLevel：2 → 2；既有脚本回调 1/2 均保持。
- 新增 hierarchyTreeSnapshot 11、hierarchyTreeOptions 9、hierarchyTreeSelection 6、usesHierarchyTree 4、hierarchyTreeStatus 3；其他辅助函数及回调 1–3。
- 新增 HierarchyTreeFilter.commit 4、值映射回调 1；新增测试回调最高 7。
- 两个既有浏览器用例只修改断言，相关回调复杂度保持。FilterBar 透传、Schema 注释与 Selection 模板提示文本没有增加可执行函数分支。
- 新增和修改函数全部 ≤15，没有本批未关闭项。

主工作区的并行修改及 5210 活动服务保持原状。远端 SHA 和 exact-SHA CI 在提交推送后单独核对；本文件记录提交前输入和验收，不以本地通过替代 CI。
