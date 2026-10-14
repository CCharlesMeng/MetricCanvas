import assert from 'node:assert/strict';

/** Standalone validation is complete; CI delegates source tests/types to its required jobs. */
export function sourceCheckCommands(mode, context) {
  assert(['full', 'ci'].includes(mode), 'source-checks must be full or ci');
  if (mode === 'full') return ['test', 'check', 'build'];
  assert(context.githubActions === 'true' && ['true', '1'].includes(context.ci),
    'source-checks=ci requires GitHub Actions');
  assert(/^[a-f0-9]{40}$/.test(context.headSha) && context.githubSha === context.headSha,
    'CI source checks must use the checked-out GitHub SHA');
  assert(/^[a-f0-9]{40}$/.test(context.sourceTree ?? '') && context.sourceTree === context.headTree,
    'CI source checks must use the checked-out source tree');
  return ['build'];
}
