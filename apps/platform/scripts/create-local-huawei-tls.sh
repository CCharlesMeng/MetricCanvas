#!/usr/bin/env bash
set -euo pipefail

app_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
tls_directory="$app_root/.local-tls"
host="local.ulanqab.huawei.com"
leaf_key="$tls_directory/$host.key"
leaf_cert="$tls_directory/$host.pem"

if [[ "${1:-}" == '--install' ]]; then
  sed -E -i '' '/^[[:space:]]*127\.0\.0\.1[[:space:]].*local\.huawei\.com([[:space:]]|$)/d' /etc/hosts
  sed -E -i '' '/^[[:space:]]*127\.0\.0\.1[[:space:]].*local\.ulanqab\.huawei\.com([[:space:]]|$)/d' /etc/hosts
  printf '127.0.0.1 local.ulanqab.huawei.com\n' >> /etc/hosts
  exit 0
fi

mkdir -p "$tls_directory"
chmod 700 "$tls_directory"

openssl req -x509 -new -nodes -newkey rsa:2048 -sha256 -days 825 \
  -keyout "$leaf_key" \
  -out "$leaf_cert" \
  -subj "/CN=$host" \
  -addext 'basicConstraints=critical,CA:FALSE' \
  -addext 'keyUsage=critical,digitalSignature,keyEncipherment' \
  -addext 'extendedKeyUsage=serverAuth' \
  -addext "subjectAltName=DNS:$host"

chmod 600 "$leaf_key"

printf 'Created %s. Trust only this certificate for SSL in the login keychain, then run:\n' "$leaf_cert"
printf '  sudo pnpm --filter platform dev:local-huawei\n'
