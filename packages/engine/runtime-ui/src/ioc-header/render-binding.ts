import type { Snippet } from 'svelte';
import type { ResolvedIocHeader } from './model';
import type { TextBlockLink } from '../../../widgets/src/internal';
import type { ResolvedHeaderFilterRow } from './filter-groups';
export interface IocHeaderRenderBinding {
  model:ResolvedIocHeader;
  titleLink?:TextBlockLink;
  filterIds:string[];
  overflowIds?:string[];
  filterRows?:ResolvedHeaderFilterRow[];
  controls:Snippet<[string,boolean]>;
  returnContext?:{entryId:string;label?:string;back?:()=>void};
  onback?:()=>void;
  readOnly?:boolean;
  note?:string;
}
