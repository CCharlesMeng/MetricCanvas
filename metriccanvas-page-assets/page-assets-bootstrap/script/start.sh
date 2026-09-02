#!/bin/bash
# 以 classpath 方式启动 StartUp，与公司服务一致（不用 fat jar）。
# 目录约定：APP_ROOT/lib/*.jar、APP_ROOT/conf/、日志 LOG_DIR（缺省 /opt/cloud/logs/pageassets）。
set -euo pipefail

APP_ROOT="${APP_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
LOG_DIR="${LOG_DIR:-/opt/cloud/logs/pageassets}"
JAVA_EXEC="${JAVA_HOME:+$JAVA_HOME/bin/}java"

mkdir -p "${LOG_DIR}/log"

JAVA_OPTS="${JAVA_OPTS:-} -server -XX:+UseG1GC -XX:MaxGCPauseMillis=200"
JAVA_OPTS="${JAVA_OPTS} -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=${LOG_DIR}/log"
JAVA_OPTS="${JAVA_OPTS} -Duser.timezone=UTC -Dfile.encoding=UTF-8 -Dlog4j2.formatMsgNoLookups=true"
JAVA_OPTS="${JAVA_OPTS} -Dlog.dir=${LOG_DIR} -Dspring.config.additional-location=file:${APP_ROOT}/conf/"
JAVA_OPTS="${JAVA_OPTS} -classpath ${APP_ROOT}/lib/*"

exec ${JAVA_EXEC} ${JAVA_OPTS} com.huawei.cdi.pageassets.StartUp "$@"
