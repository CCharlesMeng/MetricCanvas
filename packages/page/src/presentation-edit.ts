import {visitTableColumns} from './table/columns';
import { columnEditTarget, columnEditTargets, type ColumnTarget } from './table/edit';
import { walkDocumentComponents } from './component-walk';
export type PresentationTarget = ColumnTarget | {
    kind: 'section';
    id: string;
} | {
    kind: 'filter';
    id: string;
} | {
    kind: 'sectionGroup';
    id: string;
} | {
    kind: 'component';
    id: string;
} | {
    kind: 'row';
    id: string;
} | {
    kind: 'tab';
    id: string;
    tabId: string;
} | {
    kind: 'part';
    id: string;
    partId: string;
} | {
    kind: 'action';
    id: string;
    action: 'navigate' | 'openDetail' | 'writeFilter';
    filterId?: string;
} | {
    kind: 'link';
    id: string;
    href: string;
} | {
    kind: 'toolbar';
    id: string;
    slot: 'search' | 'export';
} | {
    kind: 'column';
    id: string;
    field: string;
    slot: 'navigate' | 'openDetail' | 'selection';
};
type Node = Record<string, any>;
type TargetItem = {
    target: PresentationTarget;
    label: string;
    enabled: boolean;
};
function only(nodes: Node[]): Node | undefined { return nodes.length === 1 ? nodes[0] : undefined; }
function entryTarget(component: Node, target: PresentationTarget): Node | undefined {
    const props = component.props as Node;
    switch (target.kind) {
        case 'toolbar': return component.type === 'table' ? props.toolbar?.[target.slot] : undefined;
        case 'link': return only((props.links ?? []).filter((link: Node) => link.href === target.href));
        case 'action': {
            const actions = component.type === 'button' ? [props.action] : props.actions ?? [];
            return only(actions.filter((action: Node) => target.action in action && (target.action !== 'writeFilter' || !target.filterId || action.writeFilter === target.filterId)));
        }
        case 'column': {
            const matches:Node[]=[];
            visitTableColumns<Node>(props.columns??[],'',node=>{if(node.kind!=='group'&&(typeof node.field==='string'?node.field:node.field?.field)===target.field)matches.push(node);});
            return only(matches)?.[target.slot];
        }
    }
}
function childTarget(component: Node, target: PresentationTarget): Node | undefined {
    const props = component.props as Node;
    switch (target.kind) {
        case 'component': return component;
        case 'row': return component.type === 'table' ? props : undefined;
        case 'tab': return component.type === 'tabContainer' ? props.tabs.find((tab: Node) => tab.id === target.tabId) : undefined;
        case 'part': return component.type === 'text' ? props.parts?.find((part: Node) => part.id === target.partId) : undefined;
        case 'tableColumn': return component.type === 'table' ? columnEditTarget(props, target) : undefined;
        default: return entryTarget(component, target);
    }
}
/** Always resolve against declarations, before any visibility or field projection. */
export function presentationTarget(document: unknown, target: PresentationTarget): Node | undefined {
    const page = document as Node;
    if (target.kind === 'section' || target.kind === 'filter' || target.kind === 'sectionGroup') {
        const key = { section: 'sections', filter: 'filters', sectionGroup: 'sectionGroups' }[target.kind];
        return page[key]?.find((node: Node) => node.id === target.id);
    }
    let component: Node | undefined;
    walkDocumentComponents(document, node => { if (node.id === target.id)
        component = node; });
    return component ? childTarget(component, target) : undefined;
}
function tableTargets(id: string, props: Node): TargetItem[] {
    const items: TargetItem[] = [...columnEditTargets(id, props), { target: { kind: 'row', id }, label: `表格行 · ${id}`, enabled: false }];
    for (const slot of ['search', 'export'] as const)
        if (props.toolbar?.[slot])
            items.push({ target: { kind: 'toolbar', id, slot }, label: `${id} · ${slot}`, enabled: true });
    visitTableColumns<Node>(props.columns??[],'',col=>{
        if(col.kind==='group')return;
        for(const slot of ['navigate','openDetail','selection'] as const)if(col[slot])items.push({target:{kind:'column',id,field:typeof col.field==='string'?col.field:col.field.field,slot},label:`${id} · ${typeof col.field==='string'?col.field:col.field.field} · ${slot}`,enabled:true});
    });
    return items;
}
function actionTargets(node:Node):TargetItem[]{
 const props=node.props as Node,id=node.id as string;
 const items:TargetItem[]=[];
 const add=(target:PresentationTarget,label:string,enabled=false)=>items.push({target,label,enabled});
        for (const action of node.type === 'button' ? [props.action] : props.actions ?? [])
            for (const kind of ['navigate', 'openDetail', 'writeFilter'] as const)
                if (kind in action)
                    add({ kind: 'action', id, action: kind, ...(kind === 'writeFilter' ? { filterId: action.writeFilter } : {}) }, `${id} · ${kind}`, true);
 return items;
}
export function presentationTargets(document: unknown): TargetItem[] {
    const page = document as Node;
    const items: TargetItem[] = [];
    const add = (target: PresentationTarget, label: string, enabled = false) => items.push({ target, label, enabled });
    for (const [key, kind] of [['sections', 'section'], ['filters', 'filter'], ['sectionGroups', 'sectionGroup']] as const)
        for (const node of page[key] ?? [])
            add({ kind, id: node.id }, `${kind} · ${node.id}`);
    walkDocumentComponents(document, node => {
        const id = node.id as string, props = node.props as Node;
        add({ kind: 'component', id }, `${node.type} · ${id}`, node.type === 'button');
        if (node.type === 'table')
            items.push(...tableTargets(id, props));
        if (node.type === 'text')
            for (const link of props.links ?? [])
                add({ kind: 'link', id, href: link.href }, `${id} · 链接 ${link.href}`, true);
        for (const tab of props.tabs ?? [])
            add({ kind: 'tab', id, tabId: tab.id }, `${id} · Tab ${tab.id}`);
        if (node.type === 'text')
            for (const part of props.parts ?? [])
                add({ kind: 'part', id, partId: part.id }, `${id} · 片段 ${part.id}`);
        items.push(...actionTargets(node));
    });
    return items;
}
