import { createDqeGateway, type DqeGatewayConfig } from './dqe';
import { createPageDataExecutor } from './execute';
import type { PageDocument } from '@metriccanvas/page';

/** Trusted deployment supplies transport configuration; stdin/stdout carry only metadata. */
export async function executePageDataProgram(
  metadata: PageDocument, config: DqeGatewayConfig,context:{displayInputs?:()=>import('@metriccanvas/page/internal').DisplayInputsSnapshot|undefined;filterRevision?:()=>number;now?:Date}={}
): Promise<PageDocument> {
  if (!config.endpoint || !URL.canParse(config.endpoint)) throw new Error('Node取数需要绝对DQE地址');
  return createPageDataExecutor({ gateway: createDqeGateway(config),...context }).execute(metadata);
}
