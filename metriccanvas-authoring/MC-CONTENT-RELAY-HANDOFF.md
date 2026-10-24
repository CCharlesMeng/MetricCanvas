# Relay 开发对接：MC 内容与布局能力

日期：2026-10-24。状态：MC 脚本和完整内容已提供，本地验收完成；本文确认表全部等待 Relay 实际回复，不能据此认定部署已接通。

目标：让现有 Skill 能查询 MC 事实、调用布局编译、在程序通道检查精确装配产物，并使用产品规则处理旧 Schema 文件。[交付说明](MC-CONTENT-OVERVIEW.md) 解释整体责任；既有平台服务的身份、查询、保存和预览 Adapter 接入见 [RELAY-HANDOFF.md](RELAY-HANDOFF.md)。

## 1. 接收物和交付身份

接收完整 `metriccanvas-authoring/` 公共目录，至少保留 `mc-content/`、本说明及交付说明、Bundle 清单、契约、平台 tool 和对应 Skill 内容。内部自有 adapters 按 ownership 规则保留。仅 MC 内容运行时可独立部署整个 `mc-content/`；这不包含平台服务与业务 Adapter。

本次 MC 内容版本 `1-e9aba00bba96353d`，完整摘要 `e9aba00bba96353d204bb30549fe3c0b395f290474842dd1b1487cc420662295`，Interface 1.0；页面写出版本 6.58、平台工具协议 2.0。以实际 verify 输出为准。

正式交付时请双方填写：公共完整 Git 提交号、内部提交号、交付目录或归档摘要、MC 内容摘要、执行环境版本。公共提交号取交付消息及实际取得本目录的提交；旧开发基线或 Bundle 0.3.1 均不能单独标识本次变更。

## 2. 本地安装与冒烟

以下命令在收到的 `metriccanvas-authoring/` 目录执行；`.venv` 位于内容包外。环境需有 Python ≥3.12、Node.js ≥22。这些 MC 冒烟命令不调用模型、DQE、保存或发布。

```sh
python3.12 -m venv .venv
.venv/bin/python -m pip install -r mc-content/scripts/requirements.txt
node --version
.venv/bin/python --version
.venv/bin/python mc-content/scripts/mc_content.py verify
.venv/bin/python mc-content/scripts/mc_content.py query --topic version
.venv/bin/python mc-content/scripts/mc_content.py query --topic index --key tool
.venv/bin/python mc-content/scripts/mc_content.py query --topic tool --key compose_page
.venv/bin/python mc-content/scripts/mc_content.py evaluate --input mc-content/eval/fixtures/example-matrix.json
.venv/bin/python scripts/check_bundle.py
```

示例矩阵预期 `environment=local-deterministic`，`conclusion` 为 passed=1、failed=0、not_run=1。deployment-save 返回 not_run 是未提供部署执行能力，不能改称通过。此评测器目前只执行 compile/inspect 操作，不自动执行部署或汇总外部回执。

安装平台服务与内部 Adapter 继续按原 RELAY-HANDOFF 执行；以上 pip 命令仅安装 MC 脚本依赖。内容包完整性错误需重新核对整包，不能删除清单项或手改 hash 过检。

## 3. Relay 需要实现什么

| 工作 | 交付要求 |
|---|---|
| 执行入口 | 选择 Relay 现有可用的受控调用通道，将函数或 CLI 暴露给 Skill；本包未注册 `tool_mc_query`、MCP 新工具或 Hook |
| 资源与依赖 | 固定内容根目录，安装 Python/Node/依赖；执行进程可读取整包；由部署隔离保证模型不能改脚本、模板、快照 |
| 受控参数 | topic/key/options 使用接口参数；包路径、执行程序和输出目录来自可信配置/受控工作目录，不暴露任意 shell 或任意包路径给模型 |
| 调用关联 | 保存编译输入、输出 inspectionSpec、内容摘要与装配请求关联；重试/并发不串页、不串用户、不读“最近一次”全局变量 |
| 完整产物 | 在程序通道取得该次 compose 的完整页面元数据，将 document 与对应 inspectionSpec 交给 MC 检查 |
| 模型摘要 | 只返回有界诊断、来源、版本和必要的定位信息；不为检查而暴露完整页面、原始数据或查询响应 |
| 版本事实 | 从真实部署读取可证明的版本字段，构造 targetVersions；不知道的字段保持未验，不照抄随包清单伪装部署事实 |
| 整包更新 | 完整替换后启动新进程或完整重载脚本；缓存和检查声明按内容摘要隔离，旧请求如何排空/完成由 Relay 明确 |
| 采用与报告 | Skill 定义正式能力矩阵和采用规则；MC 检查、真实保存、预览交接分别记录 |

