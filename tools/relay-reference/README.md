# Relay 四项导出与发行检查

本目录实现 [四项交付 Spec](../../docs/plan/2026-11-02-product-relay-evolution/relay-reference-spec.md) 的发行检查、MC 构建侧四项导出和稳定产品进程入口。真实 MCP、身份、DQE、状态/CAS、保存、采用和回退程序由 Relay 维护。

当前发行版本以`release-config.json`为准，Interface2.0.0；默认页面版本从当前产品真源导出，正式工具名称为`mc-tools/`和`mc-tools.md`。共享references安装根允许Relay自有文件，产品CLI只遍历四项；seal/verify/compare的候选根仍须严格四项。旧单数发行可由构建检查器只读验证，1→2的入口/公开路径变化明确返回needs_migration。

`consumer-0.3.0-tools-plural.json`保留0.2.0冻结样本的全部35条请求、状态、数据、诊断和退出码，逐字不改；仅从实际候选取得新发行/入口/资源元数据。`tools-plural-adoption-review-v1.json`记录路径迁移及旧6.82的历史差异，旧0.1.0和0.2.0样本/审查文件保持原摘要。6.83路径基线由`tools-plural-first-adoption-v1.json`绑定，当前6.84正式基线见`schema684-tools-first-adoption-v1.json`；实际--current仍独立检查，不自动采用。后文6.83首次基线说明是保留的历史背景。当前main已发布Schema6.84，0.3.3以独立37条消费者承接：原35条请求保持，其中13条结果变化逐项记录，两条新增新鲜分析报告的换源正反例。旧0.3.0及更早快照和审查保持原字节，旧批次作为实际current仍返回迁移要求。

0.3.2新增19项`runtime:operation.<操作名>`输入概览和`mc-tools/examples/index.json`的35条同源请求；完整Interface由程序校验，模型按任务读取概览和必要属性知识。Node版本检查与执行统一使用实际解析的可执行路径。操作契约和冻结样本保持，真实Relay接入及模型材料成本另验。

官方生成链在 MC 侧执行，先从同一产品输出图生成 Content/local-authoring，再预构建 Node、封闭 Python 导入和资源、生成两指南及清单：

```sh
METRICCANVAS_PYTHON=/absolute/locked/python pnpm relay:build
pnpm relay:test
METRICCANVAS_PYTHON=/absolute/locked/python pnpm relay:core:test
```

版本、输出位置、Python 提供方、核心测试和冻结消费者由 `release-config.json` 统一配置；`--config` 可选择独立配置。构建脚本转交同一官方生成器，注册来自提供方的真实 `OPERATIONS`，不扫描模型工具名伪造能力。低层生成器仍可重复传 `--relay-python-operations` 明确选择提供方。发行目录必须全新，资源不完整、在线或未声明导入、缺少预构建程序/固定样本、Node 与 Content 默认 Schema 不一致均拒绝构建。每个 Python 传递依赖按实际元数据递归解析并核对锁定版本，初始环境声明在 `mc-tools/requirements.txt` 和 release 中。

构建侧低层 `export.py` 接收已生成 Content、预构建 Node 目录和显式 Python 操作模块；不在目标环境执行。`product_cli.py` 是 `mc-tools/cli.py` 的维护真源，`product_runtime.py` 只负责信封、完整性、资源与离线 dispatch。算法属于 A/B 的共享产品模块。两指南作者源在 `guides/`。内部 Python/Node 路径可调整，消费方只调用固定入口。

发行检查器仅依赖 Python 标准库。构建侧准备好实际候选四项及元数据后：

```sh
python -B tools/relay-reference/cli.py seal /absolute/candidate --metadata /absolute/build-metadata.json
python -B tools/relay-reference/cli.py verify /absolute/candidate
python -B tools/relay-reference/cli.py compare /absolute/current /absolute/candidate
python -B -m unittest discover -s tools/relay-reference -p 'test_*.py' -v
```

元数据字段、稳定路径和回执格式以 spec 为准。seal 只写候选的 `mc-tools/release.json`，不覆盖不同内容的既有清单；verify/compare 只读。compare 成功仅返回 `eligibleForSmoke: true`，`automaticPromotion` 始终 false；实际 Relay 包装回归、切换与回退另由 Relay 负责。

兼容预检查保留旧操作描述、资源 ID、公开路径、页面支持与运行要求。新操作需提升 Interface 次版本；修改既有 Schema 即使看似可选也暂拒绝普通自动升级。已验证清单不证明任意实现保持行为，必须继续执行冻结消费者和产品测试。

冻结消费者 `fixtures/consumer-0.1.0.json` 记录真实旧发行的完整操作描述、运行要求、资源 ID 和 23 条 CLI 输入输出，原 SHA f7df720d… 不变。回放比较退出码、状态、完整数据和有序诊断；Content 索引读取仅比较稳定投影以允许新增资源。没有重新录制命令。直接对旧样本回放，Schema 默认值或旧描述变化仍返回 `needs_migration`，不能通过更新旧样本消除差异。

