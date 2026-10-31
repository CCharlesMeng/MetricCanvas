# MC 内容包分发与调用探查记录

日期：2026-10-31。对应[实施方案](../2026-10-31-mc-content-distribution-hardening.md)。本记录为本地源码与故障注入证据，不代表 Relay、Windows 实机或远端 CI 已验收。

## 基线

- 工作区 HEAD：`d24a417210041a3c057e06dd0012e07d0bcc6c76`，有大量已有并行修改；此 SHA 不是全部被测字节的身份。
- 当前 MC 包：`1-e7aaa7dd4a61e77a`，manifest 中 1955 项；用户引用的 1989 文件包未在现场核对。
- 本机：macOS；系统 Python 3.14.7，维护 venv Python 3.12.13，Node v24.11.1。不能将系统解释器和 venv 混用；解析 venv python 符号链接后直接运行其目标，也不能等价证明 venv 行为。
- 关键作者源 SHA256：
  - `tools/mc-content/scripts/mc_resources.py`：`a2d3274c69a3671fbe4d5b30cb77ead5bb765ad04c7e9fe1b4ee743cecf99174`
  - `tools/mc-content/scripts/mc_content.py`：`3a1706246b87ed063ac80173b5faa6aec34e79ecfdb39fc2d0ea5e5bab09b15d`
  - `tools/scripts/mc-content-pack.py`：`eaeaaa82851f7d14d2fe5cb841a603141b802190d3fa90d4adb0409b6e58cfab`

## 实测结果

全部包变换在 `TemporaryDirectory` 中进行；没有修改产品源、安装包或锁。模拟同步故障只操作临时目录。

| 探针 | 结果 |
|---|---|
| 原包调用 version；打包、仓外解压后逐项摘要与 CLI verify | 1955 项全部匹配，CLI 退出 0 |
| `layouts/report-composition.md` LF→CRLF | 原摘要不匹配，标准化 LF 后匹配；query 报 CONTENT_RESOURCE_MISMATCH |
| 所有文件转 CRLF，新进程 import 后 patch digest | CONTENT_CODE_VERSION_MISMATCH；导入快照按原字节，补丁按 LF 重算 |
| 修改脚本并重新计算 files/contentSha256/contentVersion，新进程调用 | 通过；不存在不能修改校验器的自引用死锁 |
| 包内新增 `.DS_Store` 或删除 `layouts/report.md` | 二者都只报 CONTENT_RESOURCE_SET_MISMATCH，path 空，无差异列表 |
| manifest 前加 UTF-8 BOM | CONTENT_RESOURCE_UNAVAILABLE，message 为 Python JSON 的 Unexpected UTF-8 BOM |
| locale.getencoding 模拟 cp936，实际调用 query_content(node, tableComponent) | UnicodeDecodeError，gbk 无法解码 Node UTF-8 输出 |
| CLI 使用 PYTHONIOENCODING=cp936，查询不存在的含 emoji key | returncode=1，stdout 0 字节，stderr 含 UnicodeEncodeError；结构化错误输出失败 |
| 旧 timestamp pyc，源文件同大小同 mtime 改为新内容，清单匹配新内容 | 新进程执行旧标记 A，磁盘为 B，verify 仍通过 |
| PATH 不含 Node，调用 upgrade_page | FileNotFoundError；query_content(node) 则返回 CONTENT_READER_UNAVAILABLE |
| 系统 Python 没装 jsonschema，compile `{}` | stdout 为空，stderr ModuleNotFoundError；此前完整性 verify 正常 |
| 使用维护 venv 执行 compile `{}` | exitCode=0，JSON status=invalid，gaps 为 TEMPLATE_REFERENCE_INVALID；这是既有业务状态约定 |
| `sync_upstream.apply` 在 b.py 临时文件替换时注入 OSError | a.py=new、b.py=old；重试报 Public/local conflicts: a.py, b.py.sync-tmp |
| 只把 manifest.contentVersion 改为 `1-incorrect` | query version 成功返回 `1-incorrect` |
| 输出归档不存在、同名 `.release.json` 预先存在 | pack 退出 0，旧回执被覆盖 |

前一轮同工作区运行 `metriccanvas-authoring/tool/.venv/bin/python -m unittest discover -s metriccanvas-authoring/test-harness/tests -p test_mc_content.py`：33 tests，OK，22.013s。它说明现有回归通过，不表示本记录发现的边界已有回归覆盖。

## 两个关键复现入口

在仓库根运行。只读当前包；第一段用受控默认编码模拟，不能标为 Windows 验收。

```python
from pathlib import Path
from unittest.mock import patch
import sys

root = Path('metriccanvas-authoring/mc-content').resolve()
sys.path.insert(0, str(root / 'scripts'))
import mc_resources

with patch('locale.getencoding', return_value='cp936'):
    mc_resources.query_content('node', '#/definitions/tableComponent', root=root)
# 当前：UnicodeDecodeError。
```

旧 pyc 探针的关键步骤如下；没有篡改正文业务行为，标记用于判定实际执行的源码版本。

