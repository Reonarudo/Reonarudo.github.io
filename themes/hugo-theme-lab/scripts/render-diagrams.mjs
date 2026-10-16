#!/usr/bin/env node
// Pre-renders diagram fences to SVG through the @reonarudo/<name>-renderer libraries, so Hugo
// can inline them at build time. Run from the site root as `npm run diagrams`; the libraries are
// the site's dependencies and resolve from its node_modules.
//
// Contract with layouts/partials/diagram.html (the hash handshake): a fence's SVG is written to
// <out>/<fence language>/<key>.svg, where key = sha256(<page folder> "\n" <dialect> "\n" <body>).
// - page folder is Hugo's .Page.File.Dir: the Markdown file's folder relative to the content
//   directory, `/`-separated, with a trailing `/`, and empty for a file directly in it.
// - dialect is the fence's `dialect` attribute as written, for spice fences only; else empty.
// - body is exactly what Hugo hands the hook as .Inner — the fence content with the single
//   trailing newline removed and \n line endings.
//
// Usage: node render-diagrams.mjs [--content DIR] [--out DIR] [--keep-going]

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const CONTENT = resolve(flag('--content', 'content'));
const OUT = resolve(flag('--out', 'assets/diagrams'));
const KEEP_GOING = args.includes('--keep-going');

/**
 * One entry per fence language: how to start its library's runtime, and how to turn a fence
 * into that library's render input. `reader` is the Markdown file's file reader, made on demand.
 */
const RENDERERS = {
  pikchr: {
    start: async () => (await import('@reonarudo/pikchr-renderer')).createRuntime(),
    input: async (fence) => ({ source: fence.source }),
  },
  gnuplot: {
    // 800×500 keeps the aspect and label size the native driver drew at.
    start: async () =>
      (await import('@reonarudo/gnuplot-renderer')).createRuntime({ size: { width: 800, height: 500 } }),
    input: async (fence, reader) =>
      (await import('@reonarudo/gnuplot-renderer')).prepare(fence.source, { reader: await reader('gnuplot') }),
  },
};

/** Every .md under dir, recursively. */
function markdownFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...markdownFiles(path));
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(path);
  }
  return out;
}

/** The `dialect` attribute from an info string's trailing `{…}` block, as written. */
function dialectOf(info) {
  const block = /\{(.*)\}\s*$/.exec(info);
  if (!block) return '';
  const attr = /(?:^|\s)dialect\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s}]+))/.exec(block[1]);
  return attr ? (attr[1] ?? attr[2] ?? attr[3]) : '';
}

/**
 * Fenced code blocks, CommonMark-style: 3+ backticks or tildes, optional up to
 * three leading spaces (stripped from the body), closed by a same-or-longer run
 * of the same character.
 */
function fences(markdown) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const found = [];
  for (let i = 0; i < lines.length; i++) {
    const open = /^( {0,3})(`{3,}|~{3,})\s*(.*)$/.exec(lines[i]);
    if (!open) continue;
    const [, indent, marker, info] = open;
    // An info string on a backtick fence may not itself contain a backtick.
    if (marker[0] === '`' && info.includes('`')) continue;
    const body = [];
    let i2 = i + 1;
    for (; i2 < lines.length; i2++) {
      const close = new RegExp(`^ {0,3}${marker[0]}{${marker.length},}\\s*$`);
      if (close.test(lines[i2])) break;
      body.push(lines[i2].startsWith(indent) ? lines[i2].slice(indent.length) : lines[i2].replace(/^ +/, ''));
    }
    const lang = /^[^\s{]*/.exec(info.trim())[0];
    found.push({ lang, dialect: lang === 'spice' ? dialectOf(info) : '', source: body.join('\n'), line: i + 1 });
    i = i2;
  }
  return found;
}

/** Hugo's .Page.File.Dir for a Markdown file under CONTENT. */
function pageFolder(file) {
  const folder = relative(CONTENT, dirname(file));
  return folder ? folder.split(sep).join('/') + '/' : '';
}

/** Where a fence-relative line and column land in the Markdown file. */
function position(file, fence, line, column) {
  const at = `${relative(process.cwd(), file)}:${line ? fence.line + line : fence.line}`;
  return line && column ? `${at}:${column}` : at;
}

const failures = [];
const runtimes = new Map(); // fence language → Promise<Runtime>, started on first use
let rendered = 0;

let documents = [];
try {
  documents = statSync(CONTENT).isDirectory() ? markdownFiles(CONTENT) : [];
} catch {
  console.error(`render-diagrams: no content directory at ${CONTENT}`);
  process.exit(1);
}

// Every run starts empty, so an SVG on disk is always one this run rendered.
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

try {
  for (const file of documents) {
    const markdown = readFileSync(file, 'utf8');
    const folder = pageFolder(file);
    // One file reader per Markdown file, shared by its fences; it reads only inside CONTENT.
    // The libraries' readers are interchangeable (ADR 0002), so the first one asked for serves all.
    let fileReader;
    const reader = async (lang) =>
      (fileReader ??= (await import(`@reonarudo/${lang}-renderer`)).nodeFileReader({ root: CONTENT, document: file }));
    for (const fence of fences(markdown)) {
      const renderer = RENDERERS[fence.lang];
      if (!renderer) continue;
      if (!runtimes.has(fence.lang)) runtimes.set(fence.lang, renderer.start());
      const runtime = await runtimes.get(fence.lang);
      const result = runtime.render(await renderer.input(fence, reader));
      const where = (line, column) => `${position(file, fence, line, column)} (${fence.lang})`;
      switch (result.status) {
        case 'success': {
          for (const note of result.notes) console.warn(`render-diagrams: warning: ${where()}: ${note}`);
          const key = createHash('sha256').update(`${folder}\n${fence.dialect}\n${fence.source}`).digest('hex');
          mkdirSync(join(OUT, fence.lang), { recursive: true });
          writeFileSync(join(OUT, fence.lang, `${key}.svg`), result.output);
          rendered++;
          break;
        }
        case 'failure':
          failures.push(`${where(result.line, result.column)}: ${result.message}`);
          break;
        case 'timeout':
          failures.push(`${where()}: timed out after ${result.budget} ms`);
          break;
        case 'unavailable':
          failures.push(`${where()}: renderer unavailable: ${result.reason}`);
          break;
      }
    }
  }
} finally {
  await Promise.all([...runtimes.values()].map(async (runtime) => (await runtime).dispose()));
}

console.log(`render-diagrams: rendered ${rendered} diagram${rendered === 1 ? '' : 's'} to ${relative(process.cwd(), OUT)}`);
if (failures.length) {
  console.error(`\nrender-diagrams: ${failures.length} fence(s) failed:`);
  for (const failure of failures) console.error(`  ${failure}`);
  if (!KEEP_GOING) process.exit(1);
}