实施位置属于 Relay/Skill 调用 Adapter。本次不要求修改 MC 现有 MCP 参数签名、页面 Schema、CAS 或保存逻辑，不要求另建内容激活、回退管理器。

## 4. 可执行接口样例

### 4.1 查询

查询粒度为索引加原子。先查询索引，再用其中的 key 查询；不让模型猜路径。topic/key 清单来自 [index.json](mc-content/index.json)。

```sh
.venv/bin/python mc-content/scripts/mc_content.py query --topic index --key tool --options '{"offset":0,"limit":20}'
.venv/bin/python mc-content/scripts/mc_content.py query --topic tool --key compose_page --options '{"includeSchema":true,"maxBytes":262144}'
```

响应含 `content`、`source`、`contentSha256`、`truncated`、`requiredBytes` 和 `cached`。当原子超预算，content=null、truncated=true；提高预算或分页索引，不把空内容当成完整契约。预算约束作用于 content 的 JSON 字节数，不是模型 token 数或整个响应大小，Relay 仍须控制最终模型摘要。

当前支持 options 为 maxBytes、includeSchema、offset、limit；实际类型和范围见 `scripts/mc_resources.py`。MC 当前 cached=false，不维护轮次缓存；如需去重由 Relay 按内容摘要和参数管理。

### 4.2 编译

把下面的 JSON 保存在受控工作目录中的 `compile-input.json`，不要写进 mc-content。该例只验证结构，没有业务数据，不代表完整经营报表。

```json
{
  "templateRef": {
    "scene": "business-report",
    "variant": "standard",
    "templateVersion": "1"
  },
  "plan": {
    "title": "Relay 接线冒烟",
    "sources": {},
    "sections": [
      {
        "id": "summary",
        "blocks": [
          {"id": "note", "type": "text", "body": "仅验证编译调用"}
        ]
      }
    ]
  },
  "userRequirements": []
}
```

```sh
.venv/bin/python mc-content/scripts/mc_content.py compile --input /absolute/work/compile-input.json
```

预期 status=ok、plan 非空、含 inspectionSpec；此例未传 targetVersions，预期 deploymentAlignment=not_run。生产调用请传真实字段，例如 pageSchemaVersion、platformProtocolVersion；可用字段必须属于 manifest.alignedWith，当前逐字段精确比较。checkedVersionFields 只证明那些字段已核对。

`userRequirements` 是 `{id, mustBe}` 数组，来自 Skill 对用户要求的明确声明；mustBe 表示需要保留的组件类型。按完整页面结构计划输入，稳定 id 用于匹配；遗漏章节不会被模板自动补回。显式内容优先，可选 null 字段表示本次不继承该缺省。

返回的 plan 才可进入既有 compose request；整个编译封套、inspectionSpec、targetVersions 都不能夹入 compose request。原工具的其他参数仍按真实 list_tools 传入。

### 4.3 Python 程序调用与产物检查

下面是可执行的接口调用片段。`content_root` 和 `job_dir` 须由 Relay 可信配置指定，输入文件由调用 Adapter 在程序通道准备。先完成编译，再对与之关联的装配产物执行最后两行；两阶段之间的 compose 沿既有工具链调用。

```python
import json
import sys
from pathlib import Path

content_root = Path("/absolute/install/mc-content").resolve()
job_dir = Path("/absolute/work/job-123").resolve()
sys.path.insert(0, str(content_root / "scripts"))
from mc_content import compile_layout, inspect_assembly

envelope = json.loads((job_dir / "compile-input.json").read_text())
compiled = compile_layout(envelope, root=content_root)
# Relay 在此处理 status/gaps；由 Skill 决定是否调用既有 compose_page。
# 与该请求关联后保存 compiled["inspectionSpec"]；不改写其内容。

document = json.loads((job_dir / "assembled-document.json").read_text())
report = inspect_assembly(document, compiled["inspectionSpec"], root=content_root)
```

上述片段没有替你调用 compose，也没有实现会话状态和权限。生产中若编译失败或未取得该次完整产物，不执行最后两行，记录具体原因和 not_run。若分进程执行，Relay 持久关联该次原样 inspectionSpec，禁止在装配后根据结果重建要求。

