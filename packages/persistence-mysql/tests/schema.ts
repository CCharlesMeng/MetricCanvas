import { createConnection } from 'mysql2/promise';

/**
 * P2 的 test-only schema fixture。生产 schema 与版本追踪由 P3 的独立
 * migration Job 接管；adapter 工厂本身不得在应用启动时执行 DDL。
 */
export async function applyMySqlTestSchema(databaseUrl: string): Promise<void> {
  const connection = await createConnection({
    uri: databaseUrl,
    multipleStatements: true,
    timezone: 'Z'
  });
  try {
    await connection.query(MYSQL_TEST_SCHEMA);
  } finally {
    await connection.end();
  }
}

const MYSQL_TEST_SCHEMA = `
  -- P3 必须原样版本化该 mutex 表；行按 aggregate/幂等键永久保留，
  -- 后续只允许在确认超出幂等保留期后由独立运维任务归档。
  CREATE TABLE persistence_locks (
    lock_key VARCHAR(767) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY
  ) ENGINE=InnoDB;

  CREATE TABLE dashboard_pages (
    page_id VARCHAR(767) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin PRIMARY KEY,
    latest_revision_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin,
    published_revision_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin,
    active_publish_request_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin,
    created_by TEXT NOT NULL,
    created_at DATETIME(3) NOT NULL
  ) ENGINE=InnoDB;

  CREATE TABLE page_revisions (
    revision_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    revision_number INT NOT NULL,
    page_id VARCHAR(767) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    base_revision_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin,
    document JSON NOT NULL,
    content_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    data_context_version TEXT,
    created_by TEXT NOT NULL,
    created_at DATETIME(3) NOT NULL,
    UNIQUE KEY page_revision_number (page_id, revision_number),
    CONSTRAINT page_revision_page_fk FOREIGN KEY (page_id) REFERENCES dashboard_pages(page_id)
  ) ENGINE=InnoDB;

  CREATE TABLE publish_requests (
    request_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    page_id VARCHAR(767) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    revision_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    requested_by TEXT NOT NULL,
    requested_client_id TEXT NOT NULL,
    status VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at DATETIME(3) NOT NULL,
    expires_at DATETIME(3) NOT NULL,
    decided_by TEXT,
    decided_client_id TEXT,
    decided_at DATETIME(3),
    CONSTRAINT publish_request_page_fk FOREIGN KEY (page_id) REFERENCES dashboard_pages(page_id),
    CONSTRAINT publish_request_revision_fk FOREIGN KEY (revision_id) REFERENCES page_revisions(revision_id)
  ) ENGINE=InnoDB;

  CREATE TABLE publish_audit_events (
    audit_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    request_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    page_id VARCHAR(767) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    revision_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    action VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    actor_id TEXT,
    client_id TEXT,
    occurred_at DATETIME(3) NOT NULL,
    reason TEXT,
    CONSTRAINT publish_audit_request_fk FOREIGN KEY (request_id) REFERENCES publish_requests(request_id),
    CONSTRAINT publish_audit_page_fk FOREIGN KEY (page_id) REFERENCES dashboard_pages(page_id),
    CONSTRAINT publish_audit_revision_fk FOREIGN KEY (revision_id) REFERENCES page_revisions(revision_id)
  ) ENGINE=InnoDB;

  CREATE TABLE lifecycle_idempotency (
    operation VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    client_id VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    idempotency_key VARCHAR(448) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    result JSON NOT NULL,
    created_at DATETIME(3) NOT NULL,
    PRIMARY KEY (operation, client_id, idempotency_key)
  ) ENGINE=InnoDB;

  CREATE TABLE page_templates (
    template_id VARCHAR(767) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin PRIMARY KEY,
    latest_revision_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin,
    published_revision_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin,
    created_by TEXT NOT NULL,
    created_at DATETIME(3) NOT NULL
  ) ENGINE=InnoDB;

  CREATE TABLE template_revisions (
    revision_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    revision_number INT NOT NULL,
    template_id VARCHAR(767) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    base_revision_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    tags JSON NOT NULL,
    viewer_subject_ids JSON NOT NULL,
    source_page_id VARCHAR(767) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    source_revision_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_by TEXT NOT NULL,
    created_at DATETIME(3) NOT NULL,
    UNIQUE KEY template_revision_number (template_id, revision_number),
    CONSTRAINT template_revision_template_fk FOREIGN KEY (template_id) REFERENCES page_templates(template_id)
  ) ENGINE=InnoDB;

  CREATE TABLE template_publish_requests (
    request_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    template_id VARCHAR(767) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    revision_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    confirmation_url TEXT NOT NULL,
    requested_by TEXT NOT NULL,
    status VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at DATETIME(3) NOT NULL,
    decided_by TEXT,
    decided_at DATETIME(3),
    CONSTRAINT template_publish_template_fk FOREIGN KEY (template_id) REFERENCES page_templates(template_id),
    CONSTRAINT template_publish_revision_fk FOREIGN KEY (revision_id) REFERENCES template_revisions(revision_id)
  ) ENGINE=InnoDB;

  CREATE TABLE template_idempotency (
    operation VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    client_id VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    idempotency_key VARCHAR(448) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    result JSON NOT NULL,
    created_at DATETIME(3) NOT NULL,
    PRIMARY KEY (operation, client_id, idempotency_key)
  ) ENGINE=InnoDB;
`;
