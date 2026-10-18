# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The Hugo source for https://reonarudo.github.io, deployed to GitHub Pages by
`.github/workflows/hugo.yml` on every push to `main`. Writing a post means adding a
Markdown file under `content/posts/` and pushing; there is nothing to build by hand.

The theme is **vendored** at `themes/hugo-theme-lab/`, not a submodule — theme edits are
ordinary commits in this repo.

## Commands

```sh
npm ci                                                   # install the renderer libraries
npm run diagrams                                         # pre-render diagram fences
hugo server                                              # local preview
hugo --minify                                            # production build

hugo new content posts/my-post.md                        # new post (archetype front matter)
```

**The build is two steps, always in this order**: pre-render, then Hugo. `hugo server`
does not re-run the renderer, so after editing a diagram fence:

```sh
npm run diagrams && hugo server
```

There is no test suite. Verification is: run both steps, confirm the build is clean, and
grep the generated HTML in `public/` for what you expect (e.g. `diagram-pikchr`, an
inline `<svg>`, no leaked fence source). `content/posts/diagram-fences/` is a published
showcase with a fence of every language; if it builds, every renderer works.

### Local prerequisites

Node 22 or later (CI uses `.nvmrc`, 24.21.0) and `npm ci`. Nothing native: every engine
runs as wasm or JavaScript inside the renderer libraries.

## Architecture: how diagram fences render

` ```pikchr `, ` ```gnuplot `, ` ```graphviz `, ` ```smiles `, ` ```smarts `,
` ```spice ` and ` ```onnx ` fences become inline SVG **at build time**. No client-side
JavaScript or wasm is involved; the published HTML contains the finished `<svg>`.

Three pieces have to agree, and the contract between them is not visible from any one file:

1. `themes/hugo-theme-lab/scripts/render-diagrams.mjs` (`npm run diagrams`) scans
   `content/`, renders each fence through its `@reonarudo/<name>-renderer` library
   (`smiles` and `smarts` share smiles-renderer), and writes
   `assets/diagrams/<lang>/<key>.svg`. It wipes `assets/diagrams/` first.
2. `themes/hugo-theme-lab/layouts/_default/_markup/render-codeblock-<lang>.html`, one per
   fence language, are one line each: they call `layouts/partials/diagram.html`, which recomputes the
   key and inlines the matching file.
3. **The key is the handshake**: `sha256(<page folder> "\n" <attribute> "\n" <fence body>)`.
   The page folder is Hugo's `.Page.File.Dir` (relative to `content/`, `/`-separated,
   trailing `/`, empty at the root). The attribute is the language's drawing attribute
   as written — `dialect` on `spice`, `direction` on `onnx` — and empty for every other
   language or when the fence has none. The driver's `RENDERERS[lang].attribute` and the
   partial's `dict` name it; keep the two in step. The body is exactly what Hugo hands a
   render hook as `.Inner` — the fence content with the single trailing newline removed,
   `\n` line endings. Change how either side computes any part and every lookup misses.
   The decision records are ADR 0007 and ADR 0008 on the Markdown Renderers wiki.

A fence with no matching SVG calls `errorf`, so Hugo exits non-zero rather than publishing
a page with a hole in it. Bad diagram source fails the renderer with a
`file:line:column` message; `--keep-going` renders the rest anyway. Both are deliberate —
a broken diagram must never deploy silently.

`assets/diagrams/` is generated output and gitignored. Do not commit it.

## Parity with the VS Code preview

Posts are authored in VS Code with Markdown-preview extensions, and the site is built to
match what they show:

- [gnuplot-markdown-preview](https://github.com/Reonarudo/gnuplot-markdown-preview)
- [pikchr-markdown-preview-upstream](https://github.com/Reonarudo/pikchr-markdown-preview-upstream),
  branch `fix/delegate-non-pikchr-fences`
- [graphviz-markdown-preview](https://github.com/Reonarudo/graphviz-markdown-preview)
- [smiles-markdown-preview](https://github.com/Reonarudo/smiles-markdown-preview)
- [spice-markdown-preview](https://github.com/Reonarudo/spice-markdown-preview)
- [onnx-markdown-preview](https://github.com/Reonarudo/onnx-markdown-preview)

The site renders through the libraries extracted from those extensions
(`Reonarudo/<name>-renderer` for pikchr, gnuplot, graphviz, smiles, spice and onnx), not through
the extensions themselves. Consequences for this repo:

- The libraries are pinned by tag in `package.json` (`github:Reonarudo/<name>-renderer#vX.Y.Z`)
  and by commit in `package-lock.json`. Tags are immutable; upgrading means a new tag and
  `npm install`.
- `npm install` writes the lockfile's git URLs as `git+ssh://`. The committed lockfile
  records `git+https://`; rewrite it back after an install
  (`sed -i '' 's#git+ssh://git@github.com/#git+https://github.com/#' package-lock.json`).
  `npm ci` fetches over HTTPS either way.
- pikchr-renderer is built from pikchr.org trunk, newer than the extension's 2021 engine:
  trunk-only syntax (`diamond`, `mono`) builds here but does not preview yet.
- The extensions draw gnuplot at 1000×500; the site passes 800×500, so the aspect ratio
  differs from the preview.
- gnuplot data files and SPICE includes resolve relative to the Markdown file, as in the
  preview, and may not leave `content/`.
- A `spice` fence is read as ngspice unless it has a `dialect` attribute; there is no
  site-wide default. The attribute as written is part of the handshake key.
- An `onnx` fence flows down unless it has `direction="right"`; any other value, `Right`
  and `""` included, fails the build. As written, it is part of the handshake key.
- Library SVGs have no `width`/`height`, only a `viewBox`. The partial sets `--nw` from it
  (×4/3 for graphviz, whose units are points; ×1 for the rest, onnx included), so a
  diagram never stretches past its natural size.

## Gotchas

- **Future-dated posts vanish silently.** A bare `date: YYYY-MM-DD` parses as UTC
  midnight; if the author's timezone is ahead of UTC that is in the future, and Hugo drops
  the page with a green build and no warning. Use the full RFC3339 stamp with offset that
  `hugo new` generates, or set `timeZone` in `hugo.toml`.
- **The content column is 680px wide, 632px inside padding.** A diagram is shown at its
  natural (viewBox) width, but a wider one is scaled down to the column, so a wide diagram
  becomes an unreadable strip. Check the rendered `viewBox`
  aspect ratio; prefer vertical layouts.
- Markdown files must not open with an `<h1>` — the theme renders `.Title` as the page
  `<h1>`, so a leading `#` heading duplicates it.
- Pages sets itself to legacy "deploy from a branch" mode when a repo is created. It must
  be `build_type=workflow`, or Pages tries to Jekyll-build the repo root.

## Theme notes

`themes/hugo-theme-lab/README.md` documents the theme's own front matter (`summary`,
`cover.*`) and fence attributes (`{alt="..." caption="..."}`). Dark mode is a CSS filter
inversion on `.diagram>svg`, the same for every renderer (graphviz and smiles colours
invert too, and onnx's Netron category colours become lighter pastels), because raw
pikchr output is black-on-transparent and would otherwise be invisible on the dark
background. Keep diagram rules on the **root** SVG (`>`): smiles
nests one `<svg>` per molecule, and a descendant selector inverts them twice.
