import {fieldName, mapGeographyEntryZ, type MapGeography, type MapGeographyEntry, type MapChartProps, type Row} from '@metriccanvas/page/internal';

export type OrganizationLevel = 'region-dept' | 'office';
export type RegionMapDisplayNames = Readonly<Partial<Record<OrganizationLevel, Readonly<Record<string, string>>>>>;
type Entry = MapGeographyEntry;
export interface GeographyInput {
  host?: MapGeography;
  page?: MapGeography;
  displayNames?: RegionMapDisplayNames;
}

export function organizationBinding(props: MapChartProps): {level:OrganizationLevel; field:string} | undefined {
  if (props.hierarchyFilter === 'region' && props.parentField && props.codeField) return {level:'office',field:fieldName(props.codeField)};
  for (const action of props.actions ?? []) {
    if ('writeFilter' in action && action.writeFilter === 'region' && (action.level === 'region-dept' || action.level === 'office')) {
      return {level:action.level,field:'field' in action && action.field ? fieldName(action.field) : fieldName(props.nameField)};
    }
  }
}

function lookup(catalog: MapGeography | undefined, map: 'china'|'world', level: OrganizationLevel, value: string) {
  const entries = catalog?.[map]?.[level];
  return entries && Object.hasOwn(entries, value) ? entries[value] : undefined;
}

// Host configuration is a snapshot. Publish replaced records when it changes.
const validated = new WeakMap<Entry, Entry>();
function validatedEntry(raw: Entry): Entry | undefined {
  if (typeof raw !== 'object' || !raw) return;
  const cached = validated.get(raw);
  if (cached) return cached;
  const result = mapGeographyEntryZ.safeParse(raw);
  if (result.success) {
    validated.set(raw,result.data);
    return result.data;
  }
  console.warn('MC 地理资料字段无效',result.error.issues.map(issue=>issue.path.join('.')));
  const point = mapGeographyEntryZ.shape.point.safeParse(raw.point);
  const viewport = mapGeographyEntryZ.shape.viewport.safeParse(raw.viewport);
  const features = mapGeographyEntryZ.shape.features.safeParse(raw.features);
  const entry = {point:point.data,viewport:viewport.data,features:features.data};
  validated.set(raw,entry);
  return entry;
}

export function organizationEntries(input: GeographyInput, map: 'china'|'world', level: OrganizationLevel, value: string) {
  const raw = lookup(input.host,map,level,value);
  return {host:raw && validatedEntry(raw), page:lookup(input.page,map,level,value)};
}

export function resolvePlacement(host: Entry | undefined, page: Entry | undefined, alias: string | undefined, value: string) {
  const point = page?.point ?? (alias ? {feature:alias} : host?.point);
  const features = page?.features ?? host?.features ?? [alias ?? value];
  return {point:point ?? {feature:value}, features};
}

function organizationDisplayName(names: Readonly<Record<string, string>> | undefined, value: string) {
  if (!value) return;
  const name = names && Object.hasOwn(names, value) ? names[value] : undefined;
  return typeof name === 'string' ? name.trim() || undefined : undefined;
}

export function mapRows(rows: Row[], nameField: string, props: MapChartProps, input?: GeographyInput) {
  const points = new Map<string, Row>();
  const areas = new Map<string, Row | undefined>();
  const placements = new Map<Row, ReturnType<typeof resolvePlacement>>();
  const displayNames = new Map<Row, string>();
  const binding = organizationBinding(props);
  const organizationNames = binding && input?.displayNames?.[binding.level];
  const shared = Boolean(binding && (input?.host || input?.page));
  for (const row of rows) {
    const name = String(row[nameField] ?? '');
    const organization = String(row[binding?.field ?? nameField] ?? '');
    const entries = binding && input ? organizationEntries(input, props.map, binding.level, organization) : {host:undefined, page:undefined};
    const placement = resolvePlacement(entries.host, entries.page, props.nameMap?.[name], name);
    const displayName = organizationDisplayName(organizationNames, organization);
    if (displayName) displayNames.set(row, displayName);
    placements.set(row, placement);
    points.set(name,row);
    for (const feature of placement.features) areas.set(feature,shared && areas.has(feature) ? undefined : row);
  }
  return {points, areas, placements, shared, displayNames};
}