CLI 的检查输入为 `{ "document": <完整页面元数据>, "inspectionSpec": <该次编译输出> }`，用 `inspect --input /absolute/work/inspect-input.json` 调用。完整输入、检查声明和结果保留在受控程序通道。

当前检查覆盖顶层组件类型、所属分区、data.main 数据源、实际字段选择和产品页面合法性。它不证明嵌套组件的全部语义、查询口径正确、视觉质量、DQE 执行、保存或用户原话理解；以 coverage/notVerified 为准，不能把 status=ok 扩展为全链路通过。

### 4.4 业务状态与异常

| 操作 | 当前结果 | 调用方处理 |
|---|---|---|
| compile | ok / gap / invalid | 读取 plan、gaps、adjustments；gap 可能仍有可用 plan，Skill 决定后续；invalid 通常 plan=null |
| inspect | ok / gap / not_run | gap 是检查到缺口；not_run 是不能完成检查，不得折算成通过 |
| schema | readable、validationErrors、upgrade 等事实 | 分别判断读取和迁移；不套用 compile 的状态枚举 |
| evaluate | checks[].status=passed / failed / not_run | 查看逐项结果和原因；conclusion 为计数，采用规则归 Skill |
| CLI / Python 异常 | CLI 错误 JSON 或 Python ContentError 等 | 同时记录进程退出、JSON 和业务状态；直接 Python 调用需捕获异常 |

CLI 退出 0 仅表示本次返回了 JSON；compile 的 invalid、inspect 的 not_run 也可能退出 0。进程超时、依赖缺失和输出解析失败由 Relay 转成有原因的未完成记录，不能伪造 MC 检查结论。

## 5. 保存、产物与预览的时序确认

当前 compose 在返回前尝试保存，MCP 模型摘要没有完整 document。因此 Relay 必须确认下面这个真实链路：

1. 编译产生 plan 和 inspectionSpec；Skill 决定采用。
2. 既有 compose 按原权限和 CAS 机制装配并尝试保存，保留原始 saveStatus 和回执。
3. 在可信程序通道取得这次完整 document；明确发生在保存/relay_preview 的哪个位置，不凭文档猜测。
4. Relay 将精确 document 和原样 inspectionSpec 交给 inspect_assembly。
5. 模型拿到检查摘要、独立保存回执和已有预览交接状态，Skill 决定修复或继续。

检查发现问题不会撤销第 2 步保存。真实检查发生在预览交接之前还是之后，由 Relay 证据确认；本次没有新增“检查通过才保存”的承诺。拿不到完整产物时，先将本项标为 not_run 并说明所需通道，不从模型摘要重建页面。

## 6. Schema 更新与旧文件处理

命令在内容包外的受控工作目录读写，以下路径为占位，须替换为实际文件：

```sh
.venv/bin/python mc-content/scripts/mc_content.py schema --input /absolute/work/old-page.json
.venv/bin/python mc-content/scripts/mc_content.py upgrade --input /absolute/work/old-page.json
.venv/bin/python mc-content/scripts/mc_content.py upgrade --input /absolute/work/old-page.json --out-dir /absolute/work/new-attempt
```

前两条不写迁移产物；最后一条只允许全新目录，写 original、page、migration.json。请核对输入与 original 字节及 SHA256、目标版本、变更和缺口，再于目标运行时预览。不得覆盖原文件、修改历史修订或只改 schemaVersion。

旧页仍可读取且只做旧能力范围内修改时，可保留原版本。未知/未来版本、能力下限冲突、没有明确规则的旧语义，应交回具体报告。已知旧页头自动期间语义不能靠版本改名放行。

每次产品 Schema 升级，MC 提供重生成整包及迁移规则；Relay 核对实际目标版本和运行环境，整体替换、重载脚本并重新执行旧文件验证。旧 inspectionSpec 不跨内容摘要复用。正在执行的旧请求须持有与旧脚本一致的整包，或重新编译后再继续，不能混装。

## 7. 请 Relay 逐项确认

以下均为待确认问题，不是已知部署事实。请填写实际方案、负责人、证据/阻塞和预期完成时间；无能力时写明需要的改动。

