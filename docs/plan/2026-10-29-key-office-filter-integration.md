# 重点国代筛选集成实施计划

日期：2026-10-29。状态：本仓实现与本地验收完成；IOC Region 统一为 Header 单个树形下拉，普通维度筛选保留。真实宿主与真实服务接入待验。验收见 [结果](../evidence/key-office-filter-integration-20261029/result.md)。

规划基线为本地 HEAD d24a41721 及当前工作区；handoff 所指 bef3644a 在本地不可解析，本计划不声称复现该提交。当前源码已确认 boolean 候选依赖被语义校验拒绝，候选加载器重建约束时只保留维度与时间；最小状态探针确认未选代表处切换上游后仍会进入确认阻塞。

目标：重点国代勾选状态跨页保留，代表处候选随勾选联动，未选地区时禁止勾选，让用户切页不用重选，筛选后的查询范围符合预期。

## 范围与状态归属

本批覆盖 MC 的 boolean 候选依赖、候选交集处理、boolean 条件启用，以及宿主共享筛选值的接入示例和跨页验收。现有 boolean 控件、URL 编码和 boolean 查询绑定继续复用。

宿主保存需要跨页继承的值，页面各自维护 FilterState、候选回执和查询状态。共享值以 key-office、region、mtime 为首批示例，通过显式映射接入；页面不存在的筛选项不注入，页面私有值不回写。不同筛选器 id、维度或时间精度不能仅凭同名自动互认。

首期按宿主每次只展示一个活动 MC 页面设计：挂载时读取共享快照，页内变更时回写宿主；跨页和返回时继续执行这一流程。多个同时挂载页面的实时互控、外部 header 对已挂载页面的主动推送不作为本批默认能力；若集成确有此需求，需补充通用运行时输入契约及不重建页面的同步验收，不能把 initialSearch 描述成持续订阅接口。

本计划承接此次 handoff 中“宿主保留共享 header 状态”的要求；既有 [IOC 页头计划](2026-10-16-ioc-header-feature-plan.md) 的各页独立状态仍保持。共享 Adapter 是宿主可选接入，不引入引擎全局单例或 iocHeader.sharedStateScope。

集成侧负责真实 HeaderOptionService 映射、候选网关、页面业务查询字段和重点国代取值编码；本仓使用明确标注的合成数据验证。重点国代共享接入仅在双页示例中演示；IOC Region 声明按用户要求统一迁移，不开发新的“已选代表处优先于 boolean”协议。

## 行为约定

| 场景 | 目标行为 |
| --- | --- |
| 勾选重点国代 | 相关查询追加声明的重点国代谓词；代表处候选按当前地区和 boolean 收窄 |
| 取消勾选 | 省略 whenFalse 时撤销该动态谓词；候选恢复当前地区下的全部合法代表处 |
| 未选地区 | 勾选框可见且禁用；条件未知或错误也不允许操作 |
| 已勾选后清空地区 | 禁用本身只限制编辑，保留已应用值和谓词；若业务要求同时取消勾选，需另行明确清值规则，不从 enabledWhen 隐式推导 |
| 原本未选代表处，再切换 boolean | 候选成功且非空后继续查询，代表处保持不限，由 boolean 约束重点范围 |
| 原本已选代表处，候选变化后仍有交集 | 保留合法交集，按 boolean 与代表处共同约束查询 |
| 原本已选代表处，交集为空 | 清理失效选值并等待用户重新选择或显式清空；不自动扩大查询范围 |
| 候选为空、失败、拒绝、无配置或不可用 | 状态分别呈现，相关查询继续受候选门禁约束，不以静态名单或伪编码兜底 |
| 跨页与返回 | 当前共享值进入目标页；新页重新取得自己的候选回执后执行相关查询 |
| URL 明确传 false | 不被宿主保存的 true 或页面 default:true 覆盖 |

初始化优先级：合法的 URL 显式筛选输入 > 适配后符合目标声明的宿主共享值 > 页面默认值。非法输入沿用目标页的输入校验纪律；strictURLInputs 页面明确拒绝，不用宿主值掩盖错误。execution 引导的执行快照仍遵守既有权威输入契约，不借共享状态改写快照条件。

