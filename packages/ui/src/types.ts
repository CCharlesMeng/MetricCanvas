/** Local calendar values; dates are not UTC instants. */
export interface DateRangeValue { from: string; to: string }

export interface UiOption { value: string; label: string; disabled?: boolean }
/** Stable business value; structural nodes can opt out of selection. */
export interface UiTreeOption extends UiOption { children?: UiTreeOption[]; selectable?: boolean }
export interface GridColumn { key: string; label: string; sortable?: boolean; width?: string }
export interface GridSort { key: string; direction: 'asc' | 'desc' }
