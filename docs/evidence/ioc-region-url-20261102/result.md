> 本记录描述已撤回的显式映射实现。当前正式方案为 IOC Header 默认识别，页面不需要映射字段；见 [当前验收](default-result.md)。

# IOC Region URL 输入验收（2026-11-02）

用户确认：地区部和代表处使用不同参数名，参数值为候选稳定值；同时出现时取第二个。本批明确实现为 URL 从左到右最后出现的同组参数生效，交换顺序会交换生效层级，重复同名键同样取最后项。

本地基线为 `origin/main` 检出 `bf2cc88ebc257a328bf74dbe41b60143f0755df3`。修改位于独立工作树 `/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard`；主工作区的既有未提交内容未并入本批。本批没有提交、推送、CI 或部署证据；工作树保留用于审阅和后续交付。

## 正式声明与行为

Schema 6.79 的 Region 声明增加：

```json
{
  "urlParams": {
    "byLevel": {
      "region-dept": "region-dept",
      "office": "rep-office"
    }
  }
}
```

`byLevel` 的键引用 `hierarchy[].id`，值是 URL 参数名；仅支持显式单选层级。16 个现有活动 IOC 示例同步声明映射，新建 1 个完整中文合成场景，共 17 页；临时快照未批量改写。部分示例内部地区部层级名为 `department`，显式将其映射到同一公开参数 `region-dept`，未从业务编码猜测层级。

- `region-dept=中国地区部&rep-office=上海代表处` → office/上海代表处，查询使用代表处字段。
- 反向顺序 → region-dept/中国地区部，查询使用地区部字段。
- 值支持中文、连接符及 URL 特殊字符，须精确匹配当前完整候选的稳定 value。
- 存在新参数时整组新输入优先于旧 value/level；没有新参数时旧链接继续读取。映射层级的非空选值回写时只输出对应新键，删除同组其他新旧键，保留无关 URL 参数。
- 未传 URL 使用原页面初值。可选树显式清空时保留旧 level-only 格式，以免刷新重新套用默认节点。最后新参数值为空时不回退到前一个节点，严格模式报输入错误；未知/无权限候选继续阻断查询和导出。
- 全局等未映射层级保持旧 value/level；未声明 byLevel 的普通维度不改变行为。候选获取及业务查询仍通过既有网关和 levelQueryFields，未实现新的真实组织服务。

## 页面、文档与 Skill 对应

- 完整运行输入：`pages/capabilities/filters/ioc-region-url-demo.json`；操作及异常输入：同目录 README。
- 页面入口：`/pages/ioc-region-url-demo?region-dept=中国地区部&rep-office=上海代表处`。本地预览启动于 127.0.0.1:5192，监听进程与工作树已核对，HTTP 返回 200；浏览器验收使用该工作树的独立 5183 端口。
- 产品文档：PAGE-METADATA.md、PAGE-PARAMETERS.md、docs/page-metadata/filters.md、actions-and-navigation.md；ADR-0124 及主题结论同步。
- Schema/版本能力、URL 全页唯一性校验、合法和非法契约向量、引用来源、页面推荐入口均同步。通用解析、回写、严格 URL 输入、导航目标投影和宿主共享状态使用同一层级参数规则。
- `pnpm authoring:contracts` 从真源生成 product/contract-snapshot/MC/local-authoring 投影；Skill 版本 1.15.0，Schema 6.79。生成一致性检查确认 1335 product、4 authoring、1 interface 文件当前。

## 实际执行结果

- 产品与 local-authoring 定向回归：236 个文件，主轮 235 文件/2232 项通过；剩余父子表用例因新断言误要求 URL 只有一个参数失败，实际还正确保留 year/product。修正断言后该文件单独复验 1 项通过，合计本批定向覆盖 2233 项。保留主轮日志 `regression.log` 和最终单项日志 `hierarchy-regression.log`。
- 选择范围：packages/page/tests、packages/engine/runtime/tests、packages/data-execution/tests、apps/playground/tests，以及 local-authoring-skill/tools/upgrade/row-expansion、page-reference、public-api、repair-page-metadata、skill-release。早期全仓 pnpm test 在同步新契约及旧断言过程中停止，不作为全仓通过证据；不声称全量测试或 CI 通过。
- Playground Chrome：`PLAYGROUND_CLOUDIOC=false pnpm --filter playground exec playwright test tests/region-url.browser.ts`，9/9 通过。使用实际页面及合成网关，断言中文节点、两种顺序、重复键、旧链接、页面默认值、真实生效查询字段/值、改选后 URL 清理、无关参数保留、清空及刷新、无效输入门禁。[截图](region-url-chinese.png)已查看。
- 打包 embed Chrome：`MC_EMBED_EXAMPLE_PORT=4195 pnpm --filter @metriccanvas/embed exec playwright test tests/browser/key-office-filter.spec.ts tests/browser/navigation.spec.ts`，15/15 通过，覆盖共享 true/false、候选失效、清空、导航与浏览器返回及导出。
- `pnpm build:packages`、`pnpm --filter @metriccanvas/embed build` 通过。
- `pnpm --filter @metriccanvas/engine check`、`pnpm --filter playground check`、tools/tsconfig.skills.json 和 tests/tsconfig.json 的 tsc 检查通过。
- `pnpm authoring:contracts:check` 通过，见 `contract-check.log`。生成使用本机已安装 fastmcp 的 Python 环境，通过 METRICCANVAS_PYTHON 指定；系统 Python 缺包不作为产品失败。
- 仓外完整复制 Skill 后，在独立目录及仅 PATH 环境下执行版本、合法中文示例和非法未知层级；分别为退出 0、0、1，错误定位 `/filters/0/urlParams/byLevel/missing`。结果见 `standalone-skill.json`。local-authoring 测试另覆盖链接闭合、清单哈希和完整契约向量与产品校验一致性。
- `git diff --check` 通过。

## 复杂度

口径为 `metriccanvas-ts-ast/1`、TypeScript 5.9.3，函数自身 selfCC，闭包和回调独立测量；Svelte 仅测 script 块，模板不冒充 TS 覆盖。编码前识别 URL 键所有权、选择解析、序列化和导航校验职责，并测量基线；完整修改/新增函数记录见 `complexity.json`。

| 函数 | 修改前 | 修改后 |
|---|---:|---:|
| filterURLKeys（迁入 filter-url.ts） | 19 | 15 |
| readDimensionFilter | 10 | 12 |
| filterSearch | 14 | 14 |
| restoreSingleSelections | 7 | 8 |
| filterInputIssue | 8 | 11 |
| resolveNavigationTarget | 31 | 7 |
| readLevelURLSelection | 新增 | 5 |
| levelURLMappingErrors | 新增 | 8 |
| appendDimensionURL | 新增 | 9 |
| explicitMappingIssue / mappedLevelIssue | 新增 | 10 / 11 |
| requiredFilter / timeMappingIssue | 新增 | 4 / 8 |
| createFilterState（仅内部恢复闭包改变） | 17 | 17 |

本批新增函数及回调均 ≤15。未关闭项：createFilterState 自身存量 17 未增长；本次只改其 URL 单选恢复闭包，候选收据、事务提交和异步协调拆分会扩大行为范围，保留后续复杂度治理。相同文件内其余未修改存量函数不在本批重构范围。导航拆分保留既有输入问题的检查优先级，不把时间校验提前到必需输入检查之前。

以上均为本地、合成数据或独立安装校验；未执行真实组织/权限服务、真实 DQE/Relay、线上部署或 DS 模型验收。
