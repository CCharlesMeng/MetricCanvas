import type { LayoutServerLoad } from './$types';
import { MOCK_USERS } from '$lib/server/identity.server';

/** 顶栏身份区的数据:当前 mock 用户与可切换清单(唯一清单的投影)。 */
export const load: LayoutServerLoad = ({ locals }) => ({
  identity: {
    actorId: locals.identity.actorId,
    isAdmin: locals.identity.roles?.includes('admin') ?? false
  },
  mockUsers: MOCK_USERS.map((user) => ({
    actorId: user.actorId,
    isAdmin: user.roles.includes('admin')
  }))
});