| 编号 | 需要确认的关键问题 | 期望回复 / 证据 | 当前 |
|---|---|---|---|
| R01 | 采用什么 Skill 原生函数、程序调用或其他受控注册通道？是否支持六个 MC 接口？ | 实际注册位置、调用示例；明确是否有子进程能力 | 待确认 |
| R02 | 整包怎样安装，Python/Node 与 jsonschema 怎样提供？ | 目标机器版本、安装路径、verify 输出、依赖安装结果 | 待确认 |
| R03 | 模型对脚本/模板/快照有无写权限？输入输出和日志存在哪里？ | 真实隔离配置，受控工作目录和日志策略 | 待确认 |
| R04 | 从哪里取得部署版本与实际工具参数 Schema？ | 真实工具回执/list_tools、targetVersions 字段映射；未知项明列 | 待确认 |
| R05 | 能否取得该次 compose 完整页面元数据？处于保存和预览交接的哪个位置？ | 实际程序通道、document 的版本/摘要及保存/交接时序证据 | 待确认 |
| R06 | inspectionSpec 如何关联请求、产物、重试和并发？ | 稳定请求关联方案、并发两页/两用户及重试测试 | 待确认 |
| R07 | 最终给模型哪些字段，预算和超限处理如何实现？ | 一份真实有界摘要；完整 document 和原始响应留在程序通道 | 待确认 |
| R08 | 整包替换后如何重载代码、处理旧请求和失效缓存？ | 更新/重启步骤及混版本负例、旧 spec 不复用证明 | 待确认 |
| R09 | 旧文件从哪里读取、迁移输出存哪、谁决定采用？ | 原件保留与新目录策略、目标运行时预览及采用责任 | 待确认 |
| R10 | 谁维护正式能力矩阵和采用规则？ | Skill 负责人、矩阵版本、真实回执归档位置 | 待确认 |
| R11 | 当前真实身份、DQE、Java 保存及预览 Adapter 已接通哪些？ | 分项实际回执；沿原 handoff 对齐，不用 MC 本地通过代替 | 待确认 |
| R12 | 公共源码和内部适配采用哪个固定提交，谁负责验收？ | 完整提交号、整包摘要、负责人、接入计划和未验项 | 待确认 |

## 8. 接入验收清单

MC 已验证脚本、仓外运行、契约/分发一致性和合成页面。Relay 需要补充下列真实环境证据；未执行项如实记 not_run。以下是双方对接验收建议，Skill 自行定义采用标准。

| 用例 | 需观察的结果 |
|---|---|
| 安装与查询 | verify 与 check_bundle 成功；正常查询、索引分页、超预算保留完整原子语义 |
| 正常编译及实际检查 | plan 经真实 compose；拿到精确 document；inspectionSpec 配对正确；保存/检查/交接回执独立 |
| 缺口与异常 | 必须组件被替换/丢失、字段选择改变时出现对应 gap；缺依赖/缺产物如实 not_run |
| 调用隔离 | 并发、重试不串页/用户/spec；内容根目录不由模型任意指定 |
| 版本对齐 | 真实 targetVersions 一致；不一致明确诊断，未提供字段不冒充已验 |
| 整包更新 | 完整替换并重载；混装可检出，旧 spec 跨摘要使用被拒绝；运行产物不写包内 |
| 旧文件 | 可读旧页保留版本；允许迁移的文件新目录升级并保留原字节；已有目录、未来版本和未知旧语义正确处理 |
| 真实业务链 | DQE、保存、预览和必要的发布逐项实测；检查成功不代替这些回执 |

本地可参考的运行入口是 `evaluate --input mc-content/eval/fixtures/example-matrix.json`；真实部署项另外归档，当前 evaluate 不读取外部部署回执。浏览器预览须由实际部署运行时完成。

## 9. Relay 回传格式

请将以下内容作为本次对接回执保存到内部项目，附日志或可访问证据链接；不要在回执中粘贴凭据或整份业务原始数据。

```text
接入环境 / 时间：
Relay 负责人 / Skill 负责人 / 验收负责人：
公共完整 Git 提交 / 内部提交：
交付目录或归档摘要：
contentVersion / contentSha256 / interfaceVersion：
Python / Node / jsonschema 版本：
实际部署版本及来源 / 未取得的版本字段：
R01–R12：逐项实际答案、证据、阻塞、负责人和时间

每个验收用例：
  ID / 环境 / passed|failed|not_run / 原因 / 证据链接

一次真实调用关联（字段名由 Relay 实际协议确定）：
  请求关联标识 / 内容摘要 / 原样 inspectionSpec 的存放位置
  装配产物 document 的摘要及版本 / 检查结果
  独立 saveStatus 与保存回执 / 独立预览交接回执

已接通范围：
未验或失败项、所需 MC 支持：
Skill 采用决定及理由（由 Skill 方填写）：
```

这些回传字段是对接记录建议，不是新增 MC 工具参数、页面字段或 Relay 协议。无真实证据时保留 not_run。