```python
from pathlib import Path
import hashlib, json, os, py_compile, shutil, subprocess, sys, tempfile

source = Path('metriccanvas-authoring/mc-content').resolve()
with tempfile.TemporaryDirectory() as temporary:
    root = Path(temporary) / 'mc-content'
    shutil.copytree(source, root, ignore=shutil.ignore_patterns('__pycache__'))
    script = root / 'scripts/mc_resources.py'
    content = script.read_bytes()
    script.write_bytes(content + b"\nAUDIT_MARKER = 'A'\n")
    stamp = script.stat()
    py_compile.compile(str(script), doraise=True)
    script.write_bytes(content + b"\nAUDIT_MARKER = 'B'\n")
    os.utime(script, ns=(stamp.st_atime_ns, stamp.st_mtime_ns))
    manifest_path = root / 'mc-content.version.json'
    manifest = json.loads(manifest_path.read_bytes())
    for item in manifest['files']:
        item['sha256'] = hashlib.sha256((root / item['file']).read_bytes()).hexdigest()
    encoded = (json.dumps(manifest['files'], ensure_ascii=False, indent=2) + '\n').encode()
    manifest['contentSha256'] = hashlib.sha256(encoded).hexdigest()
    manifest['contentVersion'] = '1-' + manifest['contentSha256'][:16]
    manifest_path.write_text(json.dumps(manifest), encoding='utf-8')
    probe = (
        "import sys;sys.path.insert(0,sys.argv[1]+'/scripts');"
        "import mc_content;import mc_resources as m;"
        "print(m.AUDIT_MARKER,m.verify_package()[1]['contentVersion'])"
    )
    print(subprocess.check_output([sys.executable, '-c', probe, str(root)], text=True))
# 当前：A 1-<新摘要前缀>，而磁盘标记为 B。
```

## 静态确认与已有保护

- [资源校验](../../../tools/mc-content/scripts/mc_resources.py)：摘要按字节；LOADED_CODE 是导入时读取的磁盘快照；query 每次调用 verify。已有逻辑能拒绝资源混装、目录集合变化和导入后磁盘代码被替换，不应删除。
- [CLI 与迁移入口](../../../tools/mc-content/scripts/mc_content.py)：compile 的 jsonschema import 在实际编译函数执行前，main 不捕获 ImportError；upgrade 子进程没有 timeout，默认文本编码；CLI 默认 stdout 编码来自解释器环境。
- [Node 检查入口](../../../tools/mc-content/scripts/mc_inspection.py)：已有 30 秒 timeout，但未指定文本编码。不要因为 upgrade 缺超时而误称所有 Node 调用都无超时。
- [MC 打包](../../../tools/scripts/mc-content-pack.py)：源与暂存树都先 verify，再按 read_bytes 归档；已有保真路径。最终回执使用 write_text，归档有 xb 而回执无同等保护；没有独立 archive verify 入口。sourceIdentity 从源目录读取，未来应与归档使用同一暂存树。
- [CI](../../../.github/workflows/ci.yml)：当前上传 MC 归档与回执，没有 MC 独立归档下载后回验。local-authoring 已有下载回验机制，可参考；这是本地 workflow 配置事实，不是远端 run 结论。
- [同步工具](../../../metriccanvas-authoring/scripts/sync_upstream.py)：git archive 固定 commit、逐文件 bytes 校验、保留内部 Adapter、冲突预检及 lock 最后写入均已存在；缺口是中断恢复，不应弱化原冲突检查。
- [独立 Skill 打包](../../../tools/scripts/skill-release.py)：已有完整目录 inventory、归档安全条目检查、输出/回执拒绝覆盖、仓外探针和来源 SHA 核对。本计划复用其工程模式，不重做其他 Skill 行为验收。
- 本仓 platform_mcp.py 没有 query_content 调用；不能把本仓修改当作用户引用的 Relay 私有接线修复。

## 未验证与不应推断的事项

Windows 实机、Relay 具体包/源码、真实模块缓存/并发/取消、远端 CI 与实际下载产物尚未验证。上述缓存与中断故障都是合成触发条件，不证明现场发生频率。没有发现原字节 SHA256 算法或当前归档的摘要计算不一致。

## 实施收口补充：二进制来源摘要

在 2133241a6b4f259fc19ff54bfdd9a0dcb9c96e06 的隔离工作树收口时，发现 `tools/scripts/mc-content.ts` 的 sourceIdentity 对所有构建输入使用 `readFile(..., 'utf8')`，而输入集合包含 pages 下图片。它记录的是解码后重新编码的摘要，不能当作原文件字节 SHA256；这与 MC 安装资源的原字节 digest 是两个不同位置的问题。

新增实际导出链路回归“构建来源摘要保留二进制原字节”，在临时副本写入合成 bytes `ff fe 80 00 0d 0a`。修复前测试明确失败：原字节期望 `1efa5c89d8fd5eca42bf87d29ed05a35049f497c4109131133dbcc67f91541c8`，原实现记录 `fb4c385a04697aa457ea83f9d0da174f7e156702b6006e270e0f2bed3495e585`。修复改为 Buffer 读取后哈希；不改图片、生成内容正文、页面字段或 Schema。最终验收见实施记录，红/绿日志位于本地 artifacts。
