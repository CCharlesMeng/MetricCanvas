import { z } from 'zod';
import { componentZ } from './schema/component';
import { walkDocumentComponents } from './component-walk';

type SchemaNode = {
  $ref?: string;
  definitions?: Record<string, SchemaNode>;
  properties?: Record<string, SchemaNode>;
  additionalProperties?: SchemaNode | boolean;
  items?: SchemaNode;
  anyOf?: SchemaNode[];
  oneOf?: SchemaNode[];
  allOf?: SchemaNode[];
  const?: unknown;
};
type ObjectValue = Record<string, unknown>;
interface BindingEntry { binding: ObjectValue; path: string }
let bindingSchema: SchemaNode | undefined;
const token = (key: string) => key.replaceAll('~', '~0').replaceAll('/', '~1');

function matchesComponentType(value: ObjectValue | undefined, node: SchemaNode): boolean {
  const type = node.properties?.type;
  return !type || !Object.hasOwn(type, 'const') || value?.type === type.const;
}

function object(value: unknown): ObjectValue | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as ObjectValue : undefined;
}

/** Follow only product-declared static field bindings, never arbitrary field-shaped JSON. */
function bindingEntries(document: unknown): BindingEntry[] {
  const schema = bindingSchema ??= z.toJSONSchema(componentZ, { target: 'draft-7' }) as SchemaNode;
  const entries = new Map<string, BindingEntry>();
  walkDocumentComponents(document, (component, path) => visit(component, schema, path));
  return [...entries.values()];

  function visit(value: unknown, node: SchemaNode, path: string): void {
    if (value === undefined) return;
    if (node.$ref) {
      const name = node.$ref.split('/').at(-1)!;
      if (name === 'staticFieldBinding') {
        const binding = object(value);
        if (binding && typeof binding.field === 'string') entries.set(path, { binding, path });
        return;
      }
      const target = schema.definitions?.[name];
      if (target) visit(value, target, path);
      return;
    }
    const record = object(value);
    if (!matchesComponentType(record, node)) return;
    for (const branch of [...node.anyOf ?? [], ...node.oneOf ?? [], ...node.allOf ?? []]) visit(value, branch, path);
    if (Array.isArray(value) && node.items) {
      const items = node.items;
      value.forEach((item, index) => visit(item, items, `${path}/${index}`));
    }
    if (record) visitProperties(record, node, path);
  }

  function visitProperties(value: ObjectValue, node: SchemaNode, path: string): void {
    for (const [key, child] of Object.entries(value)) {
      const property = node.properties?.[key] ?? node.additionalProperties;
      if (property && typeof property === 'object') visit(child, property, `${path}/${token(key)}`);
    }
  }
}

/** Raw-document capability detection must run before defaults are materialized. */
export function defaultMainBindingPaths(document: unknown): string[] {
  return bindingEntries(document).filter(entry => entry.binding.data === undefined).map(entry => entry.path);
}

/** Called on the materializer's private clone; persisted input keeps its concise declaration. */
export function materializeMainBindingSlots(document: unknown): void {
  for (const { binding } of bindingEntries(document)) {
    if (binding.data === undefined) binding.data = 'main';
  }
}
