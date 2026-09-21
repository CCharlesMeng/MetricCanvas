# 页面创作 v2：修订时序图与架构图

日期：2026-09-20。状态：用户确认方向后的目标设计；尚未实施。此次修正同一个 Agent 的职责表达、统一请求入口、数据修改回流，以及真实 Relay 占位符交付约束。

依据：[原始交互设想](../../调查报告/Agent交互逻辑.md)、[最小链路计划](./2026-09-20-authoring-minimal-flow-and-skill-plan.md)、用户本轮提供的实际 create Step 1–6。实际部署约束与影响见 [架构影响说明](./2026-09-20-authoring-relay-impact.md)。

## 1. 架构图

内部目录、模块依赖与变化场景的配套方案见 [创作模块架构调整识别](./2026-09-20-authoring-module-architecture.md)。下图显式保留预览交付入口，其成功之后仍须由 Relay 替换占位符，工作台才能消费预览。

```mermaid
flowchart TB
  W[用户 / 工作台] <-->|同一次请求：问题、页面、选中目标；响应与预览| R[Relay：请求上下文、产物注入、占位符替换]
  subgraph AG[同一个 Agent 执行范围]
    A[模型 + Skill：理解、计划审核、证据分析、工具编排]
    subgraph MC[MCP 工具能力：内部执行职责]
      T[五个业务入口：读取 / 发现 / 查询 / 新建 / 修改]
      D[数据发现与查询：精简投影、有界证据、结果引用]
      C[装配与局部编辑：整页校验、单份工作稿]
      S[提交快照、草稿保存、回执核对]
      P[page_metadata_emit_preview：现有 Relay 交付兼容入口]
      X[集中式外部协议适配]
      T --> D
      T --> C
      C --> S
      D --> X
      S --> X
      P --> O[本次 previewJson 对应的预览卡片]
    end
    A <-->|调用与摘要| T
    A <-->|预览交付调用| P
  end
  R <-->|问题与上下文、摘要、原样输出占位符| A
  R -.->|工具执行时注入可信上下文及匹配的产物| MC
  C -.->|document 与 previewJson，程序持有| R
  O -.->|替换预览占位符的内容| R
  X <-->|匹配、语义信息、DSL 执行、必要详情| J[Java 数据服务 / 现有 Lab、DQE 与详情提供方]
  X <-->|读取、草稿保存与修订回执| B[Java 页面资产服务]
  W <-->|筛选、排序、翻页：已有查询| J
```

这是职责图，不是进程部署图：模型和工具属于同一个 Agent 的执行流程，是否跨进程由实际部署决定。不要求工作台先独立调用 MCP 注入上下文。问题和页面上下文随同一次请求进入；身份由宿主取得，不能因同包传输而改成模型自报。

五个业务入口是目标分工，不是当前部署只能注册五个工具。`page_metadata_emit_preview` 作为现有 Relay 必需的交付兼容入口继续保留。保存内部化不代表删除占位符协议，也不代表工具直接向浏览器推送页面。

## 2. 首次构建与数据修改共用分析流程

```mermaid
sequenceDiagram
  participant W as 用户 / 工作台
  participant R as Relay
  box 同一个 Agent 的内部职责
    participant A as 模型 / Skill
    participant M as MCP 工具
  end
  participant D as Java 数据服务 / Lab / DQE
  participant B as Java 页面资产服务

  W->>R: 原始问题或修改意见 + 当前页面/选中目标
  R->>A: 同一次请求的问题、语义摘要及页面上下文
  Note over R,M: 每次工具调用时传递宿主身份与页面上下文，不由工作台预先另调 MCP
  opt 修改已有页面
    A->>M: read_page_context：读取相关配置
    M-->>A: 当前页面与所需配置投影
    A->>A: 从当前页面和修改意见提炼分析需求
  end
  Note over A,M: 数据修改回到下面的共同流程；纯样式修改走第 3 节短路径

  A->>M: discover_data_context：原始或提炼后的需求
  M->>D: 复用有效语义摘要，获取相关指标和维度，必要时补详情
  D-->>M: 匹配和定义信息
  M-->>A: 精简信息、缺口与冲突
  A-->>R: 推荐分析计划与需要用户确认的范围
  R-->>W: 展示计划供审核
  W->>R: 确认或调整计划
  R->>A: 已确认范围及当前请求上下文
  Note over R,M: 确认后的调用按新轮次核对上下文，可复用仍有效的信息

  A->>M: query_data：取数需求
  M->>D: 沿现有 Lab 链准备并执行 DSL
  D-->>M: 真实数据、实际字段与执行状态
  M-->>A: 有界证据、结果引用、实际范围与缺口
  opt 缺口明确且预算允许
    A->>M: 定向补查
    M->>D: 补充查询
    D-->>M: 结果或失败
    M-->>A: 补充证据与剩余缺口
  end
  A->>A: 依据证据确定页面表达，不编造缺失结论
  alt 新建
    A->>M: compose_page：结构计划与结果引用
  else 数据修改
    A->>M: edit_page：受影响部分与结果引用
  end
  M->>M: 装配或局部更新，保留未受影响内容，整页校验
  Note over M,B: document 是落库定义；previewJson 合并本次预览数据，initial 不落库
  alt 有合法有效变化，包含 partial
    M->>M: 冻结 document、基线和提交状态
    M->>B: 内部单次保存草稿定义
    B-->>M: 保存回执或错误
    M-->>A: 生成状态与保存状态分开，完成项与失败项
    M-->>R: 程序保留匹配的产物与保存引用
    alt 保存回执核对成功
      A->>M: page_metadata_emit_preview
      R->>M: 自动注入本次匹配产物，不由模型传完整 JSON
      M-->>R: 预览卡片及对应 previewJson
      M-->>A: 预览准备结果
      A-->>R: 最终响应原样输出 RESPONSE_START 与 PAGE_METADATA_PREVIEW_JSON 占位符
      R->>R: 按现有协议替换预览占位符
      R-->>W: 渲染草稿预览，显示完成项和失败项
    else 保存失败、冲突或结果未知
      A-->>R: 响应标记与真实错误状态，不宣称草稿已保存
      R-->>W: 展示状态；保留工作，不自动重发未知写入
    end
  else 全失败、无变化或整页校验失败
    M-->>A: 不新增保存，返回原因
    A-->>R: 响应标记与说明
    R-->>W: 展示结果或必要澄清
  end
```

