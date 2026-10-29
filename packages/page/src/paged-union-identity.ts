import type { FieldDefinition } from './field';
import type { PagedUnionMember } from './paged-union';

/** Declaration order is identity order; never sort or normalize the fields or values. */
export function unionMemberKeyFields(member: PagedUnionMember): readonly string[] {
  if ('rowKeyGeneration' in member) return [];
  return 'rowKeyFields' in member ? member.rowKeyFields : [member.rowKey];
}

export function validGeneratedUnionKey(value: unknown): boolean {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
}

export function validUnionKeyPart(value: unknown, type: FieldDefinition['type'] | undefined): boolean {
  if (typeof value !== type) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return typeof value === 'number' && Number.isFinite(value);
}
