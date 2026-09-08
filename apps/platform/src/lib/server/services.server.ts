import { env } from '$env/dynamic/private';
import {
  createMemoryPageLifecycle,
  type DataContextVersionProvider,
  type PageLifecycle
} from '@metriccanvas/page-lifecycle';
import { createPostgresPageLifecycle } from '@metriccanvas/persistence-postgres';
import { createJavaPageLifecycle } from '@metriccanvas/page-assets-java';
import {
  resolveMetricCanvasRole,
  type MetricCanvasRole
} from './identity.server';
import { seedPublishedPages } from './offline-services';
import {
  bundledDataContext,
  bundledPageModules
} from './bundled-assets.server';

type ServerEnvironment = Record<string, string | undefined>;

const bundledPageSeeds = Object.values(bundledPageModules).map((module) => module.default);
/** 内置种子的内容指纹:dev 下种子 JSON 变更会重新执行本模块,指纹随之改变。 */
const seedSignature = JSON.stringify(bundledPageSeeds);

/** reader 部署唯一可见的页面生命周期 Interface。 */
type ReaderPageLifecycle = Pick<
  PageLifecycle,
  'listPages' | 'getPublished' | 'getPublishedRevision'
>;

interface CommonPlatformServices {
  runtimeOrigin: string;
}

export interface ReaderPlatformServices extends CommonPlatformServices {
  role: 'reader';
  lifecycle: ReaderPageLifecycle;
}

export interface AuthoringPlatformServices extends CommonPlatformServices {
  role: 'authoring';
  lifecycle: PageLifecycle;
}

type PlatformServices = ReaderPlatformServices | AuthoringPlatformServices;

const serviceCache = globalThis as typeof globalThis & {
  __metricCanvasPlatformServicesPromise?: Promise<PlatformServices>;
  __metricCanvasPlatformSeedSignature?: string;
  __metricCanvasPlatformModuleEpoch?: number;
};

/**
 * 本次模块执行的纪元号。dev 下改了任何服务端代码,Vite 会重新执行本模块与
 * 它的依赖,于是这个常量拿到一个新值——比对 globalThis 上记的值即可判出
 * 「缓存实例来自上一份代码」。生产只执行一次,恒等。
 */
const moduleEpoch = Date.now();

function getConfiguredPlatformServices(): Promise<PlatformServices> {
  discardStaleServices();
  serviceCache.__metricCanvasPlatformServicesPromise ??= createPlatformServices(env).catch((cause) => {
    serviceCache.__metricCanvasPlatformServicesPromise = undefined;
    throw cause;
  });
  return serviceCache.__metricCanvasPlatformServicesPromise;
}

/**
 * 保留既有零参 authoring 组合根形状。reader 部署上调用创作期入口
 * 失败关闭，无需把类型窄化扩散到所有既有 authoring 路由。
 */
export async function getPlatformServices(): Promise<AuthoringPlatformServices> {
  const services = await getConfiguredPlatformServices();
  if (services.role !== 'authoring') {
    throw new Error('reader 部署不提供创作期能力');
  }
  return services;
}

/** reader / authoring 共用的受控读取组合根，仅 runtime 与 data 入口使用。 */
export function getRuntimePlatformServices(): Promise<PlatformServices> {
  return getConfiguredPlatformServices();
}

/**
 * 实例缓存挂在 globalThis 上,模块被 dev 重新执行也活着——这保住了内存态,
 * 但也让缓存实例的闭包一直指着旧代码。两种情形必须丢弃重建:
 *
 * - **服务端代码改动**(dev):模块重新执行即纪元号变化。缓存实例是在上一份
 *   代码里构造的,它闭包里的编排、端口与模型全是旧的;不丢弃就会出现「改完
 *   代码、页面刷新过、行为却没变」——排查时几乎无从下手,因为源码是新的。
 * - **offline 种子变化**(dev + offline):播种只发生在实例创建那一刻,种子
 *   指纹变了不重建就只能读到进程启动那一刻的页面快照。
 *
 * 两者的代价相同:内存中的页面资产随之清空。这个
 * 代价只在 dev 付,且比跑着旧代码便宜。
 */
