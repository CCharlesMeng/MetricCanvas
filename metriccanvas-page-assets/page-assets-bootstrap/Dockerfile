# 基础镜像为公司内部镜像（内置 JRE 17），由构建参数注入，不在仓库写死内网地址。
ARG BASE_IMAGE
FROM ${BASE_IMAGE}

ARG DIST_TAR=target/page-assets-bootstrap-*.tar.gz
ENV PROCESS_NAME=pageassets \
    APP_ROOT=/opt/cloud/pageassets \
    LOG_DIR=/opt/cloud/logs/pageassets \
    LANG=en_US.UTF-8

RUN mkdir -p ${APP_ROOT} ${LOG_DIR}
ADD ${DIST_TAR} ${APP_ROOT}/

WORKDIR ${APP_ROOT}
ENTRYPOINT ["/bin/bash", "script/start.sh"]
