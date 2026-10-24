import type {DialogueAgentPort} from '../integration/contract';

export function sessionIdOf(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > 512 || /[\x00-\x1f\x7f]/.test(value)) throw Error('云宝会话 ID 无效。');
  return value;
}

/** Reuse pending creation across route effects; only the returned cloud ID becomes identity. */
export function createDialogueSessions(port: DialogueAgentPort) {
  const pending = new Map<string, Promise<string>>();
  const openedFrom = new Map<string, string>();
  const restored = new Set<string>();
  const controller = new AbortController();
  return {
    async open(sessionId: string | null, openingKey: string): Promise<string> {
      controller.signal.throwIfAborted();
      if (sessionId && restored.has(sessionId)) {
        // Acknowledging the URL clears its creation cache; deleting that ID later creates anew.
        const key = openedFrom.get(sessionId);
        if (key) pending.delete(key);
        openedFrom.delete(sessionId);
        return sessionId;
      }
      const key = sessionId ? 'restore:' + sessionId : 'create:' + openingKey;
      const existing = pending.get(key);
      if (existing) return existing;
      const promise = port.openSession(sessionId ? {sessionId: sessionIdOf(sessionId)} : {}, controller.signal).then(result => {
        controller.signal.throwIfAborted();
        const id = sessionIdOf(result.sessionId);
        if (sessionId && id !== sessionId) throw Error('恢复的云宝会话与地址不一致。');
        restored.add(id);
        openedFrom.set(id, key);
        return id;
      });
      pending.set(key, promise);
      try {return await promise;}
      catch (error) {if (pending.get(key) === promise) pending.delete(key); throw error;}
    },
    dispose() {controller.abort(); restored.clear(); openedFrom.clear(); pending.clear();}
  };
}
