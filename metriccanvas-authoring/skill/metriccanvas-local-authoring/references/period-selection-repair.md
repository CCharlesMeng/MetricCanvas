# 期间选择定位与修复

用户说“季度选择怎么调整”“选季仍传 month”或“引擎已更新但季度请求没变”时读取本文。目标是让每个受影响查询按其业务用途消费已应用期间，并用实际请求证明结果。

先读精确主题 `query.period-policy`，完整语义见[查询独立期间策略](page-metadata/queries-and-bindings.md#查询独立期间策略)。本文提供定位顺序与最小修复方法；协议语义以该参考为准。

## 定位精确页面与查询

1. 锁定正在预览或部署的页面文件、Page.id、修订与运行时版本。区分用户原稿、升级候选和实际加载的文件；记录当前已应用的期间选择及一次原始 execute 请求。
2. 核对筛选声明是否为 `timeRange + display:"period"`，以及查询实际消费的 filter id。已有 `iocHeader` 只证明页头形态；普通查询的默认期间规则与控件放置位置无关。
3. 对照请求定位页面数据源及当前查询分支，读取其 `source.query.filterBindings` 和 `body`；`queryModes` 各 case 独立检查。盘点同一筛选影响的其他查询，避免只修一张卡片而遗漏明细或汇总。

## 根据绑定选择修复

| 查询现状与业务意图 | 处理 |
|---|---|
| 普通指标需要跟随年／季／月选择，但绑定显式写了 `periodPolicy:{kind:"fixed",period:"month"}` | 显式 fixed 优先于引擎默认。对这些查询移除该策略，保留普通 `{target:"time"}` 绑定；月趋势、月账期明细等仍需固定粒度的查询保留策略。 |
| 普通指标已是 `{target:"time"}`，选季仍传 month | 先核对实际加载的文件、已应用 selection、查询分支及运行时版本。当前规则会覆盖查询体的旧 `filter.time.period`；旧原始 month 本身不等于显式 fixed。页面与运行时证据齐全后再定位执行链，交由产品维护流程修引擎。 |
| 显式 `kind:"selection"` 的 supportedPeriods 不含 quarter | 保留能力拒绝，先确认服务是否支持季度。依据已验证的数据能力调整声明；服务不支持时交付缺口，不以 month 替代季度请求。 |
| 6.101 对象查询应按标准账期消费年／季／月 | 使用 `{target:"time"}`；引擎生成周期类型与账期，单期等值，多期闭区间。固定粒度或受限粒度复用 periodPolicy，仅支持年季月。 |
| 自定义账期或日期使用 `queryField + valueFormat` | 保留字段和格式，按所选期间传起止边界；对象查询不改成 `filter.time.period`，也不叠加 periodPolicy。 |
| 查询使用 `periodComparison`、`timeModes` 或 `window` | 沿用对应比较或窗口契约；其月／日编码不能仅因页头选季就判错。按[查询定义](page-metadata/queries-and-bindings.md)进入相应分支。 |

普通指标的最小修改位于原 filter id 下。例如用户确认季度汇总应查季度时：

```json
{"period":{"target":"time","periodPolicy":{"kind":"fixed","period":"month"}}}
```

改为：

```json
{"period":{"target":"time"}}
```

这类页面修复复用现有协议与引擎能力，无需新增字段、升级 Schema 或修改引擎源码。保留指标、维度、`queryField` 映射、`is_aggregate`、排序、分页及对象关联；修复范围按业务用途逐查询确定，不批量删除页面全部 fixed 策略。按入口要求保留升级原件和修复前快照。

## 用实际 execute 请求验收

完整校验修改后的目标文件，然后在实际预览中选择一个确定季度，例如 2026-Q3，核对对应请求：

- 跟随选择的普通指标：`filter.time:{period:"quarter",start:"2026-Q3",end:"2026-Q3"}`。
- 明确固定月的趋势：保留 `period:"month"`，覆盖 `2026-07` 至 `2026-09`。
- 标准对象期间：第四季度发送 `周期类型 = quarterly` 与 `账期 = 2026Q4`；近一年按 monthly 与 YYYYMM 闭区间。只在 6.101 及以上使用，不把旧字段日期绑定静默改义。
- 自定义账期为 compact 日期的对象查询：保留 `filter.fields` 中 `账期 >= 20260701`、`账期 <= 20260930`；其他格式按原声明编码。

对所有受影响的普通查询核对同一选择；切换年、月及近一年时按期间参考检查请求，固定月与自定义字段的例外保持。可对照 Playground `quarter-query-period`、`period-query-defaults-legacy`，但目标页面自己的 execute 才是本次修复的传参证据。

页面无数据仍可验证请求已发送及请求体。若主表失败或成功返回空集合，按关联规则可能不会发起补列请求；将这一边界写清，不能用手工补发的请求冒充页面执行。DQE Sim 的拒绝只证明仿真未覆盖；真实服务是否支持季度、字段与业务口径需分别验证。

完成时报告：根因落在页面配置还是执行链、修改的查询范围、修改前后请求、静态校验与实际 HTTP 结果，以及是否修改引擎或 Schema。只有控件选中“季”、JSON 校验通过或代码已合入 main，都不足以宣称季度请求正确。
