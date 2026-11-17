import { dependencyGraph } from './imports.mjs';
import { additions, findingsFor } from './ratchet.mjs';
import { committedTree, workingTree } from './source-tree.mjs';

const baseRef = process.env.METRICCANVAS_ARCHITECTURE_BASE ?? 'HEAD';
const base = findingsFor(dependencyGraph(committedTree(baseRef)).graph);
const { graph, typeReferences } = dependencyGraph(workingTree());
const current = findingsFor(graph);
const added = additions(current, base);
console.log(`Architecture vs ${baseRef}: ${graph.size} source modules, ${typeReferences} type references, ${current.size} existing or new findings, ${added.length} added, ${additions(base, current).length} removed.`);
const display = process.argv.includes('--list') ? [...current.values()] : added;
for (const { rule, path } of display) console.log(rule + ': ' + path.join(' -> '));
process.exitCode = Number(added.length > 0);
