#!/bin/bash
# 把根 pom 的 parent 从本地占位（版本 local，relativePath 指向 build-parent/）切到公司真实 parent。
# 只在 CI（能访问内部 Artifactory）上执行；版本取自根 pom 的 <cbcbi.parent.version>，可用参数覆盖。
#
#   scripts/use-company-parent.sh [parent-version]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
POM="${ROOT}/pom.xml"

version="${1:-}"
if [[ -z "${version}" ]]; then
  version="$(sed -n 's:.*<cbcbi.parent.version>\(.*\)</cbcbi.parent.version>.*:\1:p' "${POM}" | head -n1)"
fi
if [[ -z "${version}" ]]; then
  echo "cbcbi.parent.version not found in ${POM}" >&2
  exit 1
fi

# 只改 <parent> 块内的版本与 relativePath；块以第一个 </parent> 结束。
awk -v v="${version}" '
  BEGIN { inParent = 0 }
  /<parent>/ { inParent = 1 }
  inParent && /<version>local<\/version>/ { sub(/<version>local<\/version>/, "<version>" v "</version>") }
  inParent && /<relativePath>/ { sub(/<relativePath>.*<\/relativePath>/, "<relativePath/>") }
  /<\/parent>/ { inParent = 0 }
  { print }
' "${POM}" > "${POM}.tmp"
mv "${POM}.tmp" "${POM}"

echo "parent switched to com.huawei.hwclouds.cbc:cbcbi-parent:${version}"
