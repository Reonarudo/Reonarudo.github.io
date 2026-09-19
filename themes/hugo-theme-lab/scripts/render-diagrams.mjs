#!/usr/bin/env node
// Pre-renders `pikchr` and `gnuplot` fences to SVG so Hugo can inline them at build time.
//
// Contract with layouts/_default/_markup/render-codeblock-{pikchr,gnuplot}.html:
// a fence's SVG is written to <out>/<lang>/<sha256 of the fence body>.svg, where the
// body is exactly what Hugo hands the hook as .Inner — the fence content with the
// single trailing newline removed and \n line endings.
//
// Usage: node render-diagrams.mjs [--content DIR] [--out DIR] [--keep-going]

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const CONTENT = resolve(flag('--content', 'content'));
const OUT = resolve(flag('--out', 'assets/diagrams'));
const KEEP_GOING = args.includes('--keep-going');

const LANGS = new Set(['pikchr', 'gnuplot']);
const GNUPLOT_SIZE = { width: 800, height: 500 };
const PREAMBLE_LINES = 2; // set terminal + set output, prepended to every gnuplot fence
const MAX_SOURCE_BYTES = 64_000; // matches the extension's limit

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
    found.push({ lang: info.trim().split(/\s+/)[0] ?? '', source: body.join('\n'), line: i + 1 });
    i = i2;
  }
  return found;
}

/**
 * The preview owns terminal and output; mirrors src/policy.ts in
 * gnuplot-markdown-preview so a fence that previews cleanly also builds.
 */
function checkOutputPolicy(source) {
  const code = source
    .replace(/\\\r?\n/g, '')
    .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#[^\n]*/g, ' ');
  if (/\b(?:set|unset)\s+(?:term(?:i(?:n(?:a(?:l)?)?)?)?|out(?:p(?:u(?:t)?)?)?)\b/i.test(code)) {
    throw new Error('The build controls terminal and output. Remove set terminal / set output commands.');
  }
  if (/(?:^|[;\n])\s*(?:load|call)\b/i.test(code)) {
    throw new Error('Loading external gnuplot scripts is not supported.');
  }
}

/** Strip the XML prolog and fixed dimensions so the SVG inlines and scales. */
function inlineable(svg) {
  return svg
    .replace(/<\?xml[^>]*\?>\s*/g, '')
    .replace(/<!DOCTYPE[^>]*>\s*/g, '')
    .replace(/<!--[\s\S]*?-->\s*/g, '')
    // Drop fixed dimensions from the opening tag only, so the viewBox drives sizing.
    // A single global replace would skip the second attribute of an adjacent pair.
    .replace(/<svg\b[^>]*>/, (tag) => tag.replace(/\s(?:width|height)="[^"]*"/g, ''))
    .trim();
}

function renderPikchr(source) {
  const dir = mkdtempSync(join(tmpdir(), 'pikchr-'));
  try {
    const input = join(dir, 'diagram.pikchr');
    writeFileSync(input, source + '\n');
    let svg;
    try {
      svg = execFileSync('pikchr', ['--svg-only', input], { encoding: 'utf8', maxBuffer: 32 << 20 });
    } catch (error) {
      // On a syntax error pikchr exits non-zero and reports on stdout as an HTML
      // fragment with the offending line marked; that report is the useful message.
      svg = (error.stdout ?? '').toString() || (error.stderr ?? '').toString() || error.message;
    }
    if (!svg.trimStart().startsWith('<svg')) {
      const text = svg
        .replace(/<[^>]+>/g, '')
        .replace(/&(?:amp|lt|gt|quot|#39);/g, (e) => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" })[e])
        .split('\n')
        .map((line) => line.trimEnd())
        .filter(Boolean);
      throw new Error(text.slice(0, 6).join('\n         '));
    }
    return inlineable(svg);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function renderGnuplot(source, cwd) {
  checkOutputPolicy(source);
  const dir = mkdtempSync(join(tmpdir(), 'gnuplot-'));
  try {
    const output = join(dir, 'plot.svg');
    const script = [
      `set terminal svg enhanced size ${GNUPLOT_SIZE.width},${GNUPLOT_SIZE.height} background rgb 'white'`,
      `set output '${output}'`,
      source,
      'unset output',
    ].join('\n');
    // cwd is the document's directory so relative data files resolve the way the
    // preview resolves them.
    execFileSync('gnuplot', ['-d', '-c', '/dev/stdin'], {
      input: script,
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 32 << 20,
    });
    return inlineable(readFileSync(output, 'utf8'));
  } catch (error) {
    const stderr = (error.stderr ?? '').toString().trim();
    if (!stderr) throw new Error(error.message);
    // gnuplot numbers lines against the script we fed it; PREAMBLE_LINES of that are
    // ours, so report positions relative to the fence the author actually wrote.
    throw new Error(
      stderr
        .replace(/^"[^"]*" line (\d+):/gm, (match, line) => {
          const fenceLine = Number(line) - PREAMBLE_LINES;
          return fenceLine > 0 ? `line ${fenceLine} of the fence:` : match;
        })
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .join('\n         '),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const failures = [];
let rendered = 0;

mkdirSync(OUT, { recursive: true });
for (const lang of LANGS) mkdirSync(join(OUT, lang), { recursive: true });

let documents = [];
try {
  documents = statSync(CONTENT).isDirectory() ? markdownFiles(CONTENT) : [];
} catch {
  console.error(`render-diagrams: no content directory at ${CONTENT}`);
  process.exit(1);
}

for (const file of documents) {
  const markdown = readFileSync(file, 'utf8');
  for (const fence of fences(markdown)) {
    if (!LANGS.has(fence.lang)) continue;
    const where = `${relative(process.cwd(), file)}:${fence.line}`;
    try {
      if (Buffer.byteLength(fence.source) > MAX_SOURCE_BYTES) {
        throw new Error(`${fence.lang} source exceeds the ${MAX_SOURCE_BYTES / 1000} KB limit.`);
      }
      const svg =
        fence.lang === 'pikchr' ? renderPikchr(fence.source) : renderGnuplot(fence.source, dirname(file));
      const digest = createHash('sha256').update(fence.source).digest('hex');
      writeFileSync(join(OUT, fence.lang, `${digest}.svg`), svg);
      rendered++;
    } catch (error) {
      failures.push(`${where} (${fence.lang}): ${error.message}`);
    }
  }
}

console.log(`render-diagrams: rendered ${rendered} diagram${rendered === 1 ? '' : 's'} to ${relative(process.cwd(), OUT)}`);
if (failures.length) {
  console.error(`\nrender-diagrams: ${failures.length} fence(s) failed:`);
  for (const failure of failures) console.error(`  ${failure}`);
  if (!KEEP_GOING) process.exit(1);
}
