#!/bin/bash
# 手写 delegate / model 与公司 dfs-codegen 产物的漂移检查（只能在拿得到内部 Artifactory 的 CI 上跑）。
#
# page-assets-model/src/main/java 是按 codegen 输出形状手写的（本机拿不到插件）。本脚本用 -Pcodegen
# 把插件产物生成到 target/generated-sources/codegen，然后与手写源码做归一化 diff：
# 去掉 @Generated / @Api* 等只影响文档的注解、注释与空白后逐文件比较。有差异即退出 1，
# 差异内容就是"手写要改成什么"，改到一致为止；不要反过来把生成物入库。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODEL="${ROOT}/page-assets-model"
GENERATED="${MODEL}/target/generated-sources/codegen/src/main/java"
HANDWRITTEN="${MODEL}/src/main/java"
PACKAGE_DIR="com/huawei/cdi/pageassets"

(cd "${ROOT}" && mvn -B -ntp -q -Pcodegen -pl page-assets-model generate-sources)

if [[ ! -d "${GENERATED}/${PACKAGE_DIR}" ]]; then
  # 有的 codegen 版本不带 src/main/java 前缀。
  GENERATED="${MODEL}/target/generated-sources/codegen"
fi
if [[ ! -d "${GENERATED}/${PACKAGE_DIR}" ]]; then
  echo "codegen 未产出 ${PACKAGE_DIR}，检查 page-assets-model/pom.xml 的 -Pcodegen 配置" >&2
  exit 2
fi

normalize() {
  # 去注释、去空行、去行首尾空白、去纯文档注解；保留签名、注解参数与语句。
  sed -E \
    -e 's://.*$::' \
    -e '/^\s*\*/d' -e '/^\s*\/\*\*?/d' -e '/^\s*\*\//d' \
    -e '/^\s*@(Generated|Api|ApiOperation|ApiParam|ApiResponses?|ApiModel|ApiModelProperty)\b.*$/d' \
    -e 's/^\s+//' -e 's/\s+$//' \
    -e '/^$/d' "$1"
}

status=0
while IFS= read -r -d '' generated; do
  relative="${generated#"${GENERATED}"/}"
  handwritten="${HANDWRITTEN}/${relative}"
  if [[ ! -f "${handwritten}" ]]; then
    echo "缺少手写文件: ${relative}"
    status=1
    continue
  fi
  if ! diff -u <(normalize "${generated}") <(normalize "${handwritten}") > "/tmp/codegen-drift.$$"; then
    echo "漂移: ${relative}"
    cat "/tmp/codegen-drift.$$"
    status=1
  fi
done < <(find "${GENERATED}/${PACKAGE_DIR}" -name '*.java' -print0 | sort -z)

while IFS= read -r -d '' handwritten; do
  relative="${handwritten#"${HANDWRITTEN}"/}"
  if [[ ! -f "${GENERATED}/${relative}" ]]; then
    echo "codegen 未生成而手写存在: ${relative}"
    status=1
  fi
done < <(find "${HANDWRITTEN}/${PACKAGE_DIR}" -name '*.java' -print0 | sort -z)

rm -f "/tmp/codegen-drift.$$"
if [[ ${status} -eq 0 ]]; then
  echo "手写 delegate / model 与 dfs-codegen 产物一致"
fi
exit ${status}
