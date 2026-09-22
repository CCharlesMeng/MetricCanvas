#!/usr/bin/env bash
set -Eeuo pipefail

# Rebuild the generated authoring contract tree without relying on the
# package.json wrapper, which may try to repair an incomplete node_modules.

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

usage() {
  cat <<'EOF'
用法:
  tools/scripts/manual-authoring-generation.sh [--check] [--tests]

默认行为：
  1. 用当前源码生成 contracts/metriccanvas、metriccanvas-authoring/contracts
     以及对应的 contract-lock.json / bundle.lock.json。
  2. 校验 Bundle 摘要和再次导出漂移。

选项：
  --check  只校验，不写生成物。
  --tests  生成并校验后运行 Python 创作测试；端口测试仍需可用的授权环境。

依赖恢复（只在 node_modules 不完整时执行）：
  pnpm install --frozen-lockfile
  python3 -m venv /tmp/metriccanvas-authoring-venv
  /tmp/metriccanvas-authoring-venv/bin/python -m pip install --require-hashes \
    -r metriccanvas-authoring/tool/requirements.lock
  AUTHORING_PYTHON=/tmp/metriccanvas-authoring-venv/bin/python \
    tools/scripts/manual-authoring-generation.sh --tests
EOF
}

check_only=0
run_tests=0
python_bin="${AUTHORING_PYTHON:-python3}"
for arg in "$@"; do
  case "$arg" in
    --check) check_only=1 ;;
    --tests) run_tests=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "未知选项: $arg" >&2; usage >&2; exit 2 ;;
  esac
done

if [[ ! -f "node_modules/tsx/dist/cli.mjs" ]]; then
  cat >&2 <<'EOF'
缺少 node_modules/tsx，当前不能在本地执行 TypeScript 生成器。
请在网络和自动审批服务恢复后手工执行：

  pnpm install --frozen-lockfile
  tools/scripts/manual-authoring-generation.sh

本脚本不会自动修改依赖，也不会删除工作区文件。
EOF
  exit 2
fi

if (( check_only )); then
  node --import tsx tools/scripts/export-authoring-contracts.ts --check
  "$python_bin" metriccanvas-authoring/scripts/check_bundle.py
  exit 0
fi

node --import tsx tools/scripts/export-authoring-contracts.ts
"$python_bin" metriccanvas-authoring/scripts/check_bundle.py
node --import tsx tools/scripts/export-authoring-contracts.ts --check

if (( run_tests )); then
  if ! "$python_bin" -c 'import jsonschema, yaml, fastmcp' >/dev/null 2>&1; then
    cat >&2 <<'EOF'
缺少 Python 创作测试依赖，生成物已完成并通过 Bundle/漂移校验。
请手工执行：

  python3 -m venv /tmp/metriccanvas-authoring-venv
  /tmp/metriccanvas-authoring-venv/bin/python -m pip install --require-hashes \
    -r metriccanvas-authoring/tool/requirements.lock
  AUTHORING_PYTHON=/tmp/metriccanvas-authoring-venv/bin/python \
    tools/scripts/manual-authoring-generation.sh --tests
EOF
    exit 2
  fi
  PYTHONDONTWRITEBYTECODE=1 "$python_bin" metriccanvas-authoring/test-harness/run_tests.py
fi
