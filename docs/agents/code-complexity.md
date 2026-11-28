# 每次编码的复杂度规则

适用于新增、修改、修复和重构代码，包括工具脚本、测试回调、工厂内部方法及匿名函数。目标是降低理解与维护成本，同时保持业务含义、公开接口和执行行为。

## 全项目目标与自动门禁

全项目平均圈复杂度严格 `<5`；新增函数及辅助函数自身 `CC≤15`；TS/JS/Svelte 生产与工具代码含嵌套闭包的工厂/外层函数 `subtreeCC≤45`；TS/JS/Svelte 生产源文件行数 `≤600`。上述指标同时检查，不能用平均值掩盖单函数热点，也不能通过套壳闭包规避 `selfCC` 限制。TS/JS 与 Python 分别统计，不能混合两个扫描器的数值。平均值以每个实测函数为权重，即 `Σ selfCC / 函数数`，不取文件平均值的平均，也不以四舍五入后的显示值验收。

```sh
# Python 使用仓库锁定环境，并安装 radon==6.0.1
METRICCANVAS_PYTHON=/path/to/python pnpm complexity:check
# 在已提交的分支上复验 CI 比较口径，将 BASE_SHA 设置为目标分支的提交
METRICCANVAS_COMPLEXITY_BASE="$BASE_SHA" METRICCANVAS_PYTHON=/path/to/python pnpm complexity:check
METRICCANVAS_PYTHON=/path/to/python pnpm complexity:audit --output /tmp/complexity.json
METRICCANVAS_PYTHON=/path/to/python pnpm complexity:audit --baseline HEAD --output /tmp/baseline.json
```

仓内 [全量审计器](../../tools/scripts/audit-code-complexity.mjs) 枚举 Git 跟踪的可执行 TS/JS、Svelte 和 Python 文件，以及维护目录内新增的源文件。声明文件不含运行时实现，排除 `.d.ts` / `.d.mts` / `.d.cts`。Svelte 通过编译器定位真实 script 区块，保留原行号，仅测脚本，不宣称覆盖模板控制流。Python 使用 Radon 6.0.1 的函数、方法与闭包指标，类聚合分不作为函数计数。失败解析会阻断检查。

报告同时保留全扫描范围（inclusive）和维护代码（maintained）；生成副本、内嵌第三方生成代码、历史证据与原型单列，并列出生产代码、工具与测试的平均值、最大值、超限数、决策数和函数数。默认门禁检查两个语言各自全扫描范围及维护代码的平均值均 `<5`；不能仅靠删除报告中的生成物或增加测试函数宣称复杂度改善。原始函数记录和逐文件 SHA256 均可导出核对。

[存量台账](../../tools/scripts/complexity-debt.json) 维护三类零增长、只降不升棘轮，均与基准提交逐项核对，拒绝新增、调高或恢复已关闭的额度（即使同批同时修改源码与台账也会失败）：

- **`violations`（`selfCC > 15`）**：记录维护代码（production / tooling / tests）中实测超过 15 的函数，按文件、语言、函数路径和 `selfCC` 逐项核对；匿名回调按父级和同组分值从高到低一一匹配，忽略行号变化。
- **`subtreeViolations`（`subtreeCC > 45` 且 `subtreeCC > selfCC`）**：记录 TS/JS/Svelte 生产与工具代码中因嵌套闭包/局部辅助函数叠加导致子树复杂度超过 45 的函数（排除测试文件以避免 `describe(...)` 套件误报），按文件、语言、函数路径与 `subtreeCC` 核对，堵住“低外层 `selfCC` + 巨型共享状态闭包工厂”漏洞。
- **`fileSizeViolations`（`lines > 600`）**：记录非生成、非测试的 TS/JS/Svelte 生产源文件（`category === 'production'`）超过 600 行的存量，防止单文件继续膨胀。

