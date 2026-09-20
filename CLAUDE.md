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
node themes/hugo-theme-lab/scripts/render-diagrams.mjs   # pre-render diagram fences
hugo server                                              # local preview
hugo --minify                                            # production build

hugo new content posts/my-post.md                        # new post (archetype front matter)
```

**The build is two steps, always in this order**: pre-render, then Hugo. `hugo server`
does not re-run the renderer, so after editing a `pikchr` or `gnuplot` fence:

```sh
node themes/hugo-theme-lab/scripts/render-diagrams.mjs && hugo server
```

There is no test suite. Verification is: run both steps, confirm the build is clean, and
grep the generated HTML in `public/` for what you expect (e.g. `diagram-pikchr`, an
inline `<svg>`, no leaked fence source).

### Local prerequisites

`gnuplot` (6.x) and a `pikchr` binary on `PATH`. CI installs both; for local previews:

```sh
curl -fsSL -o /tmp/pikchr.c \
  https://raw.githubusercontent.com/Reonarudo/pikchr-markdown-preview-upstream/fix/delegate-non-pikchr-fences/pikchr.c
cc -O2 -DPIKCHR_SHELL -o /usr/local/bin/pikchr /tmp/pikchr.c -lm
```

## Architecture: how diagram fences render

` ```pikchr ` and ` ```gnuplot ` fences become inline SVG **at build time**. No client-side
JavaScript or wasm is involved; the published HTML contains the finished `<svg>`.

Three pieces have to agree, and the contract between them is not visible from any one file:

1. `themes/hugo-theme-lab/scripts/render-diagrams.mjs` scans `content/`, shells out to
   `pikchr` / `gnuplot`, and writes `assets/diagrams/<lang>/<sha256>.svg`.
2. `themes/hugo-theme-lab/layouts/_default/_markup/render-codeblock-{pikchr,gnuplot}.html`
   recompute that same hash and inline the matching file.
3. **The hash is the handshake**: `sha256` of the fence body exactly as Hugo hands it to a
   render hook via `.Inner` — the fence content with the single trailing newline removed,
   `\n` line endings. Change how either side normalizes the source and every lookup misses.

A fence with no matching SVG calls `errorf`, so Hugo exits non-zero rather than publishing
a page with a hole in it. Bad diagram source fails the renderer with a file:line message.
Both are deliberate — a broken diagram must never deploy silently.

`assets/diagrams/` is generated output and gitignored. Do not commit it.

## Parity with the VS Code preview

Posts are authored in VS Code with two Markdown-preview extensions, and the site is built
to match what they show:

- [gnuplot-markdown-preview](https://github.com/Reonarudo/gnuplot-markdown-preview)
- [pikchr-markdown-preview-upstream](https://github.com/Reonarudo/pikchr-markdown-preview-upstream),
  branch `fix/delegate-non-pikchr-fences`

Consequences for this repo:

- `checkOutputPolicy()` in `render-diagrams.mjs` is a port of the extension's
  `src/policy.ts`. `set terminal` / `set output` / `load` / `call` are rejected, and
  sources are capped at 64 KB. **Keep it in sync with upstream** — a fence that previews
  cleanly should also build.
- gnuplot runs with its working directory set to the Markdown file's directory, so
  `plot "./data/x.csv"` resolves the way the preview resolves it.
- Version skew is tolerated: CI has gnuplot 6.0.0 (Ubuntu), the extension bundles 6.0.2
  (wasm). Same minor line; patch-level rendering differences are possible.

## Gotchas

- **Future-dated posts vanish silently.** A bare `date: YYYY-MM-DD` parses as UTC
  midnight; if the author's timezone is ahead of UTC that is in the future, and Hugo drops
  the page with a green build and no warning. Use the full RFC3339 stamp with offset that
  `hugo new` generates, or set `timeZone` in `hugo.toml`.
- **The content column is 680px wide, 632px inside padding.** A diagram is scaled to that
  width, so a wide diagram becomes an unreadable strip. Check the rendered `viewBox`
  aspect ratio; prefer vertical layouts.
- Markdown files must not open with an `<h1>` — the theme renders `.Title` as the page
  `<h1>`, so a leading `#` heading duplicates it.
- Pages sets itself to legacy "deploy from a branch" mode when a repo is created. It must
  be `build_type=workflow`, or Pages tries to Jekyll-build the repo root.

## Theme notes

`themes/hugo-theme-lab/README.md` documents the theme's own front matter (`summary`,
`cover.*`) and fence attributes (`{alt="..." caption="..."}`). Dark mode is a CSS filter
inversion on `.diagram svg`, because raw pikchr output is black-on-transparent and would
otherwise be invisible on the dark background.
