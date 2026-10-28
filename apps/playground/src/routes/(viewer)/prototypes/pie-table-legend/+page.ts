import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';

export function load() {
  if (!dev) error(404, '仅用于开发环境的交互原型');
}