function discardStaleServices(): void {
  if (!import.meta.env.DEV) return;
  const seedChanged =
    env.METRICCANVAS_OFFLINE === '1' &&
    serviceCache.__metricCanvasPlatformSeedSignature !== seedSignature;
  const codeChanged = serviceCache.__metricCanvasPlatformModuleEpoch !== moduleEpoch;
  if (!seedChanged && !codeChanged) return;
  serviceCache.__metricCanvasPlatformSeedSignature = seedSignature;
  serviceCache.__metricCanvasPlatformModuleEpoch = moduleEpoch;
  serviceCache.__metricCanvasPlatformServicesPromise = undefined;
}

export function resolvePlatformDatabaseUrl(
  environment: ServerEnvironment,
  role: MetricCanvasRole
): string {
  const authoring =
    environment.DATABASE_URL?.trim() ||
    'postgres://metriccanvas:metriccanvas@localhost:5432/metriccanvas';
  if (role === 'authoring') return authoring;
  const reader = environment.METRICCANVAS_READER_DATABASE_URL?.trim();
  if (!reader) {
    throw new Error('reader 部署必须配置 METRICCANVAS_READER_DATABASE_URL 只读账号');
  }
  return reader;
}

/**
 * 页面资产后端(ADR-0062 J4):`postgres`(缺省,既有实现)或 `java`(第一方 Java 页面资产,
 * 只开放四个接口,其余能力返回 `NOT_SUPPORTED`)。`METRICCANVAS_OFFLINE=1` 优先于两者。
 */
export type PageAssetsBackend = 'postgres' | 'java';

export function resolvePageAssetsBackend(environment: ServerEnvironment): PageAssetsBackend {
  const value = environment.METRICCANVAS_PAGE_ASSETS?.trim().toLowerCase() || 'postgres';
  if (value === 'postgres' || value === 'java') return value;
  throw new Error(`METRICCANVAS_PAGE_ASSETS 只接受 postgres | java,收到 ${value}`);
}

export function resolveJavaPageAssetsBaseUrl(environment: ServerEnvironment): string {
  const baseUrl = environment.METRICCANVAS_PAGE_ASSETS_BASE_URL?.trim();
  if (!baseUrl) {
    throw new Error(
      'METRICCANVAS_PAGE_ASSETS=java 必须配置 METRICCANVAS_PAGE_ASSETS_BASE_URL,如 http://host:8080/rest/cdi/pageassets/v1'
    );
  }
  return baseUrl;
}

export async function createPlatformServices(
  environment: ServerEnvironment
): Promise<PlatformServices> {
  const role = resolveMetricCanvasRole(environment);
  const runtimeOrigin = environment.RUNTIME_ORIGIN ?? 'http://localhost:5173';
  const platformOrigin = environment.PLATFORM_ORIGIN ?? 'http://localhost:5174';
  const offline = environment.METRICCANVAS_OFFLINE === '1';
  const pageAssets = resolvePageAssetsBackend(environment);
  // 旧页面资产 Java 适配器不依赖 PostgreSQL。
  const databaseUrl =
    offline || pageAssets === 'java' ? null : resolvePlatformDatabaseUrl(environment, role);
  // 旧页面资产适配器仍需保存数据上下文版本；不再构造问数检索与模型。
  const dataContextVersion: DataContextVersionProvider = {
    current: async () => ({ version: bundledDataContext.version })
  };
  const lifecycleOptions = {
    dataContext: dataContextVersion,
    urls: {
      confirmation: (requestId: string, token: string) =>
        `${platformOrigin}/publish/${requestId}/confirm?token=${encodeURIComponent(token)}`
    }
  };
  const lifecycle = offline
    ? await createOfflinePageLifecycle(lifecycleOptions)
    : pageAssets === 'java'
      ? createJavaPageLifecycle({
          baseUrl: resolveJavaPageAssetsBaseUrl(environment),
          dataContext: dataContextVersion,
          readOperatorId: environment.METRICCANVAS_PAGE_ASSETS_READ_OPERATOR?.trim() || 'platform'
        })
      : await createPostgresPageLifecycle({
          ...lifecycleOptions,
          databaseUrl: databaseUrl as string
        });

  if (role === 'reader') {
    const services: ReaderPlatformServices = {
      role,
      lifecycle,
      runtimeOrigin
    };
    return services;
  }

  return { role, lifecycle, runtimeOrigin };
}

async function createOfflinePageLifecycle(
  options: Parameters<typeof createMemoryPageLifecycle>[0]
): Promise<PageLifecycle> {
  const lifecycle = createMemoryPageLifecycle(options);
  await seedPublishedPages(
    lifecycle,
    Object.values(bundledPageModules).map((module) => module.default)
  );
  return lifecycle;
}