共享更新只处理当前页明确接入的公共项：false 必须保留，显式清空必须回写，目标页没有声明的项不得被当作清空。URL 中的其他页面参数继续保留，历史记录恢复与跨页继承按显式输入优先级处理，避免回写循环。

## 页面声明提案

以下是实施用最小完整页面提案，全部维度、指标和查询字段为合成标识，不代表真实 DQE 契约。新能力暂按 6.75 规划；实施前复核当前版本，若已占用则使用下一可用次版本。当前 6.74 尚不支持该 boolean 候选依赖和 enabledWhen 声明。

```json
{
  "schemaVersion": "6.75",
  "id": "key-office-filter-demo",
  "layout": "dashboard",
  "meta": {
    "title": "重点国代联动 合成数据"
  },
  "filters": [
    {
      "id": "region",
      "type": "dimension",
      "dimension": "demo_region",
      "label": "Region",
      "selection": {
        "mode": "single"
      },
      "display": "tree",
      "treeSelection": "level",
      "hierarchy": [
        {
          "id": "region-dept",
          "dimension": "demo_region",
          "label": "地区部"
        },
        {
          "id": "office",
          "dimension": "demo_office",
          "label": "代表处"
        }
      ],
      "defaultLevel": "region-dept",
      "candidateContext": {
        "filterIds": [
          "key-office"
        ],
        "reconcile": "intersection"
      }
    },
    {
      "id": "key-office",
      "type": "boolean",
      "label": "仅看重点国代",
      "enabledWhen": {
        "filter": "region",
        "part": "values",
        "op": "isNotEmpty"
      }
    },
    {
      "id": "mtime",
      "type": "timePoint",
      "granularity": "month",
      "label": "数据月份"
    }
  ],
  "iocHeader": {
    "identity": {
      "title": "重点国代联动"
    },
    "filterIds": [
      "key-office",
      "mtime",
      "region"
    ]
  },
  "dataSources": {
    "offices": {
      "fields": {
        "office": {
          "type": "string",
          "role": "dimension",
          "queryField": "demo_office"
        },
        "amount": {
          "type": "number",
          "role": "measure",
          "queryField": "demo_amount"
        }
      },
      "source": {
        "type": "query",
        "query": {
          "language": "dqe",
          "body": {
            "dsl_list": [
              {
                "output_dims": [
                  "demo_office"
                ],
                "output_metrics": [
                  "demo_amount"
                ],
                "filter": {
                  "dims": [],
                  "metrics": []
                },
                "order": {}
              }
            ]
          },
          "filterBindings": {
            "region": {
              "target": "dimension",
              "levelQueryFields": {
                "region-dept": "demo_region",
                "office": "demo_office"
              }
            },
            "key-office": {
              "target": "boolean",
              "queryField": "demo_key_office",
              "whenTrue": [
                "true"
              ]
            }
          }
        }
      }
    }
  },
  "sections": [
    {
      "id": "results",
      "components": [
        {
          "id": "office-table",
          "type": "table",
          "layout": {
            "span": 12
          },
          "data": {
            "main": "offices"
          },
          "props": {
            "rowKey": "office",
            "columns": [
              {
                "title": "代表处",
                "field": {
                  "data": "main",
                  "field": "office"
                }
              },
              {
                "title": "金额",
                "field": {
                  "data": "main",
                  "field": "amount"
                }
              }
            ],
            "toolbar": {
              "export": {
                "format": "xlsx"
              }
            }
          }
        },
        {
          "id": "next-page",
          "type": "button",
          "layout": {
            "span": 12
          },
          "props": {
            "label": "切换页面",
            "action": {
              "navigate": {
                "href": "/pages/key-office-filter-target"
              },
              "on": "click"
            }
          }
        }
      ]
    }
  ]
}
```

