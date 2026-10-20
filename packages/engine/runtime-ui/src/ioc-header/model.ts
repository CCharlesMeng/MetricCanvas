import type { IocHeaderDeclaration } from '@metriccanvas/page/internal';
export interface ResolvedIocHeader {
  title?: string; code?: {label:string;value:string}; description?: {text:string;presentation?:'inline'|'tooltip'};
  tags: Array<{id:string;text:string;tone:string}>;
  facts: Array<{id:string;kind:string;label:string;value:string}>;
  density: 'normal'|'compact'; collapse: 'none'|'firstRow'|'overflow'; layout:'stacked'|'inline'; back: boolean;
  legacyBack?: boolean;
}
/** TextValue references have been materialized before this presentation seam. */
export function resolvedIocHeader(header: IocHeaderDeclaration): ResolvedIocHeader {
  const text = (value: unknown) => typeof value === 'string' && value.trim() && value !== '—' ? value : undefined;
  const identity = header.identity;
  const code = text(identity?.code?.value), label = text(identity?.code?.label);
  const description = text(identity?.description?.text);
  return {
    title: text(identity?.title), ...(code && label ? {code:{label,value:code}} : {}),
    ...(description ? {description:{text:description,presentation:identity?.description?.presentation}} : {}),
    tags: (identity?.tags ?? []).flatMap(tag => {const value=text(tag.text); return value ? [{id:tag.id,text:value,tone:tag.tone ?? 'neutral'}] : [];}),
    facts: (identity?.facts ?? []).flatMap(fact => {const value=text(fact.value),label=text(fact.label);return value && label ? [{id:fact.id,kind:fact.kind,label,value}] : [];}),
    layout:header.presentation?.layout ?? 'stacked', density:header.presentation?.density ?? 'normal', collapse:header.presentation?.collapse ?? 'none', back:header.back === true
  };
}
