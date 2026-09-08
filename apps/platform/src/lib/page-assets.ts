import { base } from '$app/paths';
import { createPageAssetsClient } from './page-assets-client';

export const pageAssets = createPageAssetsClient({ applicationBase: base });