mtime 的共享与时间精度另由跨页目标页面覆盖，继续使用现有时间点声明。Region 只保留 IOC Header 的一个组织树。地区部和代表处在树内选择，不再声明独立 rep-office 筛选；候选按各 level 返回完整结构，明确父节点，不能照搬 handoff 中缺父节点的回执。

## 实施批次

| 批次 | 实施内容 | 完成判据 |
| --- | --- | --- |
| P0 基线与契约 | 确认独立实施检出、公共项映射、URL 优先级、清空语义及新能力版本；准备完整页面、双页宿主夹具和合成候选 | 原有缺口能被确定性复现；声明及接入方式可供评审 |
| P1 跨页共享接入 | 用现有 initialSearch 与 filter-change 制作宿主 Adapter 示例；每次挂载按目标声明投影共享值，两个挂载入口复用同一逻辑 | 勾选、取消、地区和月份在前进及返回时正确继承；显式 URL 优先；无循环回写和私有值泄漏 |
| P2 boolean 候选链路 | 放开 boolean 候选依赖校验；扩展 constraints.booleans；贯通请求生成、加载器及缓存；修正交集状态处理 | boolean 到达真实注入的候选 Adapter，候选和查询门禁按行为约定变化 |
| P3 boolean 条件启用 | 复用 enabledWhen、统一条件求值及现有只读约束；覆盖渲染和用户交互入口 | 未选地区时鼠标及键盘不能勾选；选地区后可勾选；条件变化即时生效 |
| P4 验收与分发 | Playground 双页浏览器验收、页面协议参考、能力门禁、local-authoring 与 MC 内容生成及仓外安装 | 同批能力、文档和创作分发闭合；本地与真实集成结论分别记录 |

### P2 的具体修改面

- `packages/page/src/filter-dependencies.ts`：candidateContext.filterIds 的允许类型增加 boolean，保留未知引用、重复、循环和详情私有作用域校验。不是只修改候选请求。
- `packages/data-execution/src/ports.ts`：constraints 新增可选 booleans，键为筛选器 id，值为 boolean；未引用的筛选器不传递。
- `packages/data-execution/src/filter-candidates.ts`：收集依赖 boolean，保留 false；依赖上下文身份区分 true、false 和缺席。
- `packages/engine/runtime/src/dimension-values.ts`：loadFilter 重建 constraints 时保留并规范化 booleans；覆盖取消、迟到响应、缓存及重试。`candidate-session.ts` 现有完整请求键继续复用，验证不串候选。
- `packages/engine/runtime/src/filter-state.ts`：区分原本未选与已有选择失效；保留候选门禁、显式确认及依赖递归失效。不把候选为空解释成“不限”。
- 默认值保持兼容：default:false 当前不生成初始筛选项；URL/用户操作产生的显式 false 继续保留。Adapter 在此业务中将缺席和 false 都解释为不限制重点名单，不擅自全局改变初始化逻辑。

### P3 的具体修改面

boolean 声明的领域类型与 Zod Schema 接入 enabledWhen，继续使用现有 Condition。引用与作用域校验、能力版本检测、纯展示投影及 boolean 控件消费同一条件结果。无条件时保持现有可操作行为；deny、pending、error 均禁止编辑，保留相应原因。

`BooleanFilter.svelte` 接收求值后的禁用结果；`FilterBar.svelte` 及 RuntimeSurface 的用户写入入口同时遵守条件和现有全页只读约束。初始化、URL 恢复与宿主初值不被当作用户点击拒绝，仍校验类型、声明和候选合法性。enabledWhen 不参与查询谓词生成，也不隐式清值。

## 集成侧调整清单

1. 公共宿主 Adapter 对接 HeaderOptionService 的共享值，在两个 MC 挂载点复用。明确业务字符串 0/1 与 MC boolean 的转换，不按 JavaScript truthiness 把字符串 0 转成 true。
2. 候选 Adapter 先取得当前身份和地区下的完整合法代表处集合，boolean=true 时再按重点名单收窄；false/缺席时返回全部合法集合。按稳定编码关联，避免用显示名猜归属。
3. 确认重点名单和业务查询谓词口径一致，确认真实 queryField 和取值编码。whenTrue 是字符串数组；数值型 1 也须按查询服务确认的字符串编码处理，不写成 JSON 数字数组。
4. 页面按统一声明接入 filterBindings 与 candidateContext；新链路验收通过后移除 applyKeyRepOffice 和手写 REPOFFICE_CODE 拼接，不保留两套条件同时生效。

