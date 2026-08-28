import {
  createPool,
  type Pool,
  type PoolConnection
} from 'mysql2/promise';

export interface MySqlExecutor {
  query<T>(statement: string, values?: readonly unknown[]): Promise<T[]>;
}

export interface MySqlDatabase extends MySqlExecutor {
  transaction<T>(work: (tx: MySqlExecutor) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export function createMySqlDatabase(databaseUrl: string): MySqlDatabase {
  const pool = createPool({
    uri: databaseUrl,
    connectionLimit: 5,
    timezone: 'Z',
    waitForConnections: true
  });

  return {
    async query<T>(statement: string, values: readonly unknown[] = []) {
      return withConfiguredConnection(pool, (connection) =>
        query<T>(connection, statement, values)
      );
    },
    async transaction<T>(work: (tx: MySqlExecutor) => Promise<T>) {
      const connection = await pool.getConnection();
      try {
        await configureConnection(connection);
        await connection.beginTransaction();
        const tx: MySqlExecutor = {
          query: <R>(statement: string, values: readonly unknown[] = []) =>
            query<R>(connection, statement, values)
        };
        const result = await work(tx);
        await connection.commit();
        return result;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },
    async close() {
      await pool.end();
    }
  };
}

async function withConfiguredConnection<T>(
  pool: Pool,
  work: (connection: PoolConnection) => Promise<T>
): Promise<T> {
  const connection = await pool.getConnection();
  try {
    await configureConnection(connection);
    return await work(connection);
  } finally {
    connection.release();
  }
}

async function configureConnection(connection: PoolConnection): Promise<void> {
  // MySQL 默认是 REPEATABLE READ，且 DATETIME 没有时区语义。每次从池中
  // 借连接都重申契约，避免依赖服务端全局配置或上个借用者留下的状态。
  await connection.query("SET SESSION time_zone = '+00:00'");
  await connection.query('SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED');
}

async function query<T>(
  connection: PoolConnection,
  statement: string,
  values: readonly unknown[]
): Promise<T[]> {
  const [rows] = await connection.query(statement, [...values]);
  return rows as T[];
}

/**
 * 用事务行锁替代会话级 GET_LOCK。占位行的唯一键让“业务行尚不存在”的
 * 首次写入也能串行化；事务提交或回滚都会释放锁，不会泄漏到连接池。
 * 占位行按 aggregate/幂等键永久保留（一键一行，值只存 SHA-256），避免
 * 删除 mutex 行时与等待事务竞态。P3 必须迁移同一张表；容量治理按幂等
 * 保留周期统一归档，不在请求事务内删除活动锁行。
 */
export async function lockTransactionKey(
  tx: MySqlExecutor,
  lockKey: string
): Promise<void> {
  await tx.query(
    `INSERT INTO persistence_locks (lock_key)
     VALUES (?)
     ON DUPLICATE KEY UPDATE lock_key = VALUES(lock_key)`,
    [lockKey]
  );
  await tx.query(
    'SELECT lock_key FROM persistence_locks WHERE lock_key = ? FOR UPDATE',
    [lockKey]
  );
}

export function jsonParameter(value: unknown): string {
  return JSON.stringify(value);
}

export function fromJson<T>(value: T | string | Buffer): T {
  if (typeof value === 'string') return JSON.parse(value) as T;
  if (Buffer.isBuffer(value)) return JSON.parse(value.toString('utf8')) as T;
  return value;
}

export function toIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  const normalized = /(?:Z|[+-]\d\d:\d\d)$/i.test(value)
    ? value
    : `${value.replace(' ', 'T')}Z`;
  return new Date(normalized).toISOString();
}
