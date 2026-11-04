# 表格跨槽同名字段运行时修复

独立源清单为本目录 `source-manifest.json`，4 个文件；此前 25 文件清单及全部源 SHA 均保持冻结。主控 ready 工作树未修改，未提交或推送。

## 行为与证据

入口为 `http://127.0.0.1:5197/pages/relay-multislot-presentation`，使用原页面 JSON、同名 `main.amount` 与 `prior.amount`、内联合成数据。仅恢复 Table 基线实现在真实 Chrome 中复现 `each_key_duplicate`，key `amount`，indexes 1/2；见 `browser-before.json`。恢复修复后 Playwright 浏览器用例 1/1 通过，见 `browser-results.json` 与 `browser/` 截图：三列 colgroup/表头，表头及表体索引 0/1/2，末列表头唯一，a = 2.0百万/—，b = 3.0百万/1.0百万，无 pageerror。截图已人工检查。未修改数据字段名或合并数据源行来规避碰撞。

复用 page 的 `columnBindingKey`，静态字段以 slot+field 编码，byFilter 以 filterId 与排序后的 case 名/静态绑定编码；格式和对象插入顺序不构成身份。Table 的两处 keyed each、sticky offset、rateBar maxima 均使用该身份；表头索引及末列按实际叶子位置/对象判定。排序、筛选、候选和选择事件的 main 字段协议保持。

## 验证

- Vitest：`table-column-identity.test.ts`、`table-columns.test.ts`、`table-rows.test.ts`、`table-presentation.test.ts`，4 文件、20/20。新增用例直接读取原场景，通过 parsePage 并使用真实 engine layout/aligned values；另覆盖显式 main 与短写等价、槽区分、分隔符防碰撞、byFilter 对象重排/槽/分支/筛选器区分。
- `tsc --noEmit -p /tmp/relay-b-column-typecheck.json` 通过；别名指向本工作树 page 源码。
- 浏览器：`apps/playground/node_modules/.bin/playwright test --config /tmp/relay-b-column-browser.config.mjs`，Chrome / Svelte dev runtime，1/1 通过。临时 Vite 配置仅为本树 workspace 源别名与独立端口，不属于源码交付。

## 复杂度与边界

口径为 `metriccanvas-ts-ast/1`，TypeScript 5.9.3。Svelte 独立提取 instance script 测量，模板 each 不冒充 TS 函数覆盖。修改的 `columnBindingKey` 3→3，新增 case callback 1；stickyOffsets 派生回调 9→9，cellStyle 3→3，rateBarMaxima 派生回调 5→5，rateBarWidth 4→4。去除的表头 findIndex 回调为 1；模板自身只换身份/位置表达式。新增测试工厂 CC5，其余全部新增测试闭包 CC1。修改与新增函数均 ≤15，无本次未关闭项。

Schema 字段增减均 0。本次修复既有跨槽合法绑定的渲染实现，不新增作者协议或业务规则；复用原 Playground 及其 README。元数据索引/Skill/独立校验器继续由主控从最终产品真源统一生成，必须重新计算因通用 helper 源变化涉及的哈希。最终 embed 构建与分发门禁由主控集成批执行。这里是本地合成浏览器、引擎测试与类型证据，不证明真实 DQE、Relay、部署或 CI。
