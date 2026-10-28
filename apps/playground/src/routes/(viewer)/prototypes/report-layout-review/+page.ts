import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';

export function load() {
  if (!dev) error(404, '临时布局审核页仅在开发环境开放');
}
