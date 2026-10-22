import {error,redirect} from '@sveltejs/kit';
import {pageLegacyPathTarget} from '$lib/page-catalog';

export function load({url}: {url: URL}) {
  const target=pageLegacyPathTarget(url.pathname);
  if(!target)error(404,'示例入口不存在');
  redirect(307,target+url.search);
}
