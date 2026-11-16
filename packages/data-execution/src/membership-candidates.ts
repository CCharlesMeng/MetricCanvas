import type {FilterCandidatesGateway,RuntimeDataGateway} from './ports';

// Candidate adapters for ordinary dimensions or page sources cannot supply an authorized roster.
const withoutMembership = new WeakSet<FilterCandidatesGateway['fetchFilterCandidates']>();

export function dimensionOnlyCandidates(fetch:FilterCandidatesGateway['fetchFilterCandidates']):FilterCandidatesGateway['fetchFilterCandidates'] {
  withoutMembership.add(fetch);
  return fetch;
}

export function supportsMembershipCandidates(gateway:RuntimeDataGateway|undefined):boolean {
  const fetch = gateway?.fetchFilterCandidates;
  return typeof fetch === 'function' && !withoutMembership.has(fetch);
}

export function inheritMembershipCandidates(gateway:RuntimeDataGateway,base:RuntimeDataGateway):RuntimeDataGateway {
  if(gateway.fetchFilterCandidates&&!supportsMembershipCandidates(base))dimensionOnlyCandidates(gateway.fetchFilterCandidates);
  return gateway;
}
