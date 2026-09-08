import { describe } from 'vitest';
import { createMemoryTemplateLibrary } from '../src/index';
import { runTemplateLibraryContract } from './contract';

describe('memory 契约测试', () => {
  runTemplateLibraryContract({
    create: async (options) => createMemoryTemplateLibrary(options)
  });
});
