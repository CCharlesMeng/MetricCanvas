/** Local AST measurement. Counting contract: docs/agents/code-complexity.md. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const branchKinds = new Set([
  ts.SyntaxKind.IfStatement, ts.SyntaxKind.ConditionalExpression,
  ts.SyntaxKind.ForStatement, ts.SyntaxKind.ForInStatement, ts.SyntaxKind.ForOfStatement,
  ts.SyntaxKind.WhileStatement, ts.SyntaxKind.DoStatement,
  ts.SyntaxKind.CaseClause, ts.SyntaxKind.CatchClause,
]);
const logicalKinds = new Set([
  ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.AmpersandAmpersandEqualsToken,
  ts.SyntaxKind.BarBarEqualsToken, ts.SyntaxKind.QuestionQuestionEqualsToken,
]);

function callable(node) {
  return !!node.body && (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) || ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) || ts.isGetAccessor(node) || ts.isSetAccessor(node));
}

function nameOf(node, source) {
  if (node.name) return node.name.getText(source);
  if (ts.isConstructorDeclaration(node)) return 'constructor';
  const parent = node.parent;
  if (ts.isVariableDeclaration(parent) || ts.isPropertyAssignment(parent)) return parent.name.getText(source);
  if (ts.isBinaryExpression(parent)) return parent.left.getText(source);
  const at = source.getLineAndCharacterOfPosition(node.getStart(source));
  return `<anonymous@${at.line + 1}:${at.character + 1}>`;
}

function ownMetrics(fn) {
  let selfCC = 1;
  let optionalChains = 0;
  function visit(node) {
    if (node !== fn && callable(node)) return;
    if (ts.isTypeNode(node)) return;
    if (branchKinds.has(node.kind)) selfCC++;
    if (ts.isBinaryExpression(node) && logicalKinds.has(node.operatorToken.kind)) selfCC++;
    if (node.questionDotToken) optionalChains++;
    ts.forEachChild(node, visit);
  }
  visit(fn);
  return { selfCC, optionalChains };
}

export function measureSource(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  if (source.parseDiagnostics.length) {
    throw new Error(`${file}: ${source.parseDiagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, ' ')).join('; ')}`);
  }
  const functions = [];
  function visit(node, parent) {
    if (ts.isTypeNode(node)) return;
    let owner = parent;
    if (callable(node)) {
      const name = nameOf(node, source);
      const row = {
        name, qualifiedName: parent ? `${parent.qualifiedName}/${name}` : name,
        line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
        endLine: source.getLineAndCharacterOfPosition(node.end).line + 1,
        ...ownMetrics(node), subtreeCC: 1, nestedFunctions: 0,
      };
      functions.push(row);
      owner = row;
    }
    const start = functions.length;
    ts.forEachChild(node, child => visit(child, owner));
    if (owner !== parent) {
      const descendants = functions.slice(start);
      owner.nestedFunctions = descendants.length;
      owner.subtreeCC = owner.selfCC + descendants.reduce((sum, child) => sum + child.selfCC - 1, 0);
    }
  }
  visit(source, null);
  return { file, functions };
}

export function measureFiles(files) {
  return {
    analyzer: 'metriccanvas-ts-ast/1', typescriptVersion: ts.version,
    files: files.map(file => measureSource(file, readFileSync(file, 'utf8'))),
  };
}

function main(files) {
  if (!files.length || files.includes('--help')) {
    console.log('Usage: node tools/scripts/measure-ts-complexity.mjs <file.ts> [...]\nPrints JSON measurements; this command does not enforce a threshold.');
    return files.length ? 0 : 1;
  }
  console.log(JSON.stringify(measureFiles(files), null, 2));
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
