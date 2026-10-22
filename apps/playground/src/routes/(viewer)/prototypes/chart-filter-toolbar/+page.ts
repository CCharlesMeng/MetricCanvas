import { chartFilterPreview } from '../../../../../fixtures/legacy-preview';
import { redirect } from '@sveltejs/kit';

export function load({ url }: { url: URL }) {
  redirect(307, chartFilterPreview + url.search);
}
