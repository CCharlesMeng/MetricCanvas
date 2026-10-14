# 单表搜索与 Excel 导出接入

页面声明见[表格协议](page-metadata/components/table.md#右上角搜索与-excel-导出621)。HTML 与 Svelte 运行时直接呈现入口，集成应用无需为每张表注册 Excel 下载回调。文件编码复用 ExcelJS 4.4.0，客户端执行且不依赖 CDN；库按需初始化，HTML 单文件发行仍将代码放入同一产物。

## 查询搜索接口

生效查询新增可选 `search: { queryFields: string[]; query: string }`，字段已由共享查询执行模块按 `queryField` 映射。查询分页、排序和原有筛选仍同时保留，匹配总数必须由数据网关返回。内联与显式完整查询结果在客户端搜索，不改变共享数据源快照。

`createDqeGateway` 的可选 `encodeSearch` 消费已经应用其他筛选、排序和分页的 DQE 项，返回增加搜索条件后的 DQE 项。编码器必须与当前服务协议匹配，保证多个字段 OR、与已有条件 AND、字面量匹配和大小写规则；不能拼接未经转义的用户输入。原页面查询定义保持不可变。

```ts
const gateway = createDqeGateway({
  endpoint: existingEndpoint,
  headers: existingHeaders,
  encodeSearch: (item, { queryFields, query }) => {
    // 使用当前 DQE 服务已核验的结构化编码函数。
    return verifiedDqeSearchEncoder(item, { queryFields, query });
  }
});
```

`verifiedDqeSearchEncoder` 为集成应用按实际协议提供的函数，上例不是某个已存在的 DQE 请求字段。本仓尚未获得当前真实 DQE 文本包含的编码证据；默认网关遇到搜索时在发出请求前拒绝并报告 `DQE_CONFIG_ERROR`。搜索入口保留，用户可清空搜索恢复查询。

自定义 `dataGateway.fetchData` 可直接消费 `search`，但必须在完整查询作用域中搜索后分页并返回匹配总数；不能忽略该属性或者只在已返回窗口中匹配。

## 完整导出

每张表单独捕获查询作用域和视图状态，逐页获取全部匹配结果；只执行该表及其查询结果绑定、计算依赖。业务明确的有限选择保留原范围，查询分页视角中的表格导出展开该表全部匹配页，依赖的上游分页输入保留捕获窗口。正文报告的既有完整导出范围保持原语义。

准备阶段最多60秒、每个结果最多10,000行。取消不依赖网关一定响应 AbortSignal；页面更新、销毁及取消后不会发起下载。编码在准备阶段之后执行，也遵循取消信号；浏览器下载发起不代表操作系统已完成保存。

不同表的搜索与导出状态按组件 id 隔离。查询搜索需要独占该查询页面数据源，完整结果的本地搜索可共享同一份数据快照。

## 证据边界

本地可验证协议、内联搜索、框架无关的查询搜索状态／字段映射、注入式网关搜索、完整分页取数、实际 `.xlsx` 下载、取消与静态导出。真实 DQE 的文本谓词编码及生产接入仍需请求／响应验收，不能以本地注入网关代替。
