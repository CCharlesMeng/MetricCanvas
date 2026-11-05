import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { gzipSync } from 'node:zlib';
import { optimize } from 'svgo';

const usage = `Usage: pnpm svg:optimize <input.svg> [-o output.svg] [--precision 0..10]
Defaults: output in .scratch/svg-optimized/, precision 6.
Source files and existing outputs are never overwritten.`;

function svgConfig(path, precision) {
  return {
    path,
    multipass: true,
    floatPrecision: precision,
    plugins: [{
      name: 'preset-default',
      params: { overrides: {
        cleanupIds: false,
        removeDesc: false,
        removeHiddenElems: false,
        removeUnknownsAndDefaults: false,
        convertPathData: { floatPrecision: precision, transformPrecision: precision },
        convertTransform: { floatPrecision: precision, transformPrecision: precision }
      } }
    }]
  };
}

function parsePrecision(value) {
  if (!/^(?:[0-9]|10)$/.test(String(value))) throw new Error('precision must be an integer from 0 to 10');
  return Number(value);
}

function svgPaths(inputPath, outputPath) {
  const input = resolve(inputPath);
  const name = basename(input, extname(input));
  const output = resolve(outputPath ?? join('.scratch', 'svg-optimized', `${name}.optimized.svg`));
  if (extname(input).toLowerCase() !== '.svg' || extname(output).toLowerCase() !== '.svg') {
    throw new Error('Input and output must be .svg files');
  }
  if (input === output) throw new Error('Output must differ from the source SVG');
  return { input, output };
}

export async function optimizeSvgFile(inputPath, outputPath, precision = 6) {
  const { input, output } = svgPaths(inputPath, outputPath);
  const digits = parsePrecision(precision);
  const source = await readFile(input);
  const svg = new TextDecoder('utf-8', { fatal: true }).decode(source);
  const candidate = Buffer.from(optimize(svg, svgConfig(input, digits)).data);
  // Keep the original bytes when optimization would make the copy larger.
  const data = candidate.byteLength < source.byteLength ? candidate : source;
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, data, { flag: 'wx' });
  return {
    input,
    output,
    precision: digits,
    beforeBytes: source.byteLength,
    afterBytes: data.byteLength,
    savedPercent: Number(((source.byteLength - data.byteLength) * 100 / source.byteLength).toFixed(2)),
    gzipBytes: gzipSync(data).byteLength,
    base64DataUrlBytes: 'data:image/svg+xml;base64,'.length + 4 * Math.ceil(data.byteLength / 3)
  };
}

async function main(args) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      output: { type: 'string', short: 'o' },
      precision: { type: 'string', default: '6' },
      help: { type: 'boolean', short: 'h' }
    }
  });
  if (values.help) return console.log(usage);
  if (positionals.length !== 1) throw new Error(usage);
  const result = await optimizeSvgFile(positionals[0], values.output, values.precision);
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
