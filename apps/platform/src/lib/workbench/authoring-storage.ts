/** Durable, identity-scoped snapshots. Credentials are not part of this contract. */
export interface StorageScope { actorId: string; workspaceId: string; pageId: string; resourceId?: string; channel?: 'management' }
export interface StoredRecord<T> { version: number; value: T }
export interface AuthoringStorage<T> {
  read(scope: StorageScope): Promise<StoredRecord<T> | null>;
  write(scope: StorageScope, expectedVersion: number, value: T): Promise<number>;
}
export class AuthoringStorageConflict extends Error {
  constructor() { super('其他窗口或先前工作已更新本地记录，已暂停同步并保留当前内容。'); this.name = 'AuthoringStorageConflict'; }
}
const keyOf = (scope: StorageScope) => JSON.stringify([scope.actorId, scope.workspaceId, scope.pageId, ...(scope.resourceId ? [scope.resourceId] : []), ...(scope.channel ? [scope.channel] : [])]);
export function createIndexedAuthoringStorage<T>(factory?: IDBFactory): AuthoringStorage<T> {
  let connection: Promise<IDBDatabase> | undefined;
  function open() {
    connection ??= new Promise<IDBDatabase>((resolve, reject) => {
      const source = factory ?? globalThis.indexedDB;
      if (!source) throw new Error('浏览器未提供创作存储能力。');
      const request = source.open('metriccanvas-authoring', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('work');
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); connection = undefined; };
        resolve(db);
      };
      request.onerror = () => { connection = undefined; reject(request.error); };
      request.onblocked = () => { connection = undefined; reject(new Error('浏览器创作存储升级被其他窗口阻塞。')); };
    }).catch((error: unknown) => { connection = undefined; throw error; });
    return connection;
  }
  return {
    async read(scope) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('work', 'readonly');
        const request = tx.objectStore('work').get(keyOf(scope));
        tx.oncomplete = () => resolve(request.result ?? null);
        tx.onabort = () => reject(tx.error ?? new Error('浏览器读取失败。'));
        tx.onerror = () => reject(tx.error ?? request.error);
      });
    },
    async write(scope, expectedVersion, value) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('work', 'readwrite');
        const store = tx.objectStore('work');
        const request = store.get(keyOf(scope));
        let conflict = false;
        request.onsuccess = () => {
          const record = request.result as StoredRecord<T> | undefined;
          if ((record?.version ?? 0) !== expectedVersion) { conflict = true; tx.abort(); return; }
          store.put({ version: expectedVersion + 1, value }, keyOf(scope));
        };
        tx.oncomplete = () => resolve(expectedVersion + 1);
        tx.onabort = () => reject(conflict ? new AuthoringStorageConflict() : tx.error ?? new Error('浏览器保护失败。'));
        tx.onerror = () => reject(tx.error ?? request.error);
      });
    }
  };
}
