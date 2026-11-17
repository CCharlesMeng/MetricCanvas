import { posix as path } from 'node:path';
import ts from 'typescript';

// Resolve TS path mappings against this snapshot, including the base commit's config and files.
export function pathResolver(tree) {
  const repositoryPath = absolute => path.relative('/repo', absolute);
  function entry(absolute) {
    const file = repositoryPath(absolute);
    if (tree.has(file)) return file;
    if (file.endsWith('.svelte.ts') && tree.has(file.slice(0, -3))) return file.slice(0, -3);
  }
  const host = {
    getCurrentDirectory: () => '/repo', useCaseSensitiveFileNames: true,
    fileExists: absolute => entry(absolute) !== undefined,
    readFile: absolute => tree.get(entry(absolute)), readDirectory: () => [],
    onUnRecoverableConfigFileDiagnostic: diagnostic => { throw Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')); },
  };
  const configs = new Map();
  function optionsFor(file) {
    const config = file.split('/').slice(0, 2).join('/') + '/tsconfig.json';
    if (!tree.has(config)) return {};
    if (!configs.has(config)) {
      const parsed = ts.getParsedCommandLineOfConfigFile('/repo/' + config, {}, host);
      const error = parsed.errors.find(item => item.code !== 18003);
      if (error) throw Error(config + ': ' + ts.flattenDiagnosticMessageText(error.messageText, '\n'));
      configs.set(config, parsed.options);
    }
    return configs.get(config);
  }
  return (name, file) => {
    const options = optionsFor(file);
    if (!options.paths && !options.baseUrl) return;
    const result = ts.resolveModuleName(name, '/repo/' + file, options, host).resolvedModule;
    if (result) return entry(result.resolvedFileName);
    if (Object.keys(options.paths ?? {}).some(pattern => matchesAlias(name, pattern))) {
      throw Error(file + ': unresolved tsconfig path ' + name);
    }
  };
}

function matchesAlias(name, pattern) {
  const [prefix, suffix] = pattern.split('*');
  if (suffix === undefined) return name === prefix;
  return name.startsWith(prefix) && name.endsWith(suffix);
}
