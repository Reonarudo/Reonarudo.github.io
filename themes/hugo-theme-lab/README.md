# hugo-theme-lab

Minimal text-first Hugo blog theme. Light/dark toggle, reading time, cover images, prev/next navigation, and build-time rendering of `pikchr` and `gnuplot` code fences.

## Setup

```sh
hugo new site myblog && cd myblog
git init
git submodule add https://github.com/yourname/hugo-theme-lab themes/hugo-theme-lab
cp themes/hugo-theme-lab/exampleSite/hugo.toml .
cp -r themes/hugo-theme-lab/exampleSite/content .
mkdir -p .github/workflows && cp themes/hugo-theme-lab/.github/workflows/hugo.yml .github/workflows/
hugo server
```

New post: `hugo new posts/my-post.md` (front matter comes from `archetypes/posts.md`).

## GitHub Pages

Push to `main`; in repo Settings → Pages set Source to **GitHub Actions**. The workflow builds and deploys automatically.

## Front matter

- `summary` — shown on the list page (falls back to auto summary)
- `cover.image`, `cover.alt`, `cover.caption` — optional hero image
- Reading time and dates are automatic

## Diagram fences

A ```` ```pikchr ```` or ```` ```gnuplot ```` fence is rendered to inline SVG at build
time, so it matches what the VS Code Markdown preview shows and needs no JavaScript,
no network service, and no client-side wasm.

````markdown
```pikchr
box "parser" fit; arrow right 0.4; box "renderer" fit
```

```gnuplot
set grid
plot sin(x) title "sin(x)"
```
````

Optional attributes, on the info line:

````markdown
```pikchr {alt="Parser pipeline" caption="How a fence becomes SVG."}
box "md" fit; arrow right 0.4; box "svg" fit
```
````

`alt` sets `role="img"` plus `aria-label`; `caption` adds a `<figcaption>`. Any other
fence language is left alone.

### How it works

`scripts/render-diagrams.mjs` scans `content/`, renders each diagram fence, and writes
`assets/diagrams/<lang>/<sha256 of the fence body>.svg`. The render hooks in
`layouts/_default/_markup/` look the SVG up by that same hash and inline it. A fence
with no matching SVG **fails the build** rather than publishing a page with a hole in it.

Add `assets/diagrams/` to the site repo's `.gitignore` — it is generated output.

### Requirements

- `gnuplot` on `PATH` (6.x; the VS Code extension bundles 6.0.2 as wasm)
- `pikchr` on `PATH`, built from the same source the extension uses:
  ```sh
  curl -fsSL -o /tmp/pikchr.c \
    https://raw.githubusercontent.com/Reonarudo/pikchr-markdown-preview-upstream/fix/delegate-non-pikchr-fences/pikchr.c
  cc -O2 -DPIKCHR_SHELL -o /usr/local/bin/pikchr /tmp/pikchr.c -lm
  ```

The supplied workflow installs both in CI, so this is only needed for local previews.

### Local preview

`hugo server` does not re-run the renderer, so re-run it after editing a fence:

```sh
node themes/hugo-theme-lab/scripts/render-diagrams.mjs && hugo server
```

### Constraints

Mirrors the gnuplot extension's policy so a fence that previews also builds:
`set terminal` / `set output` are rejected (the build owns those), as are `load` and
`call`. Data files referenced by `plot "./data/x.csv"` resolve relative to the
Markdown file, and sources are capped at 64 KB.

### Authoring both fence types in VS Code

Install **Gnuplot Markdown Preview** (`ReoX86.gnuplot-markdown-preview`) and the pikchr
extension built from the `fix/delegate-non-pikchr-fences` branch. Earlier pikchr builds
replace *every* non-pikchr fence in the preview with raw unescaped text; the branch makes
the plugin delegate fences it does not own, so both extensions coexist in either load
order. The site build is independent of both — it renders from the Markdown source.
