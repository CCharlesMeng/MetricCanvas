import type { TypedError } from './errors';

export type MigrationChange = { rule: string; path: string; message: string };
export type JsonObject = Record<string, unknown>;

export function object(value: unknown): JsonObject | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonObject : undefined;
}

export function migrationError(path: string, message: string): TypedError {
  return { type: 'SCHEMA_ERROR', path, message };
}