用户已确认以 Schema6.83 作为首次正式消费基线。`release-config.json` v2 固定新的35条消费者和版本化 `fixtures/schema683-first-adoption-v1.json`，后者绑定旧样本、新样本和逐值差异审查的 SHA。新样本保留原23条输入，再补新增6项操作的12条实际正负请求。中文人工审查见 [schema683-adoption-review.md](fixtures/schema683-adoption-review.md)，机器审查列出八条调用和三项契约原因的完整旧/新值。记录中的review发行ID只是采集来源，未来候选仍按固定契约/行为比较；实际归档单独绑定真实releaseId，避免自引用。

首次发行聚合要求正式35条全部通过，并要求旧23条的 `needs_migration` 报告精确匹配已审查差异；旧报告不会被改成通过。完整报告写入外部归档回执的 `compatibilityEvidence.historicalReports`。缺记录、SHA变化、缺历史报告、历史新增差异或正式样本失败均拒绝。只要提供 `--current`，实际当前四项就先独立比较，旧6.82仍返回退出码2；首次基线记录不能绕过真实更新门禁。没有force或允许任意差异的选项。聚合通过仅允许进入Relay冒烟，不执行采用或激活。

归档在 MC 构建侧完成，默认先执行结构比较和冻结回放；`--current` 另比较实际当前四项。以下路径须分别指向新候选、新归档和真实构建真源：

```sh
METRICCANVAS_PYTHON=/absolute/locked/python pnpm relay:replay --candidate /absolute/candidate
# 更新时必须提供实际当前四项；6.82→6.83会被拒绝，须由Relay显式处理迁移。
METRICCANVAS_PYTHON=/absolute/locked/python pnpm relay:replay --candidate /absolute/candidate --current /absolute/current
METRICCANVAS_PYTHON=/absolute/locked/python pnpm relay:pack \
  --candidate /absolute/candidate --output /absolute/release.zip --source-root /absolute/source
python -I -S tools/relay-reference/package_cli.py verify --archive /absolute/release.zip
METRICCANVAS_PYTHON=/absolute/locked/python pnpm relay:verify --archive /absolute/release.zip --probe
python -I -S tools/relay-reference/package_cli.py extract \
  --archive /absolute/release.zip --destination /absolute/new-staging
```

ZIP 和 `.tar.gz` 固定顺序、时间、权限与压缩头；相同候选和源码状态生成相同字节。归档旁的 `.release.json` 回执包含归档 SHA/大小、完整文件清单、运行要求、Git commit/tree、相关输入脏状态和逐源码 SHA，不含本地绝对路径或时间。打包核对 Content source identity、实际复制的 Python/入口/指南与真源字节。回执需通过可信发布渠道获取；本机制不提供数字签名或发布身份认证。

标准库验证拒绝路径穿越、链接、设备、重复名、大小写与文件目录冲突、非便携 Windows 名称及载荷篡改；只解压到不存在的新目录，拒绝覆盖。`--expected-source SHA` 可核对预期 Git 提交，相关输入是否有未提交修改另见回执 `source.dirty`。`--probe` 复制仅六项声明依赖到仓外，用 `-I -S` 跑实际产品自检、旧回放及缺依赖/缺 Node/缺文件/禁网负例；不安装本仓 wheel。

CI 的 `relay-release` 从源码生成、跑分发和核心测试、打包并上传，再下载验证；`relay-distribution` 在 Ubuntu/Windows 的 Python 3.12、Node 22 上仅安装 `runtime-requirements.txt` 六项依赖，验证同一下载归档。两者显式运行 `test_adoption.py`，用真实候选复制并封装一个6.82默认值的已验证current测试目录，实际CLI必须exit2；这是兼容门禁夹具，不冒充历史产品实现。历史失败不得删除、变绿或脱离真实候选，回执往返测试覆盖这些反例。本地可设置 `METRICCANVAS_RELAY_CANDIDATE=/absolute/candidate` 执行同一测试，未提供候选时仅跳过该实际current测试。配置接线和本地执行证据不代表原生 CI 已通过。归档验证、解压和回放均不激活或切换 Relay。

`test_release.py` 的 19 项是结构夹具测试，不能证明产品能力。`test_distribution.py` 则从实际真源构建候选，在仓外以无关 cwd、清空解析回退及 `-I -B` 运行真实产品操作，另以 `-S` 和仅声明依赖复测；覆盖冻结消费者、正负输入、缺依赖/文件、内部迁移、两次兼容更新、跳跃和显式恢复旧四项。这些是产品层回放，不能替代实际 Relay 的原子切换、状态、保存和进程恢复验收。时间上下文及实际页面/浏览器/local 完成度以本批证据和主控台账为准。
