import type { DataUse } from './data-scan';
export type Json = Record<string, any>;
export interface AnalysisIssue { code: string; path: string; message: string }
export interface BaselineIdentity {
  documentSha256: string; source: 'file' | 'working-copy'; pageId: string;
  workVersion?: number; binding?: Json;
  schemaSha256: string; schemaSerialization: 'JSON.stringify(product-page-schema)';
  materialSha256: string | null;
}
export interface StableDataUse extends DataUse { useId: string; identityAmbiguous: boolean; pointers:string[]; roles:string[]; labels:string[] }
export interface AnalysisLink {
  requirementId: string; dataRequestId: string; useId: string; outputField: string; resultRef?: string;
}
export interface AnalysisReport {
  format: 'metriccanvas-analysis/1'; baseline: BaselineIdentity;
  execution: 'not-run'; uses: StableDataUse[]; sources: Json;
  requirements: Array<{id:string;text:string}>; dataRequests: Json[];
  links: AnalysisLink[]; results: Json[]; indexes: Json;
  reading: Json; diagnostics: Array<Json>; gaps: Json[];
}
export interface AnalysisInput {
  document: Json; schema: Json; baseline: BaselineIdentity; materialText?: string;
  requirements?: Array<{id:string;text:string}>; dataRequests?: Json[];
  links?: AnalysisLink[]; resultRecords?: Record<string, Json>; context?: Json;
  priorReport?: AnalysisReport; componentIds?: string[];
}
export const issue = (code:string,path:string,message:string):AnalysisIssue => ({code,path,message});
