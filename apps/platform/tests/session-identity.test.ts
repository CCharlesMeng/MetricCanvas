import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MOCK_ACTOR_ID,
  MOCK_USERS,
  createIdentity,
  resolveMockActor,
  resolveMockUser,
  toTemplateContext,
  withClient,
  type MockUser
} from '../src/lib/server/identity.server';

function mustFind(actorId: string): MockUser {
  const user = MOCK_USERS.find((candidate) => candidate.actorId === actorId);
  if (!user) throw new Error(`mock 清单中缺少 ${actorId}`);
  return user;
}

describe('mock 多用户身份', () => {
  it('清单固定为 3 个用户,恰有一个平台管理员,默认用户在列', () => {
    expect(MOCK_USERS).toHaveLength(3);
    expect(MOCK_USERS.filter((user) => user.roles.includes('admin'))).toHaveLength(1);
    expect(MOCK_USERS.map((user) => user.actorId)).toContain(DEFAULT_MOCK_ACTOR_ID);
  });

  it('未指定时解析为默认 developer-1,不打断既有流程', () => {
    expect(resolveMockUser(null)?.actorId).toBe('developer-1');
    expect(resolveMockUser('')?.actorId).toBe('developer-1');
    expect(DEFAULT_MOCK_ACTOR_ID).toBe('developer-1');
  });

  it('可按请求值切换到清单中的任一用户', () => {
    for (const user of MOCK_USERS) {
      expect(resolveMockUser(user.actorId)).toEqual(user);
    }
  });

  it('清单外的用户返回 null,由 hooks 拒绝而不是静默回落', () => {
    expect(resolveMockUser('nobody')).toBeNull();
    expect(resolveMockUser('Developer-1')).toBeNull();
  });

  it('请求级判定:优先级 header > query > cookie > 默认', () => {
    const none = { header: null, query: null, cookie: null };
    expect(resolveMockActor(none)).toMatchObject({
      ok: true,
      user: { actorId: 'developer-1' },
      persist: false
    });
    expect(
      resolveMockActor({ header: 'admin-1', query: 'developer-2', cookie: 'developer-2' })
    ).toMatchObject({ ok: true, user: { actorId: 'admin-1' }, persist: false });
    expect(
      resolveMockActor({ header: null, query: 'developer-2', cookie: 'admin-1' })
    ).toMatchObject({ ok: true, user: { actorId: 'developer-2' }, persist: true });
    expect(
      resolveMockActor({ header: null, query: null, cookie: 'admin-1' })
    ).toMatchObject({ ok: true, user: { actorId: 'admin-1' }, persist: false });
  });

  it('查询参数切换要求持久化 cookie;header 是 API 调用方式,不持久化', () => {
    expect(resolveMockActor({ header: null, query: 'admin-1', cookie: null })).toMatchObject({
      ok: true,
      persist: true
    });
    expect(resolveMockActor({ header: 'admin-1', query: null, cookie: null })).toMatchObject({
      ok: true,
      persist: false
    });
  });

  it('显式指定清单外用户拒绝;cookie 残值宽松回落默认并要求清除', () => {
    expect(resolveMockActor({ header: 'nobody', query: null, cookie: null })).toEqual({
      ok: false,
      requested: 'nobody'
    });
    expect(resolveMockActor({ header: null, query: 'nobody', cookie: null })).toEqual({
      ok: false,
      requested: 'nobody'
    });
    expect(
      resolveMockActor({ header: null, query: null, cookie: 'retired-user' })
    ).toMatchObject({ ok: true, user: { actorId: 'developer-1' }, clearCookie: true });
  });

  it('默认身份与引入多用户前完全一致(workbench → developer-1 + publisher)', () => {
    expect(createIdentity('workbench')).toEqual({
      actorId: 'developer-1',
      clientId: 'workbench',
      roles: ['publisher']
    });
  });

  it('身份角色是客户端角色与用户级角色的并集', () => {
    const admin = createIdentity('workbench', mustFind('admin-1'));
    expect(admin.actorId).toBe('admin-1');
    expect(admin.roles).toContain('publisher');
    expect(admin.roles).toContain('admin');

    // page-editor 客户端本身零角色,admin-1 仍保有用户级 admin。
    const editor = createIdentity('page-editor', mustFind('admin-1'));
    expect(editor.roles).toEqual(['admin']);
    expect(createIdentity('page-editor', mustFind('developer-2')).roles).toEqual([]);
  });

  it('withClient 切换 clientId 不丢用户级 admin', () => {
    const derived = withClient(createIdentity('workbench', mustFind('admin-1')), 'page-editor');
    expect(derived.actorId).toBe('admin-1');
    expect(derived.clientId).toBe('page-editor');
    expect(derived.roles).toContain('admin');
  });

  it('withClient 对普通用户保持既有客户端角色语义', () => {
    const derived = withClient(createIdentity('workbench'), 'management-console');
    expect(derived.roles).toEqual(['admin']);
    expect(withClient(createIdentity('workbench'), 'page-editor').roles).toEqual([]);
  });

  it('toTemplateContext 对平台管理员窄化出 admin,普通用户为空', () => {
    expect(toTemplateContext(createIdentity('workbench', mustFind('admin-1'))).roles).toEqual([
      'admin'
    ]);
    expect(toTemplateContext(createIdentity('workbench')).roles).toEqual([]);
  });
});
