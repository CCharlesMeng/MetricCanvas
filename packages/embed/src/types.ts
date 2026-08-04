import type { TypedError } from '@metriccanvas/page';
import type { DataGateway } from '@metriccanvas/runtime';
import type { AiSummaryConfig } from '@metriccanvas/runtime-ui';

export interface RuntimeInput {
  document: unknown;
  dataGateway?: DataGateway;
  aiSummary?: AiSummaryConfig;
  /** URLSearchParams 形式，不带前导问号。 */
  initialSearch?: string;
}

export type RuntimeEvent =
  | { type: 'ready'; pageId: string }
  | { type: 'invalid'; errors: TypedError[] }
  | {
      type: 'configuration-error';
      code:
        | 'DATA_GATEWAY_REQUIRED'
        | 'DATA_GATEWAY_INVALID';
      message: string;
    }
  | { type: 'filter-change'; search: string }
  | { type: 'navigate'; pageId: string; search: string };

export interface MountOptions extends RuntimeInput {
  onEvent?: (event: RuntimeEvent) => void;
}

export interface RuntimeHandle {
  update(input: RuntimeInput): void;
  destroy(): void;
}
