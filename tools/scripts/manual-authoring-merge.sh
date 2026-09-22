#!/usr/bin/env bash
set -Eeuo pipefail

# Stage and audit the current authoring/main merge without using `git add -A`.
# By default this script only stages; pass --commit to create the merge commit.

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

usage() {
  cat <<'EOF'
用法：
  tools/scripts/manual-authoring-merge.sh [--fetch] [--commit]

默认行为：
  - 暂存所有已跟踪文件的当前最终状态；
  - 只按显式清单暂存本轮新增交付文件；
  - 排除 ioc-data-dev/ 和 packages/embed/single-option-check.mjs；
  - 检查冲突、遗漏、未暂存跟踪文件和空白错误；
  - 不提交、不推送。

选项：
  --fetch   暂存前执行 git fetch origin，并报告 origin/main 是否前进。
  --commit  审计通过后创建 merge commit；仍不推送。
  -h, --help

推荐先运行默认模式并检查 staged diff，再运行 --commit。
EOF
}

fetch_origin=0
create_commit=0
for arg in "$@"; do
  case "$arg" in
    --fetch) fetch_origin=1 ;;
    --commit) create_commit=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "未知选项: $arg" >&2; usage >&2; exit 2 ;;
  esac
done

if ! git rev-parse -q --verify MERGE_HEAD >/dev/null; then
  echo "当前没有进行中的 merge（MERGE_HEAD 不存在），停止。" >&2
  exit 2
fi

if [[ -n "$(git diff --name-only --diff-filter=U)" ]]; then
  echo "仍有未解决冲突，停止：" >&2
  git diff --name-only --diff-filter=U >&2
  exit 2
fi

if (( fetch_origin )); then
  git fetch origin
fi

merge_head="$(git rev-parse MERGE_HEAD)"
origin_main="$(git rev-parse -q --verify refs/remotes/origin/main || true)"
if [[ -n "$origin_main" && "$origin_main" != "$merge_head" ]]; then
  cat >&2 <<EOF
提示：origin/main ($origin_main) 与当前 MERGE_HEAD ($merge_head) 不同。
本脚本仍可收口当前 merge；提交后需再次执行 git merge origin/main 并重新验证。
EOF
fi

delivery_files=(
  docs/plan/2026-09-21-structure-plan-convergence.md
  docs/plan/2026-09-22-authoring-resume.md
  docs/plan/2026-09-22-main-merge-strategy.md
  metriccanvas-authoring/SOURCES.md
  metriccanvas-authoring/test-harness/README.md
  metriccanvas-authoring/test-harness/run_tests.py
  metriccanvas-authoring/test-harness/test-layers.json
  metriccanvas-authoring/test-harness/tests/test_harness_inventory.py
  metriccanvas-authoring/tool/metriccanvas_authoring/data/metric_relations.py
  metriccanvas-authoring/tool/metriccanvas_authoring/data/structure_query_cache.py
  metriccanvas-authoring/tool/metriccanvas_authoring/pages/components/section_presentation.py
  metriccanvas-authoring/tool/metriccanvas_authoring/pages/components/structure_presentation.py
  metriccanvas-authoring/tool/metriccanvas_authoring/pages/composition/structure_diagnostics.py
  metriccanvas-authoring/tool/metriccanvas_authoring/pages/composition/structure_preflight.py
  metriccanvas-authoring/tool/metriccanvas_authoring/pages/composition/structure_scope.py
  metriccanvas-authoring/tool/metriccanvas_authoring/pages/editing/structure_revision.py
  metriccanvas-authoring/tool/metriccanvas_authoring/pages/parameters/__init__.py
  metriccanvas-authoring/tool/metriccanvas_authoring/pages/parameters/page_parameters.py
  metriccanvas-authoring/tool/metriccanvas_authoring/pages/parameters/parameter_preparation.py
  metriccanvas-authoring/tool/metriccanvas_authoring/pages/validation/__init__.py
  metriccanvas-authoring/tool/metriccanvas_authoring/pages/validation/grouped_params.py
  metriccanvas-authoring/tool/metriccanvas_authoring/pages/validation/page_validation.py
  tools/scripts/manual-authoring-generation.sh
  tools/scripts/manual-authoring-merge.sh
)

for path in "${delivery_files[@]}"; do
  if [[ ! -f "$path" ]]; then
    echo "显式交付文件不存在: $path" >&2
    exit 2
  fi
done

git add -u
git add -- "${delivery_files[@]}"

excluded_paths=(
  ioc-data-dev
  packages/embed/single-option-check.mjs
)
for path in "${excluded_paths[@]}"; do
  if [[ -n "$(git diff --cached --name-only -- "$path")" ]]; then
    echo "排除项被意外暂存: $path" >&2
    exit 2
  fi
done

for path in "${delivery_files[@]}"; do
  if ! git ls-files --error-unmatch -- "$path" >/dev/null 2>&1; then
    echo "交付文件未进入索引: $path" >&2
    exit 2
  fi
done

unexpected_untracked=0
while IFS= read -r line; do
  case "$line" in
    "?? ioc-data-dev/"|"?? packages/embed/single-option-check.mjs") ;;
    "?? "*) echo "存在未分类的未跟踪文件: ${line#?? }" >&2; unexpected_untracked=1 ;;
  esac
done < <(git status --porcelain=v1 --untracked-files=normal)
if (( unexpected_untracked )); then
  exit 2
fi

if ! git diff --quiet; then
  echo "仍有未暂存的跟踪文件，停止：" >&2
  git diff --name-only >&2
  exit 2
fi

git diff --cached --check

if git diff --cached --quiet; then
  echo "索引没有可提交差异，停止。" >&2
  exit 2
fi

echo "暂存与审计完成。明确排除项仍未暂存："
git status --short -- "${excluded_paths[@]}"
echo
git diff --cached --shortstat
git diff --cached --stat=100,40,40

if (( create_commit )); then
  git commit -m "merge: integrate main with current authoring and parameter contracts"
  echo "merge commit 已创建；尚未推送。"
  if [[ -n "$origin_main" && "$origin_main" != "$merge_head" ]]; then
    echo "origin/main 已不同于本次 MERGE_HEAD；下一步先执行 git merge origin/main。"
  fi
else
  echo
  echo "请检查 staged diff；确认后执行："
  echo "  tools/scripts/manual-authoring-merge.sh --commit"
fi
