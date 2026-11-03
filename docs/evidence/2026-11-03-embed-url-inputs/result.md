# Embed 自动读取 URL 输入

在独立工作树 /Users/moon/.codex/worktrees/embed-url-inputs/DataDashboard 实现，基线 2172df5450a09803685773ae5bc65df766168c98。本记录描述同一源码在提交前完成的本地验收；提交与远端 CI 结论按本批交付回执核对，Operation Map 部署未执行。主检出的并行未提交修改保留。

## 行为

embed 的 mount 与完整 update 在 initialSearch 为 undefined 时读取当前 window 的 URL。合并 location.search 和以 #/ 或 #!/ 开头的路由 query，同名 hash 键整组覆盖外层，保留重复值供原有单值/多值校验处理；普通锚点不作查询串。显式 initialSearch（包括空串）完全优先，空串禁用自动继承。只在挂载/更新时读取，不自动监听或写回 URL、不读取父窗口。直接 RuntimeView 输入方式、参数默认值/已填值及 execution.params 的权威性保持原规则。

新增私有 initial-search.ts 承接输入解析，index.ts 仅委托；不新增公开 API、页面字段或 Schema。正式页面 pages/capabilities/navigation/embed-url-params.json 为纯内联账号参数场景，/pages/embed-url-params?account-name=合成账号甲 可观察输入；examples/url-params.html 使用同一 JSON 和实际构建 ES 入口，不传 initialSearch，含 hash 路由的浏览器回放成功。展示场景不访问真实账号或 DQE；参数到查询条件另经既有 dimension-params-page 中的参数消费者和原生 DQE HTTP 网关合成响应验证。

## 验证

- 修改前构建的 ES 包在省略 initialSearch 时无法显示 URL 中的账号，浏览器用例精确失败；修改后 ES/global 正常。
- 18 项定向单元测试通过（14 个 URL 解析边界及 4 个原有参数用例）。
- 最终完整 embed 浏览器套件 261 项通过，包括新增 13 项、ES/global、完整目录复制、Webpack development/production、按需 Excel 导出及既有页面。
- 原生 DQE 网关合成 HTTP 验证：自动输入生成 region=EU/NA 条件，必需参数缺失后不发请求。未取得 Operation Map 的实际 URL/挂载代码，未做真实账号/权限/DQE验收。
- embed 类型检查无错误无警告；169 页面校验通过。Playground 正常查询串和构建 ES 包 hash 入口的实际浏览器场景通过，截图及报告见同目录。
- 官方生成一致性、MC 覆盖、52 项 MC 测试、布局夹具一致性通过；local-authoring 五套件203项通过，Skill 1.19.3 的独立归档与仓外校验通过。新增语义章节同步 reference-map 的主题分母；MC 布局展示的主题数由官方夹具更新为232。
- 构建、独立 check:dist 与实际 ZIP 全目录/逐文件摘要复核通过。14 个 JS，最大 excel~exceljs.min-CSE3Njtv.js 为929901字节；两个公共入口均满足门禁。ZIP 含 package.json 的 ESM 标记和全部 chunks。

复杂度口径：metriccanvas-ts-ast/1、TypeScript5.9.3，按 selfCC 独立计数所有函数与回调。runtimeInput 8→7；旧 normalizeSearch(2) 的职责并入新 resolveInitialSearch(6)，mount(3)及update回调(2)保持不变；本批所有新增/修改函数≤15，相关文件最高8，无超限未关闭项。HTML示例为无分支直线脚本，不虚构函数测量。

首次浏览器全套揭示旧导出用例依赖省略输入忽略上次 Tab URL；按其“新会话不打开总结”的原意改成显式空串，断言保持。原生网关测试使用已存在页面的独立参数消费者，避免将候选筛选器等待混入 URL 输入验收。最终261项全套通过，不将前次失败运行计为通过。

## 使用

替换宿主引用的完整 metriccanvas 目录（入口、package.json、chunks 均保留），让宿主重新加载新包。mount 可省略 initialSearch；显式 initialSearch 继续控制本实例。地址变化后若要切换账号，仍调用完整 runtime.update({document,dataGateway,...})；省略 initialSearch 时读取调用时 URL。
