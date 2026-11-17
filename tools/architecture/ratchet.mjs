import { layerOf } from './source-tree.mjs';

// The UI composes the layers. Rules below constrain the direction from their consumers.
const allowedLayers = new Map([
  ['page', ['page']],
  ['data-execution', ['data-execution', 'page']],
  ['runtime', ['runtime', 'data-execution', 'page']],
  ['data-gateway', ['data-gateway', 'runtime', 'data-execution', 'page']],
  ['widgets', ['widgets', 'ui', 'page', 'data-execution']],
]);
const presentationPackages = /^npm:(?:svelte|echarts|exceljs|write-excel-file|html2canvas|jspdf)(?:\/|$)/;

function forbidden(origin, allowed, file) {
  if (file.startsWith('npm:@metriccanvas/')) return true;
  if (file.startsWith('npm:')) return origin !== 'widgets' && presentationPackages.test(file);
  return !allowed.includes(layerOf(file));
}

function addEdge(graph, from, to) {
  if (!graph.has(from)) graph.set(from, new Set());
  graph.get(from).add(to);
}

function reverse(graph) {
  const reversed = new Map();
  for (const [from, targets] of graph) for (const to of targets) addEdge(reversed, to, from);
  return reversed;
}

// Each parent map also provides a shortest diagnostic path.
function visit(graph, roots, stop = () => false) {
  const queue = [...roots];
  const parents = new Map(queue.map(root => [root, null]));
  for (let i = 0; i < queue.length; i++) {
    const from = queue[i];
    if (stop(from)) continue;
    for (const to of graph.get(from) ?? []) {
      if (parents.has(to)) continue;
      parents.set(to, from);
      queue.push(to);
    }
  }
  return parents;
}

function pathBack(parents, from) {
  const path = [];
  for (let file = from; file !== null; file = parents.get(file)) path.push(file);
  return path;
}

function cycleEdges(graph, reversed, findings) {
  for (const start of graph.keys()) {
    const incoming = reversed.get(start);
    if (!incoming) continue;
    const reached = visit(graph, [start]);
    for (const from of incoming) {
      if (!reached.has(from)) continue;
      const witness = [from, ...pathBack(reached, from).reverse()];
      findings.set(JSON.stringify(['cycle', from, start]), { rule: 'cycle', path: witness });
    }
  }
}

// Record every edge on a forbidden route, including a new detour to a previously reachable destination.
function boundaryEdges(graph, origin, allowed, findings) {
  const denied = file => forbidden(origin, allowed, file);
  const roots = [...graph.keys()].filter(file => layerOf(file) === origin);
  const parents = visit(graph, roots, denied);
  const accessible = new Map([...graph].filter(([file]) => parents.has(file) && !denied(file)));
  const reversed = reverse(accessible);
  for (const target of parents.keys()) {
    if (!denied(target)) continue;
    const towardsTarget = visit(reversed, [target]);
    for (const to of towardsTarget.keys()) {
      for (const from of reversed.get(to) ?? []) {
        const key = JSON.stringify([origin, target, from, to]);
        const witness = [...pathBack(parents, from).reverse(), ...pathBack(towardsTarget, to)];
        findings.set(key, { rule: origin + ' boundary', path: witness });
      }
    }
  }
}

export function findingsFor(graph) {
  const findings = new Map();
  cycleEdges(graph, reverse(graph), findings);
  for (const [origin, allowed] of allowedLayers) boundaryEdges(graph, origin, allowed, findings);
  return findings;
}

export function additions(current, base) {
  return [...current].filter(([key]) => !base.has(key)).map(([, finding]) => finding);
}
