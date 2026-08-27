# DataDashboard(MetricCanvas)· 仓库 baseline 入口

目标 app:`apps/canvas`。本目录八份规范文件是仓库级唯一事实源;`archive-legacy-single-file/` 是旧形态产物,只作历史记录,不要当事实读。

## 场景索引

| 要做的事 | 读这些 ID |
| --- | --- |
| 加一个看板页面(页面文档) | `STRUCT-7`、`PATTERN-ROUTE-2`、`COMP-2`、`RUN-17`、`PATTERN-TEST-4` |
| 加一个宿主界面(新路由) | `ROUTE-1`、`ROUTE-2`、`ROUTE-3`、`ROUTE-4`、`PATTERN-ROUTE-3` |
| 加一个页面组件类型 | `PATTERN-COMP-1`、`STRUCT-2`、`PATTERN-STRUCT-3`、`COMP-1`、`COMP-3` |
| 改某个构件的渲染 | `COMP-1`、`PATTERN-COMP-2`、`PATTERN-COMP-3`、`PATTERN-STYLE-1`、`PATTERN-TEST-1` |
| 做列表 / 表格页 | `COMP-2`、`COMP-11`、`DATA-7`、`PATTERN-DATA-2`、`TEST-6` |
| 接一个新数据源 / 改取数 | `API-1`、`API-2`、`API-9`、`DATA-1`、`PATTERN-API-1`、`PATTERN-API-2` |
| 处理加载 / 空 / 错误三态 | `DATA-2`、`PATTERN-DATA-1`、`COMP-4`、`COMP-12` |
| 加筛选器或改筛选行为 | `COMP-6`、`DATA-3`、`DATA-5`、`PATTERN-DATA-4`、`PATTERN-ROUTE-4` |
| 做跨页下钻 / 回跳 | `ROUTE-5`、`ROUTE-6`、`DATA-4`、`PATTERN-ROUTE-1`、`PATTERN-ROUTE-4` |
| 报错要展示给用户 | `API-6`、`COMP-12`、`PATTERN-API-3`、`PATTERN-DATA-1` |
| 调样式 / 加设计档位 | `STYLE-1`、`STYLE-2`、`STYLE-3`、`PATTERN-STYLE-1`、`PATTERN-STYLE-2` |
| 定某个视觉量是 token 还是字面量(写 `static` 针前必读) | `PATTERN-STYLE-5`、`STYLE-9`、`STYLE-10`、`STYLE-11` |
| 按设计稿还原 | `PATTERN-STYLE-4`、`STYLE-7`、`STRUCT-9`、`STYLE-6`、`PATTERN-STYLE-5` |
| 嵌入到第三方宿主 | `STRUCT-6`、`STYLE-5`、`PATTERN-API-2`、`TEST-7` |
| 写测试 | `TEST-1`、`TEST-2`、`PATTERN-TEST-1`、`PATTERN-TEST-2`、`TEST-10` |
| 起本地环境 / 跑质量门 | `RUN-1`、`RUN-3`、`PATTERN-RUN-1`、`RUN-16`~`RUN-19` |
| 表单 | `PATTERN-DATA-5`、`COMP-6` |
| i18n / 多语言 | `PATTERN-STRUCT-4` |
| 权限 | `PATTERN-DATA-6`、`PATTERN-ROUTE-3`、`PATTERN-COMP-4`、`PATTERN-API-4` |
| 埋点 / 监控 | `PATTERN-API-5`、`PATTERN-STRUCT-5`、`API-7` |
| 性能 / 体积预算 | `PATTERN-RUN-1`、`ROUTE-8` |

## 单点事实速查

| 问 | 去哪读 |
| --- | --- |
| 栈与形态是什么 | `structure.md` 的栈签名节 |
| 「消费单元」在本仓指什么 | `structure.md` 目录实况节 |
| 启动命令是什么 | `RUN-3` |
| 质量命令有哪些、第几版 | `runtime.md` 质量命令节 |
| 测试框架是什么 | `TEST-1` |
| 取数出口是什么 | `API-1` |
| 页面数据状态的类型定义 | `DATA-2` |
| 设计 token 前缀与真源 | `STYLE-1` |
| 构件里的字面数值算不算违规 | `PATTERN-STYLE-1` |
| 哪些 `--mc-` 名字有消费无定义 | `STYLE-9` |
| 页面文档放哪 | `STRUCT-7` |

## 文件导航

| 文件 | 判定问句 |
| --- | --- |
| `structure.md` | 这是什么栈、什么形态?代码放哪、怎么命名? |
| `runtime.md` | 怎么装、怎么起、跑哪些质量命令? |
| `components.md` | 拼界面时有哪些现成构件可用? |
| `routes.md` | 加一个页面 / 一条路由要动哪几处? |
| `api.md` | 怎么跟后端说话? |
| `data.md` | 拿到的数据在前端怎么持有、怎么流到界面? |
| `styles.md` | 样式值从哪来,允许怎么写? |
| `tests.md` | 测试用什么写、怎么定位元素、怎么跑? |
