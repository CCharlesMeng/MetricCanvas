import type { FieldRole, FieldType, JsonObject } from '@metriccanvas/page';

export interface DataContextSnapshot {
  formatVersion: '1.0';
  id: string;
  version: string;
  generatedAt: string;
  source: string;
  executionEnvironments: ExecutionEnvironment[];
}

export interface ExecutionEnvironment {
  id: string;
  name: string;
  language: 'dqe';
  endpointRef: string;
  description?: string;
  schemas: DataSchema[];
  constraints: {
    readOnly: true;
    maxRows: number;
    maxColumns: number;
    maxQueriesPerBatch: number;
    timeoutMs: number;
  };
  security: {
    scope: string;
    notes?: string[];
  };
}

export interface DataSchema {
  id: string;
  name: string;
  description: string;
  objects: DataObject[];
  relationships: DataRelationship[];
  verifiedQueries: VerifiedQuery[];
}

export interface DataObject {
  id: string;
  name: string;
  kind: 'dataset';
  description: string;
  fields: DataField[];
}

export interface DataField {
  name: string;
  type: FieldType;
  description: string;
  aliases?: string[];
  roleHints: Array<FieldRole | 'time'>;
  unit?: string;
  granularity?: string;
  nullable: boolean;
  sensitive: boolean;
}

export interface DataRelationship {
  id: string;
  from: { object: string; field: string };
  to: { object: string; field: string };
  cardinality: 'one-to-one' | 'one-to-many' | 'many-to-one';
  description: string;
}

export interface VerifiedQuery {
  id: string;
  question: string;
  description: string;
  language: 'dqe';
  body: { dsl_list: [JsonObject] };
  resultFields: Array<{
    name: string;
    type: FieldType;
    role: FieldRole;
    unit?: string;
    nullable: boolean;
  }>;
}

export interface DataContextProvider {
  current(): Promise<DataContextSnapshot>;
}

export type DataContextMatch =
  | {
      kind: 'environment';
      environmentId: string;
      name: string;
      description?: string;
    }
  | {
      kind: 'schema';
      environmentId: string;
      schemaId: string;
      name: string;
      description: string;
    }
  | {
      kind: 'object';
      environmentId: string;
      schemaId: string;
      objectId: string;
      name: string;
      description: string;
    }
  | {
      kind: 'field';
      environmentId: string;
      schemaId: string;
      objectId: string;
      field: DataField;
    }
  | {
      kind: 'verifiedQuery';
      environmentId: string;
      schemaId: string;
      query: VerifiedQuery;
    };

export interface DataContextSearch {
  current(): Promise<DataContextSnapshot>;
  search(input: { query: string; limit?: number }): Promise<{
    dataContextVersion: string;
    matches: DataContextMatch[];
  }>;
}

export function createDataContextSearch(
  provider: DataContextProvider
): DataContextSearch {
  return {
    current: () => provider.current(),
    async search({ query, limit = 10 }) {
      const snapshot = await provider.current();
      const needle = query.trim().toLocaleLowerCase();
      if (!needle || limit <= 0) {
        return { dataContextVersion: snapshot.version, matches: [] };
      }
      const candidates: Array<{ match: DataContextMatch; text: string }> = [];
      for (const environment of snapshot.executionEnvironments) {
        candidates.push({
          match: {
            kind: 'environment',
            environmentId: environment.id,
            name: environment.name,
            ...(environment.description ? { description: environment.description } : {})
          },
          text: [environment.id, environment.name, environment.description].join(' ')
        });
        for (const schema of environment.schemas) {
          candidates.push({
            match: {
              kind: 'schema',
              environmentId: environment.id,
              schemaId: schema.id,
              name: schema.name,
              description: schema.description
            },
            text: [schema.id, schema.name, schema.description].join(' ')
          });
          for (const object of schema.objects) {
            candidates.push({
              match: {
                kind: 'object',
                environmentId: environment.id,
                schemaId: schema.id,
                objectId: object.id,
                name: object.name,
                description: object.description
              },
              text: [object.id, object.name, object.description].join(' ')
            });
            for (const field of object.fields) {
              candidates.push({
                match: {
                  kind: 'field',
                  environmentId: environment.id,
                  schemaId: schema.id,
                  objectId: object.id,
                  field
                },
                text: [field.name, field.description, ...(field.aliases ?? [])].join(' ')
              });
            }
          }
          for (const verifiedQuery of schema.verifiedQueries) {
            candidates.push({
              match: {
                kind: 'verifiedQuery',
                environmentId: environment.id,
                schemaId: schema.id,
                query: verifiedQuery
              },
              text: [
                verifiedQuery.id,
                verifiedQuery.question,
                verifiedQuery.description
              ].join(' ')
            });
          }
        }
      }
      return {
        dataContextVersion: snapshot.version,
        matches: candidates
          .map((candidate) => ({
            ...candidate,
            score: matchScore(needle, candidate.text)
          }))
          .filter(({ score }) => Number.isFinite(score))
          .sort((left, right) => left.score - right.score)
          .slice(0, limit)
          .map(({ match }) => match)
      };
    }
  };
}

function matchScore(needle: string, text: string): number {
  const normalized = text.toLocaleLowerCase();
  if (normalized === needle) return 0;
  if (normalized.startsWith(needle)) return 1;
  if (normalized.includes(needle)) return 2;
  return Number.POSITIVE_INFINITY;
}
