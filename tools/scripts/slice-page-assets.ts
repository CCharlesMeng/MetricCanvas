/**
 * `pnpm slice:page-assets`:ADR-0062 J4 的本地真实纵切,一条命令在新 checkout 上复现:
 *
 *   Docker MySQL 8 → Java 页面资产(tar.gz 产物,`PAGE_ASSETS_STORE=mysql`,Flyway 建表)
 *   → Python Tool 以真实 stdio MCP 子进程被调用(`build_page`,Relay / DQE 用 Harness 替身,
 *     页面资产走真实 Java HTTP Adapter)→ 修订落到 MySQL
 *   → platform 的 Java Adapter(`@metriccanvas/page-assets-java`)加载**精确修订**并核对内容哈希;
 *     再做一次同基线保存证明冲突是 409 `REVISION_CONFLICT`,一次重放证明幂等原样返回。
 *
 * 前置:docker、JDK 17(`JAVA_HOME` 或 PATH)、Maven(没有现成 tar.gz 时打包)、装了 fastmcp 的 Python
 * (优先 `metriccanvas-authoring/tool/.venv`,可用 `METRICCANVAS_PYTHON` 指定)。全部子进程在退出时清理。
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalizeJson } from '../../packages/page/src/canonical-json.ts';
import { createJavaPageLifecycle } from '../../packages/page-assets-java/src/index.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const javaRoot = path.join(repoRoot, 'metriccanvas-page-assets');
const bundleRoot = path.join(repoRoot, 'metriccanvas-authoring');
const runId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const OPERATOR = 'slice-operator';

const cleanups: Array<() => Promise<void> | void> = [];
async function cleanup(): Promise<void> {
  for (const step of cleanups.reverse()) {
    try {
      await step();
    } catch (error) {
      console.error('清理失败(忽略):', error instanceof Error ? error.message : error);
    }
  }
  cleanups.length = 0;
}
process.on('SIGINT', () => void cleanup().then(() => process.exit(130)));
process.on('SIGTERM', () => void cleanup().then(() => process.exit(143)));

function log(step: string, detail = ''): void {
  console.log(`\n▶ ${step}${detail ? `  ${detail}` : ''}`);
}

function fail(message: string): never {
  throw new Error(message);
}

function run(command: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}): string {
  const result = spawnSync(command, args, { cwd: options.cwd, env: options.env ?? process.env, encoding: 'utf8' });
  if (result.status !== 0) {
    fail(`${command} ${args.join(' ')} 失败(${result.status}):\n${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      if (!address || typeof address === 'string') return reject(new Error('no port'));
      const port = address.port;
      probe.close(() => resolve(port));
    });
    probe.on('error', reject);
  });
}

async function waitFor(label: string, probe: () => Promise<boolean>, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await probe().catch(() => false)) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  fail(`${label} 在 ${timeoutMs / 1000}s 内未就绪`);
}

function javaHome(): string | undefined {
  if (process.env.JAVA_HOME) return process.env.JAVA_HOME;
  if (process.platform === 'darwin') {
    const detected = spawnSync('/usr/libexec/java_home', ['-v', '17'], { encoding: 'utf8' });
    if (detected.status === 0 && detected.stdout.trim()) return detected.stdout.trim();
    const brew = '/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home';
    if (existsSync(brew)) return brew;
  }
  return undefined;
}

function pythonExecutable(): string {
  if (process.env.METRICCANVAS_PYTHON) return process.env.METRICCANVAS_PYTHON;
  const venv = path.join(bundleRoot, 'tool', '.venv', 'bin', 'python');
  return existsSync(venv) ? venv : 'python3';
}

async function startMySql(): Promise<{ url: string; username: string; password: string }> {
  log('1/5 启动 MySQL 8(Docker)');
  run('docker', ['version', '--format', '{{.Server.Version}}']);
  const name = `pa-slice-mysql-${runId}`;
  const password = 'pa';
  run('docker', [
    'run', '-d', '--name', name,
    '-e', 'MYSQL_ROOT_PASSWORD=root', '-e', 'MYSQL_DATABASE=pageassets',
    '-e', 'MYSQL_USER=pa', `-e`, `MYSQL_PASSWORD=${password}`,
    '-p', '127.0.0.1::3306',
    process.env.PAGE_ASSETS_SLICE_MYSQL_IMAGE ?? 'mysql:8.0'
  ]);
  cleanups.push(() => void run('docker', ['rm', '-f', name]));
  const mapped = run('docker', ['port', name, '3306/tcp']);
  const port = Number(mapped.split(':').pop());
  // 必须走 TCP:镜像初始化阶段的临时实例只开 socket,socket ping 会在真实实例监听前就成功。
  await waitFor('MySQL', async () => {
    const ping = spawnSync('docker', [
      'exec', name, 'mysqladmin', 'ping', '--protocol=tcp', '-h', '127.0.0.1', '-upa', `-p${password}`, '--silent'
    ]);
    return ping.status === 0;
  }, 120_000);
  console.log(`  MySQL 就绪 127.0.0.1:${port}`);
  return {
    url: `jdbc:mariadb://127.0.0.1:${port}/pageassets?allowPublicKeyRetrieval=true`,
    username: 'pa',
    password
  };
}

async function locateTarball(): Promise<string> {
  if (process.env.PAGE_ASSETS_TARBALL) return process.env.PAGE_ASSETS_TARBALL;
  const target = path.join(javaRoot, 'page-assets-bootstrap', 'target');
  const find = async () =>
    (existsSync(target) ? await readdir(target) : []).find((file) => file.endsWith('.tar.gz'));
  let tarball = await find();
  if (!tarball) {
    log('   没有现成 tar.gz,执行 mvn -DskipTests package(首次会较慢)');
    const home = javaHome();
    run('mvn', ['-B', '-ntp', '-q', '-DskipTests', 'package'], {
      cwd: javaRoot,
      env: { ...process.env, ...(home ? { JAVA_HOME: home } : {}) }
    });
    tarball = await find();
  }
  if (!tarball) fail('打包后仍找不到 page-assets-bootstrap/target/*.tar.gz');
  return path.join(target, tarball);
}

async function startJava(db: { url: string; username: string; password: string }): Promise<string> {
  log('2/5 启动 Java 页面资产(PAGE_ASSETS_STORE=mysql,Flyway 建表)');
  const tarball = await locateTarball();
  const appRoot = await mkdtemp(path.join(os.tmpdir(), 'pa-slice-java-'));
  cleanups.push(() => rm(appRoot, { recursive: true, force: true }));
  run('tar', ['-xzf', tarball, '-C', appRoot]);
  const port = await freePort();
  const home = javaHome();
  const child = spawn(path.join(appRoot, 'script', 'start.sh'), [], {
    env: {
      ...process.env,
      ...(home ? { JAVA_HOME: home } : {}),
      LOG_DIR: path.join(appRoot, 'logs'),
      SERVER_PORT: String(port),
      PAGE_ASSETS_STORE: 'mysql',
      DB_URL: db.url,
      DB_USERNAME: db.username,
      DB_PASSWORD: db.password,
      JAVA_OPTS: '-Xms256m -Xmx512m'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const output: string[] = [];
  child.stdout?.on('data', (chunk: Buffer) => output.push(chunk.toString('utf8')));
  child.stderr?.on('data', (chunk: Buffer) => output.push(chunk.toString('utf8')));
  cleanups.push(() => stop(child));
  const baseUrl = `http://127.0.0.1:${port}/rest/cdi/pageassets/v1`;
  try {
    await waitFor('Java healthcheck', async () => {
      const response = await fetch(`${baseUrl}/healthcheck`);
      return response.ok;
    }, 90_000);
  } catch (error) {
    const text = output.join('');
    const causes = text.split('\n').filter((line) => /Caused by|APPLICATION FAILED|Error creating bean/.test(line));
    console.error(causes.length > 0 ? causes.join('\n') : text.slice(-4000));
    throw error;
  }
  const migrated = output.join('').match(/Successfully applied (\d+) migration|Schema .* is up to date/);
  console.log(`  Java 就绪 ${baseUrl}${migrated ? `(Flyway:${migrated[0]})` : ''}`);
  return baseUrl;
}

function stop(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve();
    child.once('exit', () => resolve());
    child.kill('SIGTERM');
    setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL');
    }, 5_000).unref();
  });
}

interface BuildPageOutput {
  ok: boolean;
  completedStages: string[];
  savedRevision: { pageId: string; revisionId: string; revisionNumber: number } | null;
  issues: Array<{ code: string; path: string; message: string; stage: string }>;
}

function buildPage(
  baseUrl: string,
  pageId: string,
  options: { baseRevisionId?: string; baseRevisionNumber?: number; title?: string } = {}
): BuildPageOutput {
  const args = [path.join(bundleRoot, 'test-harness', 'slice_client.py'), pageId];
  if (options.baseRevisionId) {
    args.push('--base-revision-id', options.baseRevisionId, '--base-revision-number', String(options.baseRevisionNumber ?? 1));
  }
  if (options.title) args.push('--title', options.title);
  const result = spawnSync(pythonExecutable(), args, {
    encoding: 'utf8',
    env: {
      ...process.env,
      PYTHONDONTWRITEBYTECODE: '1',
      METRICCANVAS_PAGE_ASSETS_BASE_URL: baseUrl,
      METRICCANVAS_OPERATOR_ID: OPERATOR
    }
  });
  const lastLine = result.stdout.trim().split('\n').pop() ?? '';
  if (!lastLine.startsWith('{')) {
    fail(`Python Tool 没有返回 build_page 结果(exit ${result.status}):\n${result.stderr.slice(-3000)}`);
  }
  return JSON.parse(lastLine) as BuildPageOutput;
}

function contentHashOf(document: unknown): string {
  return createHash('sha256').update(canonicalizeJson(document)).digest('hex');
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(`断言失败:${message}`);
}

async function main(): Promise<void> {
  const db = await startMySql();
  const baseUrl = await startJava(db);
  const pageId = `slice-${runId}`;

  log('3/5 Python Tool(真实 stdio MCP 子进程)调用 build_page → 真实 Java Adapter 保存');
  const first = buildPage(baseUrl, pageId);
  assert(first.ok && first.savedRevision, `首保失败:${JSON.stringify(first.issues)}`);
  assert(first.completedStages.at(-1) === 'save', `completedStages 应以 save 结束:${first.completedStages}`);
  assert(first.savedRevision.revisionNumber === 1, '首保修订号应为 1');
  console.log(`  已保存 ${pageId} R1 ${first.savedRevision.revisionId}`);

  log('4/5 platform Java Adapter 加载精确修订并核对');
  const lifecycle = createJavaPageLifecycle({ baseUrl, readOperatorId: 'platform' });
  const exact = await lifecycle.getRevision({ pageId, revisionId: first.savedRevision.revisionId });
  assert(exact.ok, `getRevision 失败:${JSON.stringify(exact)}`);
  assert(exact.revision.revisionNumber === 1 && exact.revision.pageId === pageId, '精确修订元数据不符');
  assert(exact.revision.createdBy === OPERATOR, `createdBy 应为 X-Operator-Id(${OPERATOR}),实际 ${exact.revision.createdBy}`);
  assert(exact.revision.dataContextVersion === '2026-09-02.1', `dataContextVersion 应来自 Data Context 快照,实际 ${exact.revision.dataContextVersion}`);
  assert(contentHashOf(exact.revision.document) === exact.revision.contentHash, 'TypeScript 侧 canonical sha256 与 Java contentHash 不一致');
  const latest = await lifecycle.getPage({ pageId, selector: { type: 'latest' } });
  assert(latest.ok && latest.revision.revisionId === exact.revision.revisionId, 'latest 应指向刚保存的修订');
  const listed = await lifecycle.listPages({ limit: 100 });
  assert(listed.pages.some((page) => page.pageId === pageId && page.latestRevision?.revisionId === exact.revision.revisionId), '目录里应有该页面');
  const published = await lifecycle.getPage({ pageId, selector: { type: 'published' } });
  assert(!published.ok && published.error.code === 'NOT_SUPPORTED', '已发布读取应如实 NOT_SUPPORTED');
  console.log(`  精确修订一致:contentHash=${exact.revision.contentHash.slice(0, 16)}… createdBy=${exact.revision.createdBy}`);

  log('5/5 幂等重放与同基线冲突');
  const replay = buildPage(baseUrl, pageId);
  assert(replay.ok && replay.savedRevision?.revisionId === first.savedRevision.revisionId, '同一 Spec 重放应原样返回 R1(Tool 派生幂等键 + Java 指纹幂等)');
  const second = buildPage(baseUrl, pageId, { baseRevisionId: first.savedRevision.revisionId, title: '第二版:各区域 Tokens 请求量' });
  assert(second.ok && second.savedRevision?.revisionNumber === 2, `基线 R1 上的第二版应为 R2:${JSON.stringify(second.issues)}`);
  const stale = buildPage(baseUrl, pageId, { baseRevisionId: first.savedRevision.revisionId, title: '过期基线上的第三版' });
  assert(!stale.ok && stale.issues[0]?.code === 'REVISION_CONFLICT' && stale.issues[0]?.stage === 'save', `过期基线应得 REVISION_CONFLICT(save 阶段):${JSON.stringify(stale.issues)}`);
  const latestAfter = await lifecycle.getPage({ pageId, selector: { type: 'latest' } });
  assert(latestAfter.ok && latestAfter.revision.revisionNumber === 2 && latestAfter.revision.baseRevisionId === first.savedRevision.revisionId, 'latest 应为 R2 且基线为 R1');
  console.log('  重放命中 R1;R2 落库;过期基线 → REVISION_CONFLICT');

  console.log(`\n✔ 纵切通过:Python stdio MCP → Java(${baseUrl}) → MySQL → platform Adapter 精确修订。`);
}

main()
  .then(cleanup)
  .catch(async (error) => {
    console.error(`\n✘ 纵切失败:${error instanceof Error ? error.message : error}`);
    await cleanup();
    process.exit(1);
  });