## 验收矩阵

| 范围 | 必须覆盖 |
| --- | --- |
| 声明与版本 | 新合法声明、旧版本拒绝新能力、未知依赖、错误类型、循环、重复及跨详情私有作用域 |
| 候选请求 | true、false、缺席；多个依赖及传递依赖；未声明依赖不外传；候选缓存不串值 |
| 候选与查询 | 无已选项、交集保留、交集全失效、候选为空、失败、取消、迟到回执、重试；只刷新消费相关筛选的数据源 |
| 禁用 | 无地区禁用、有地区启用、鼠标、键盘、条件错误与未知、全页只读；禁用前已有 true 保留 |
| 跨页 | 来源页、目标页与返回；true/false/清空；URL 覆盖共享值；目标页没有对应项、不同 id 映射、维度或精度不兼容、挂载销毁 |
| 数据与导出 | checkbox、候选、请求谓词、表格结果及导出条件一致；不能仅证明控件变化 |
| 创作分发 | 正式参考正文、完整示例、知识生成一致性、独立安装后的合法与非法页面校验 |

拟新增页面为 `pages/capabilities/filters/key-office-filter-demo.json` 与 `key-office-filter-target.json`，直接入口 `/pages/key-office-filter-demo` 和 `/pages/key-office-filter-target`。模拟数据放在 `apps/playground/fixtures/key-office-filter/`，用地区 A/B、重点/普通代表处构造独立期望值。目录 README 写明启动、共享宿主接入方式、操作步骤和预期结果。浏览器验收读取相同页面声明，嵌入宿主夹具验证真实 mount/destroy 和跨页过程。

## 工程检查与完成口径

本批已进入独立工作树实施，修改范围与本地验收记录见对应 evidence。实施前按 [复杂度规则](../agents/code-complexity.md) 测量 filterExtensionErrors、filterCandidatesRequest、loadFilter、FilterState 的 invalidate/candidate/commit 及新增 Adapter 逻辑；修改后逐个比较，包含闭包和全部辅助函数。新增函数 selfCC 不超过 15；修改的存量超限函数优先降低相关职责复杂度，未关闭项列出前后值和原因。Svelte 脚本与模板分别核对，不冒充完整 AST 覆盖。

实施完成按 [功能与协议能力验收要求](../agents/feature-acceptance.md) 同步 PAGE-METADATA、filters、conditions、嵌入与宿主接入文档、Schema/能力边界及 local-authoring。从产品真源运行 authoring:contracts、authoring:contracts:check、mc:content:check ，并在仓外独立安装校验；当前隔离基线无 skills:check 脚本，使用现有 local-authoring 测试及独立安装验证；相关单元/集成、类型、构建和浏览器检查按实际修改面执行。不追加真实 DS 模型验收。

当前工作区存在大量并行修改。进入编码和分发生成前，在合适的独立检出承接已确认基线，明确所需未提交依赖，不整体复制当前脏工作区或把其他任务派生产物归入本批。提交/push/清理按 scoped-main-delivery 单独授权和收口。

规划阶段已提取上面的完整 JSON：移除拟新增能力并回到 6.74 后，现有结构通过 parsePage；保留提案时当前运行时按未支持版本和字段拒绝，符合尚未实施的状态。该检查只核对已有结构，不代表新能力或真实查询验收。

实施证据拟保存在 `docs/evidence/key-office-filter-integration-20261029/`，分别记录静态/确定性测试、Playground 与嵌入浏览器、合成数据、真实 DQE、真实宿主集成和 Git/CI 状态。宿主原仓接入和真实服务未运行时明确记为待验，不以本地模拟验收替代。
