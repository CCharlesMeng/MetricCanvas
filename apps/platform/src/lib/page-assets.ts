import { createPageAssetsClient } from './page-assets-client';

export const pageAssets = createPageAssetsClient();

import { confirmedPageAssetCapabilities, type AuthoringPort } from './workbench/authoring-coordinator';

export const pageAuthoringPort: AuthoringPort = { ...pageAssets, capabilities: confirmedPageAssetCapabilities };
