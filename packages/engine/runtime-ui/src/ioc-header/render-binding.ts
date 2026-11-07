import type { Snippet } from 'svelte';
import type { ResolvedIocHeader } from './model';
export interface IocHeaderRenderBinding {
  model:ResolvedIocHeader;
  filterIds:string[];
  overflowIds?:string[];
  controls:Snippet<[string,boolean]>;
  returnContext?:{entryId:string;label?:string;back?:()=>void};
  onback?:()=>void;
  readOnly?:boolean;
  note?:string;
}