PR 使用目标分支 SHA，推送 main 使用推送前的 SHA，本地默认使用 HEAD。使用指定 SHA 时需要能从本地 Git 对象库读取相应台账；首次引入新台账分段时，若基准提交尚无该字段则跳过基准增量对比，但仍校验工作树与候选台账精确一致。

任一棘轮指标实测下降时（如 `selfCC` 从 48 降到 36、`subtreeCC` 从 160 降到 95、或生产文件行数从 739 降到 680），须在同一改动中手动收紧台账中对应条目的额度；降至阈值以内或删除函数/文件时移除该条目。下一次变更以收紧后的额度或通用上限（`15` / `45` / `600`）为准；检查只读台账。使用 `pnpm complexity:audit --check-functions` 可另行要求全部维护函数 `CC≤15`。

CI authoring job 在安装固定 Radon 后执行 `pnpm complexity:check`，覆盖平均值、测量器回归和新增/增长超限。原 Python 创作公共模块的固定门禁继续独立执行，不放宽其现有限制。当前实施、20 条清单核对及完整剩余项见 [2026-11-04 审计](https://github.com/CCharlesMeng/MetricCanvas/blob/09a7815c965bce921c2ef50202fa727ba9a8e705/docs/evidence/code-complexity/2026-11-04-audit/README.md)。

## 执行顺序与完成条件

1. **编码前定位职责**：确认本次会改哪些函数、分别维护什么不变量；对含多个流程或多种类型分支的函数先测基线。找现有实现与类型能力，确定可复用的职责，再添加分支。
2. **编码时按职责收敛**：新增函数及新增辅助函数的自身圈复杂度目标为 `CC ≤ 15`；分支嵌套超过三层时复核是否可以提前返回、提取有明确业务含义的步骤或按判别类型分派。嵌套层数是评审信号，与 CC 分开判断。
3. **编码后实际测量**：检查修改函数和全部新增函数，包括闭包、回调、对象方法、访问器及生成器。对比同一工具、同一版本、同一口径的前后结果；外层工厂低分不能代替内部方法检查。扫描输出中的其他存量问题单独列出，不能将命令退出成功当作复杂度达标。
4. **决定本次修到哪里**：本次改动会给出错误结果、破坏已有行为，或触发新增超限、存量涨分等硬门禁时，处理造成问题的最小范围。例如上限为 36 的函数从 36 变成 37，先检查新加的分支；通过门禁只需回到 36。若失败原因是分数已经下降、台账仍有旧额度，只收紧对应条目即可。
5. **验证行为与报告**：运行与改动相称的回归；规则校验重构对比完整有序错误列表及输入不变性；异步流程覆盖失败、取消、过期回执和重复操作。完成说明列出相关函数前后数值、行为检查及剩余风险，避免只报告行数减少或总分下降。

纯文档/样式修改无需伪造函数测量；说明未修改可执行分支即可。协议或功能行为变化仍执行 [功能与协议能力验收要求](feature-acceptance.md)。

存量超限函数维持原分、相关行为回归通过，就可以交付本次修改。文件长、改动频繁、模板嵌套深只提示评审关注。顺手整理的条件是能在本次涉及的职责内完成，并用本次回归验证。若要联动其他模块、调用方或额外建立一套回归才能证明安全，就把整理移出当前范围。等具体缺陷反复发生，或下一项需求确实受这段结构阻碍时，再单独安排。日常完成说明报告本次实测结果即可，无需为相同的存量重复开单或撰写延期理由。

## 拆分原则

- 用稳定职责命名辅助函数，传入明确所需的依赖，保留小而稳定的公开接口；共享状态集中在原所有者。优先纯计算与显式结果，避免把一个闭包拆成多份互相写入的上下文。
- 同类规则集中在相应类型或业务职责旁。有限判别联合可用 `switch` 或类型明确的分派；不为降分增加通用规则引擎、动态脚本或新的公开抽象。
- 提前返回降低嵌套；提取命名谓词降低理解成本。两者不一定降低总决策数，应分别核实效果。复杂条件按业务含义拆解，并保留短路求值和副作用顺序。
- 校验器保留错误类型、路径、消息及顺序；参数处理保留 `null` / `undefined`、默认值与原子应用语义；异步状态保留授权顺序、CAS、取消、重试、幂等与生成器产出顺序。
- 用接口上的行为回归约束拆分。完整分支覆盖并不意味着只需 CC 数量的测试；按业务场景、组合与失败路径选择测试。
- 移动代码、换成匿名回调、压成表达式或增加透传层不构成复杂度治理完成。辅助函数同样实测；结合数据流和职责判断是否更容易修改。

## 本地测量口径

### TypeScript / JavaScript

使用仓内 [AST 测量器](../../tools/scripts/measure-ts-complexity.mjs)，依赖仓库安装的 TypeScript，结果携带实际版本：

```sh
node tools/scripts/measure-ts-complexity.mjs path/to/changed.ts path/to/another.ts
node --test tools/scripts/measure-ts-complexity.test.mjs
```

`metriccanvas-ts-ast/1` 的固定口径：

- `selfCC` 从 1 开始，对 `if`、三元表达式、循环、非 default 的 `case`、`catch`、`&&` / `||` / `??` 及其复合赋值各加 1；计入运行时参数默认值。
- 每个函数独立测量，排除嵌套函数体与类型节点；嵌套函数逐个另列。`else`、`default`、`finally`、`return` 本身不加分。
- `optionalChains` 单列 `?.` 数量，不计入 `selfCC`。类型标注中的 `?` 和条件类型不是运行时分支。
- `subtreeCC = selfCC + Σ(所有后代函数 selfCC − 1)`，衡量外层函数及其嵌套闭包/局部辅助函数覆盖的决策总量，用于 `subtreeCC ≤ 45` 棘轮门禁（仅约束 `subtreeCC > selfCC` 的生产/工具函数）。`nestedFunctions` 帮助定位闭包集中程度；`lines` 输出源文件的精确行数（供生产源文件 `≤ 600` 行棘轮使用）。
- 这是本地语法决策指标，未构建控制流图，也不计算认知复杂度或报告中的“深度”。命令只输出数据，解析错误/文件读取失败会报错；退出 0 不代表满足 15 的目标。

工具支持完整 `.ts` / `.tsx` / `.js` 文件；Svelte 的脚本需结合实际处理链单独核对，不能把整个 `.svelte` 文件交给 TypeScript 解析并宣称覆盖模板分支。调整计数规则须升级 analyzer 标识、测试和基线，不能以口径变化宣称代码改善。

### Python 与外部扫描

现有 Python 创作公共模块继续执行 `tools/scripts/check-authoring-complexity.py` 的固定 Radon 门禁；其文件清单及 `CC ≤ 15` 限制以脚本为准，现有 CI 不放宽。

其他 Python 文件也应使用相同版本对本次相关函数及嵌套函数测量，不能把固定文件清单的通过当作全仓通过。

外部 CodeCheck 结果须保留扫描器版本、规则、源码 SHA、扫描范围；缺少这些信息时，只能核实当前源码与本地指标。不同工具的数值不可直接相减，也不能用本地通过替代外部复扫。

## 当前存量依据

[2026-10-22 全清单核对](https://github.com/CCharlesMeng/MetricCanvas/blob/09a7815c965bce921c2ef50202fa727ba9a8e705/docs/evidence/code-complexity/2026-10-22-audit.md) 记录了清单漂移、自身分支与闭包累计的区别；[分批优化计划](../plan/2026-10-22-code-complexity.md) 记录了拆分候选及行为验收。两者是时间点证据，后续编码以当前源码重新测量。

当前原清单的逐项关闭状态以 [原始259条续修对照](https://github.com/CCharlesMeng/MetricCanvas/blob/09a7815c965bce921c2ef50202fa727ba9a8e705/docs/evidence/code-complexity/2026-10-22-original-list-follow-up.md) 为最新时间点证据；首轮的“剩余17”仅是局部范围计数。
