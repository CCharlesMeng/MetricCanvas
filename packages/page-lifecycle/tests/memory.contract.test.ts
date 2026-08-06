import { createMemoryPageLifecycle } from '../src/memory';
import { runPageLifecycleContract } from './contract';

runPageLifecycleContract({
  create: async (options) => createMemoryPageLifecycle(options)
});
