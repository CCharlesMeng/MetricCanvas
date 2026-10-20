/** Local calendar values; dates are not UTC instants. */
export interface DateRangeValue { from: string; to: string }

export interface UiOption { value: string; label: string; disabled?: boolean }
export interface GridColumn { key: string; label: string; sortable?: boolean; width?: string }
export interface GridSort { key: string; direction: 'asc' | 'desc' }

export interface UiTreeNode {key:string;label:string;value?:string;children?:UiTreeNode[];disabled?:boolean}
