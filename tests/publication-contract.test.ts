import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { pageSchema, validate } from '../packages/page/src/internal';
import { buildPublicationSchema, publicationSchemaId, validatePublicationStructure, validateCandidateRelations, validateConfirmationRelations, validateCorrectionsRelations, validateResultRelations, candidateReviewPayload, reviewFields, type DefinitionName, type Request } from '../metriccanvas-authoring/contracts/authored/publication-contract';
const require = createRequire(new URL('../packages/page/package.json', import.meta.url));
const Ajv = require('ajv/dist/2020.js').default;
const ajv = new Ajv({strict:false,allErrors:true});
const schema = buildPublicationSchema(pageSchema);
ajv.addSchema(schema);
const PageAjv = require('ajv').default;
const pageCheck = new PageAjv({strict:false}).compile(pageSchema);
const vectors = JSON.parse(readFileSync('metriccanvas-authoring/contracts/authored/publication-conformance.json','utf8'));
const validatePage = (value:unknown) => validate(value).length===0;
const example = {kind:'read',ref:{candidateId:'c',candidateVersion:'v',source:{pageId:'p',revisionId:'r',resourceId:'s'}}} satisfies Request;

describe('publication/1 single-author contract', () => {
  it('retains inferred consumer types and exact emitted snapshots', () => {
    expect(validatePublicationStructure('Request',example)).toEqual([]);
    expect(JSON.parse(readFileSync('contracts/metriccanvas/authoring/publication.schema.json','utf8'))).toEqual(schema);
    expect(readFileSync('contracts/metriccanvas/authoring/publication-conformance.json','utf8')).toEqual(readFileSync('metriccanvas-authoring/contracts/authored/publication-conformance.json','utf8'));
    expect(readFileSync('metriccanvas-authoring/contract-snapshot/authoring/publication.schema.json','utf8')).toEqual(readFileSync('contracts/metriccanvas/authoring/publication.schema.json','utf8'));
  });
  for(const vector of vectors.cases) it(vector.id, () => {
    const check=ajv.compile({$ref:`${publicationSchemaId}#/$defs/${vector.definition}`});
    expect(Boolean(check(vector.input)),JSON.stringify(check.errors)).toBe(vector.expected.structure);
    expect(validatePublicationStructure(vector.definition as DefinitionName,vector.input,{validatePageStructure:pageCheck}).length===0).toBe(vector.expected.structure);
    if(vector.expected.relations===undefined)return;
    const context=vector.context??{};
    const errors=vector.definition==='Candidate'?validateCandidateRelations(vector.input,{validatePage,...context}):vector.definition==='Confirmation'?validateConfirmationRelations(vector.input,context.candidate,context.identity):vector.definition==='Corrections'?validateCorrectionsRelations(vector.input,context.candidate):validateResultRelations(context.request,vector.input);
    expect(errors.length===0,JSON.stringify(errors)).toBe(vector.expected.relations);
  });
  it('review payload includes all eleven frozen fields and excludes document/hash outputs', () => {
    const candidate=vectors.cases.find((v:any)=>v.id==='candidate-dimension-bindings').input;
    const payload=candidateReviewPayload(candidate);
    expect(Object.keys(payload)).toEqual([...reviewFields]);
    expect(reviewFields).toHaveLength(11);
    for(const key of reviewFields){const changed=structuredClone(candidate);changed[key]=null;expect(candidateReviewPayload(changed)).not.toEqual(payload);}
    for(const key of ['document','reviewHash','reviewCanonicalization']){const changed=structuredClone(candidate);changed[key]=null;expect(candidateReviewPayload(changed)).toEqual(payload);}
    payload.ref.candidateId='changed';expect(candidate.ref.candidateId).toBe('candidate-1');
  });
});
