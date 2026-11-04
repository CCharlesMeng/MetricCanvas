# IOC Header 筛选接线

用户确认：重点国代勾选后忽略 Region，使用当前用户有权限的全部重点国代；上游数据结构待定，由集成应用供给，与组织候选一样经过 Adapter 归一。本次不要求真实 DQE 新增重点标记字段。

MC 提供执行覆盖、逐页绑定和可复制的初始化桥接。集成应用负责真实组织、重点名单、权限、旧编码到中文名称的转换，以及页面装载、URL/共享状态输入。真实接口和 payload 不在本仓编造。

## 装载顺序

复制 `packages/embed/examples/ioc-header-candidate-bridge.ts` 到集成应用。它是示例文件，不是 `MetricCanvas.prepareIocHeaderFilters` 公共方法。TypeScript 示例的类型依赖为 `@metriccanvas/page/internal` 和 `@metriccanvas/engine`，编译后没有运行时依赖。输入使用已合法的页面文档，桥接不替代 `mount` 的完整页面校验。

```ts
const controller = new AbortController();
const prepared = await prepareIocHeaderFilters(document, dataGateway, {
  signal: controller.signal
});
const runtime = MetricCanvas.mount(element, {
  document: prepared,
  dataGateway,
  initialSearch
});
```

桥接只为 IOC Header 中显式 `overridesFilters:["region"]` 的 boolean 拉取完整授权重点名单，克隆原文档，再为所有消费 Region 的查询叶子补：

```json
{"key-national-only":{"target":"boolean","queryField":"代表处","whenTrue":["上海代表处","深圳代表处"]}}
```

`key-office` / `key-national-only` 等实际 filter ID 从文档读取，不假定各页相同。普通查询和 timeModes/queryModes 的全部分支都补；响应字段、原始查询、其他筛选、参数、initial、正文、动态文字保持原文。桥接不修改原输入。权限或名单变化时以新身份上下文重新获取并装载，不复用另一身份的文档/缓存；集成应用负责取消过期装载并保留当前筛选 search。

## 现有候选端口

上游服务 payload 可以继续待定。Adapter 将它转换成现有 `fetchFilterCandidates` 回执即可。重点名单请求示例：

```json
{"filterId":"key-national-only","dimension":"rep-office-name","constraints":{"dimensions":{},"times":{},"booleans":{"key-national-only":true}}}
```

请求不含当前 Region，不能据当前地区部/代表处截取名单。Adapter 返回当前用户有权限的全部重点代表处中文名：

```json
{"kind":"values","candidates":[{"value":"上海代表处","label":"上海代表处"},{"value":"深圳代表处","label":"深圳代表处"}]}
```

这是既有端口的归一形状，不是对尚未确定的公司服务数据结构作出约定。重点成员为完整平面列表，不带 level/parent；Region 组织树则继续使用完整层级、明确 parent 的原契约。名单最大10000项；重复、非法值和部分结构拒绝。Adapter 遇到上游分页必须收齐；无法保证完整时返回 `unconfigured`，不能把部分列表冒充完整。

`values + []` 代表获取成功且当前无授权重点成员。桥接生成 `whenTrue:[]`（Schema 6.84），勾选查询和导出为正常空结果，主查询与列候选均不发 HTTP。`unavailable/denied/unconfigured`、异常或取消则阻断准备阶段，集成应用展示状态并允许重试，不能用空名单替代。未经过桥接的原始模板若勾选且缺少替代绑定，引擎报 `DQE_CONFIG_ERROR`，不允许只去掉 Region 后查询全量。

## Region 与客户级别

Region 的地区部/代表处候选 value 和 parent.value 采用中文名称，与初始 URL、共享输入及查询值一致。`label` 只改变显示，不自动把编码转换为名字；旧编码 URL 需要集成应用从真实字典转换，不能猜测。候选 dimension ID 为 `region-dept-name` / `rep-office-name`，查询字段分别为 `地区部` / `代表处`。仅规范节点 `value:"全球"` 不生成 Region 谓词；中国/海外等节点仍按原字段和值过滤。上游全球编码通过同文件的 `normalizeIocRegionCandidates` 归一，并同步父引用；未归一的全球候选编码在业务查询前阻断。月份、客户级别、权限与固定条件保留。该执行规则不增加 Schema 字段。

客户类型/客户分类及机会清单的 NA 类型控件的界面文案保留，实际查询字段统一 `客户级别`。候选 dimension ID 继续沿用各页声明，由 Adapter 路由；不要将它和 DQE 字段名或控件 label 混为一谈。

共覆盖8个已有 IOC Header 页面、37个查询；含客户控件的6页共28处客户绑定。4个审批页从当前工作区原件复制后修改，原件字节随任务验收证据归档（`original-pages/`），不会覆盖原工作区并行工作。商务明细原有 `rep-office-name` 查询参数通过同名 initialParam 初始化 Region 的 office 层，避免双重绑定冲突。项目详情页没有 IOC Header/公共筛选，本次未迁移其身份或项目参数。

## 本地验收入口

`pnpm dev:playground` → `/pages/key-office-priority-demo?rep-office=南京代表处`。演示实际调用桥接和合成候选接口；勾选后显示跨地区的上海、深圳；取消后回到南京。目标页 `/pages/key-office-priority-target` 覆盖切页和刷新。页面 README 列出操作。旧 `key-office-filter-demo` 保留无覆盖关系的交集兼容验收。

这些证明本仓运行时、桥接、页面配置及合成数据行为；不证明 Operation Map 部署、真实 HeaderOptionService、DQE 字段支持或真实权限名单已验收。交付阶段基于最新 main 重跑验收；embed 分发与提交状态见同目录 verification.md。