图中的占位符文字是简写，实际响应必须使用第 5 节的双大括号原文。工具调用和系统注入是同一次调用的内部步骤，不是模型先发空参失败后再补注入。

数据修改回流包括需求提炼、指标信息、计划审核、查数与分析；复用有效信息不等于跳过业务审核。最终局部更新，不强制重建整页。纯文本创建不机械执行数据发现和查询。核心证据不足时停止依赖它的结论；合法部分内容可以保存并明确未完成。

## 3. 样式修改短路径

```mermaid
sequenceDiagram
  participant W as 用户 / 工作台
  participant R as Relay
  box 同一个 Agent 的内部职责
    participant A as 模型 / Skill
    participant M as MCP 工具
  end
  participant B as Java 页面资产服务
  W->>R: 样式或配置修改 + 当前页面/选中目标
  R->>A: 问题与请求上下文
  A->>M: read_page_context
  M-->>A: 相关配置
  A->>M: edit_page：局部修改
  M->>M: 更新工作稿，整页校验，冻结有效修改
  M->>B: 内部保存草稿 document（含合法 partial）
  B-->>M: 保存回执
  M-->>R: 本次页面产物与保存引用
  M-->>A: 生成与保存状态、完成与失败项
  Note over A,R: 成功后复用共同的 emit_preview 与占位符交付流程；失败不宣称成功
  A->>M: page_metadata_emit_preview（系统注入匹配产物）
  M-->>R: 对应预览卡片
  M-->>A: 预览准备结果
  A-->>R: 两个原样占位符与说明
  R-->>W: 替换占位符后展示预览
```

该图展示保存成功路径；全失败、无变化、非法页面不新增保存，保存未知不自动重发。样式修改不重复查询；如没有可复用的有效预览数据，不伪造 initial，按运行时既有能力取数或如实标明数据状态。

## 4. 运行态与发布

```mermaid
sequenceDiagram
  participant W as 用户 / 工作台
  participant D as Java 数据服务
  W->>D: 筛选、排序、翻页：已有查询定义与参数
  D-->>W: 查询结果与状态
  Note over W,D: 不进入 Agent、不修改页面定义、不触发草稿保存
```

发布不在本次创作简化中另行改造。真实 create 文本现有路径是：工作台收到发布意图 → Relay/Agent 进行维度实例选择 → 调用现有 update_page_metadata 转发布 → Relay 返回结果。此前图中的“工作台必须直接调用 Java 发布”不能作为当前实现要求。计划审核的“确认/可以”不得被错当成发布意图；页面确认与发布按所处阶段处理。维度裁剪、公共参数提取、草稿历史与发布版本号的现有声明记录为部署事实待验证，不从本仓不同契约推断已兼容。

## 5. Relay 交付协议：本期保留

预览准备工具成功之后，最终响应中保留以下原文；模型不把 JSON 填进占位符，也不使用本地 output 文件替代：

```text
{{RESPONSE_START}}
{{PAGE_METADATA_PREVIEW_JSON}}
```

- `{{RESPONSE_START}}`：当前 Skill 声明的响应开始标记，必须原样输出；实际解析细节依 Relay 协议。
- `{{PAGE_METADATA_PREVIEW_JSON}}`：由系统替换为预览内容供工作台渲染。先准备对应的预览卡片，再输出标记。
- `compose_page_result`：现有系统注入的完整产物，模型无需传。新 compose/edit 内部保存后，仍需产出可供该注入链消费的兼容产物；不能只返回 draftId 就宣称交付闭环完成。
- `document`：保存的页面定义，不含本次查询结果行。
- `previewJson`：document 与 previewData 合并，携带本次有效 initial；仅预览，不写入 Java 页面定义。
- 注入缺失则报告交付失败，不重复空调用，不回退到任意“最近一次结果”。保存已成功但预览失败时，只修复匹配产物的预览交付，不能重新保存来碰运气。

## 6. 状态归属与暂挂项

分析计划和结构计划供模型判断与工具执行；查询结果、当前工作稿与提交快照由程序持有。会话保留资源/修订标识及必要的 draftSpec，不存完整 document。单份工作稿不是多方案候选链；提交快照用于固定本次发送内容。

用户确认计划随草稿跨会话保存继续挂起；有效结果复用仍需核对身份、范围与版本。普通问数/探索不因共用构造能力自动保存资产。补查与修复保持有界，未知保存不自动重发。
