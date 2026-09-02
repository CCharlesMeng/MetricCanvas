-- 页面资产首批三张表（ADR-0062）。前缀 t_pa_ 避免与宿主 CDINL2DataBuilderService 撞名；
-- 独立 Flyway 历史表 flyway_page_assets_history 与 locations（见 MySqlStoreConfiguration），并入宿主后互不干扰。
-- 字符集 utf8mb4（页面文本可能含 4 字节字符）；标识列用 utf8mb4_bin，使 page_id 的比较与排序即 UTF-8 字节序 = 码点序，
-- listPages 的游标语义（PageCatalogPolicy）由此对齐。时间列 DATETIME(3) 存 UTC 毫秒。无外键、无逻辑删除列：修订不可变。

CREATE TABLE t_pa_page (
  page_id                varchar(128) COLLATE utf8mb4_bin NOT NULL COMMENT '页面 id，即文档 id',
  latest_revision_id     char(32) COLLATE utf8mb4_bin NOT NULL COMMENT 'latest 指针：修订 id',
  latest_revision_number bigint NOT NULL COMMENT 'latest 指针：修订号（页面内线性递增，从 1 起）',
  latest_created_at      datetime(3) NOT NULL COMMENT 'latest 修订的创建时间（UTC）',
  create_time            datetime(3) NOT NULL COMMENT '页面行创建时间（首保，UTC）',
  update_time            datetime(3) NOT NULL COMMENT 'latest 指针最近推进时间（UTC）',
  PRIMARY KEY (page_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='页面 latest 指针；页面一旦存在至少有一个修订';

CREATE TABLE t_pa_page_revision (
  revision_id          char(32) COLLATE utf8mb4_bin NOT NULL COMMENT 'UUIDv4 无横线 32 位',
  page_id              varchar(128) COLLATE utf8mb4_bin NOT NULL COMMENT '所属页面',
  revision_number      bigint NOT NULL COMMENT '页面内线性修订号',
  base_revision_id     char(32) COLLATE utf8mb4_bin NULL COMMENT '保存时声明的基线修订；首保为 NULL',
  document             mediumtext NOT NULL COMMENT '保存时提交的原样页面文档（JSON 文本，不用 JSON 列）',
  content_hash         char(64) COLLATE utf8mb4_bin NOT NULL COMMENT 'sha256(canonical(document))',
  data_context_version varchar(128) COLLATE utf8mb4_bin NULL COMMENT '保存时的 Data Context 版本，由调用方提供',
  source_type          varchar(16) COLLATE utf8mb4_bin NOT NULL COMMENT 'relay | manual',
  source_session_id    varchar(128) COLLATE utf8mb4_bin NULL COMMENT 'relay 来源：Relay 会话',
  source_run_id        varchar(128) COLLATE utf8mb4_bin NULL COMMENT 'relay 来源：Run 标识',
  source_skill_version varchar(64) COLLATE utf8mb4_bin NULL COMMENT 'relay 来源：Skill bundle 版本',
  created_by           varchar(128) COLLATE utf8mb4_bin NOT NULL COMMENT 'actorId（X-Operator-Id）',
  created_at           datetime(3) NOT NULL COMMENT '创建时间（UTC）',
  PRIMARY KEY (revision_id),
  UNIQUE KEY uk_pa_revision_page_number (page_id, revision_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='不可变页面修订';

CREATE TABLE t_pa_idempotency (
  operation       varchar(64) COLLATE utf8mb4_bin NOT NULL COMMENT '作用域：操作名，如 savePageRevision',
  actor_id        varchar(128) COLLATE utf8mb4_bin NOT NULL COMMENT '作用域：actorId',
  idempotency_key varchar(200) COLLATE utf8mb4_bin NOT NULL COMMENT '作用域：调用方幂等键',
  fingerprint     char(64) COLLATE utf8mb4_bin NOT NULL COMMENT '请求体业务字段规范化 JSON 的 sha256',
  page_id         varchar(128) COLLATE utf8mb4_bin NOT NULL COMMENT '成功保存的页面',
  revision_id     char(32) COLLATE utf8mb4_bin NOT NULL COMMENT '成功保存的修订；重放按 (page_id, revision_id) 取回',
  created_at      datetime(3) NOT NULL COMMENT '记录时间（UTC）；保留 7 天后由清理任务删除',
  PRIMARY KEY (operation, actor_id, idempotency_key),
  KEY idx_pa_idempotency_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='幂等结果，只记成功保存';
